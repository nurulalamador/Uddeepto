import express from "express";
import {
  createApp,
  query,
  tx,
  asyncHandler,
  auth,
  ApiError,
  page,
  listen,
} from "@uddeepto/common";
const app = createApp("messages"),
  r = express.Router();
r.use(auth());
r.get(
  "/",
  asyncHandler(async (q, s) => {
    const { limit, offset } = page(q);
    s.json(
      (
        await query(
          `SELECT c.*, (SELECT content FROM messages WHERE conversation_id=c.id AND deleted_at IS NULL ORDER BY sent_at DESC LIMIT 1) last_message FROM conversations c JOIN conversation_members cm ON cm.conversation_id=c.id WHERE cm.user_id=$1 ORDER BY c.updated_at DESC LIMIT $2 OFFSET $3`,
          [q.user.sub, limit, offset],
        )
      ).rows,
    );
  }),
);
r.post(
  "/",
  asyncHandler(async (q, s) => {
    const ids = [...new Set([q.user.sub, ...(q.body.member_ids || [])])];
    if (ids.length < 2)
      throw new ApiError(422, "At least one recipient required");
    const c = await tx(async (db) => {
      const x = (
        await db.query("INSERT INTO conversations DEFAULT VALUES RETURNING *")
      ).rows[0];
      for (const id of ids)
        await db.query(
          "INSERT INTO conversation_members(conversation_id,user_id) VALUES($1,$2)",
          [x.id, id],
        );
      return x;
    });
    s.status(201).json(c);
  }),
);
r.get(
  "/:id",
  asyncHandler(async (q, s) => {
    const { limit, offset } = page(q);
    const x = await query(
      `SELECT m.*,u.name sender_name FROM messages m JOIN users u ON u.id=m.sender_id JOIN conversation_members cm ON cm.conversation_id=m.conversation_id AND cm.user_id=$2 WHERE m.conversation_id=$1 AND m.deleted_at IS NULL ORDER BY m.sent_at DESC LIMIT $3 OFFSET $4`,
      [q.params.id, q.user.sub, limit, offset],
    );
    s.json(x.rows);
  }),
);
r.post(
  "/:id",
  asyncHandler(async (q, s) => {
    const x = await query(
      `INSERT INTO messages(conversation_id,sender_id,reply_to_id,content) SELECT $1,$2,$3,$4 WHERE EXISTS(SELECT 1 FROM conversation_members WHERE conversation_id=$1 AND user_id=$2) RETURNING *`,
      [q.params.id, q.user.sub, q.body.reply_to_id, q.body.content],
    );
    if (!x.rowCount) throw new ApiError(403, "Not a conversation member");
    await query("UPDATE conversations SET updated_at=now() WHERE id=$1", [
      q.params.id,
    ]);
    s.status(201).json(x.rows[0]);
  }),
);
r.post(
  "/:id/read",
  asyncHandler(async (q, s) => {
    await query(
      "UPDATE conversation_members SET last_read_at=now() WHERE conversation_id=$1 AND user_id=$2",
      [q.params.id, q.user.sub],
    );
    s.status(204).end();
  }),
);
app.use("/", r);
listen(app, process.env.MESSAGES_PORT || 4008, "messages");
