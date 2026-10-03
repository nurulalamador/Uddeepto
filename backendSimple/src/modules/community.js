import express from "express";
import {
  createApp,
  resourceRouter,
  query,
  asyncHandler,
  auth,
  ApiError,
  page,
  notify,
  notifyAdmins,
} from "../common.js";
const app = createApp("community"),
  r = express.Router();
r.get(
  "/showcase",
  auth(false),
  asyncHandler(async (q, s) => {
    const { limit, offset } = page(q);
    s.json(
      (
        await query(
          `SELECT p.*,u.name creator_name,(SELECT count(*) FROM showcase_post_reactions WHERE post_id=p.id) reactions,(SELECT count(*) FROM showcase_post_comments WHERE post_id=p.id AND deleted_at IS NULL) comments FROM showcase_posts p JOIN users u ON u.id=p.creator_id WHERE p.deleted_at IS NULL AND p.visibility='public' ORDER BY p.created_at DESC LIMIT $1 OFFSET $2`,
          [limit, offset],
        )
      ).rows,
    );
  }),
);
r.post(
  "/showcase",
  auth(),
  (q, _s, n) =>
    q.user.role === "hirer"
      ? n(
          new ApiError(
            403,
            "Hiring accounts can view the showcase but not post to it",
          ),
        )
      : n(),
  asyncHandler(async (q, s) =>
    s
      .status(201)
      .json(
        (
          await query(
            `INSERT INTO showcase_posts(creator_id,category_id,content,visibility) VALUES($1,$2,$3,$4) RETURNING *`,
            [
              q.user.sub,
              q.body.category_id,
              q.body.content,
              q.body.visibility || "public",
            ],
          )
        ).rows[0],
      ),
  ),
);
r.post(
  "/showcase/:id/comments",
  auth(),
  asyncHandler(async (q, s) =>
    s
      .status(201)
      .json(
        (
          await query(
            `INSERT INTO showcase_post_comments(post_id,commenter_id,parent_comment_id,content) VALUES($1,$2,$3,$4) RETURNING *`,
            [q.params.id, q.user.sub, q.body.parent_comment_id, q.body.content],
          )
        ).rows[0],
      ),
  ),
);
r.put(
  "/showcase/:id/reactions/:reaction",
  auth(),
  asyncHandler(async (q, s) => {
    await query(
      `INSERT INTO showcase_post_reactions(post_id,user_id,reaction) VALUES($1,$2,$3) ON CONFLICT DO NOTHING`,
      [q.params.id, q.user.sub, q.params.reaction],
    );
    s.status(204).end();
  }),
);
r.post(
  "/showcase/:id/report",
  auth(),
  asyncHandler(async (q, s) => {
    const post = (
      await query(
        `SELECT creator_id FROM showcase_posts WHERE id=$1 AND visibility='public' AND deleted_at IS NULL`,
        [q.params.id],
      )
    ).rows[0];
    if (!post) throw new ApiError(404, "Post not found");
    if (post.creator_id === q.user.sub)
      throw new ApiError(409, "You cannot report your own post");
    const reason = String(q.body.reason || "").trim(),
      details = String(q.body.details || "").trim();
    if (
      !["spam", "harassment", "inappropriate", "other"].includes(reason) ||
      details.length > 2000
    )
      throw new ApiError(
        422,
        "Choose a valid reason and keep details under 2,000 characters",
      );
    const created = await query(
      `INSERT INTO reported_showcase_posts(post_id,reporter_id,reason,details) VALUES($1,$2,$3,$4) ON CONFLICT(post_id,reporter_id) DO NOTHING RETURNING id`,
      [q.params.id, q.user.sub, reason, details || null],
    );
    if (!created.rowCount)
      throw new ApiError(409, "You have already reported this post");
    await notifyAdmins({
      actor: q.user.sub,
      type: "report_received",
      title: "A showcase post was reported",
      body: `Reason: ${reason}`,
      link: "/moderation",
      entity: ["report", created.rows[0].id],
      key: `report:${created.rows[0].id}`,
    });
    s.status(201).json({ reported: true });
  }),
);
r.post(
  "/:id/join",
  auth(),
  asyncHandler(async (q, s) => {
    const c = (
      await query("SELECT name,requires_approval FROM communities WHERE id=$1", [
        q.params.id,
      ])
    ).rows[0];
    if (!c) throw new ApiError(404, "Community not found");
    const status = c.requires_approval ? "pending" : "approved";
    const joined = await query(
      `INSERT INTO community_members(community_id,member_id,status,approved_at) VALUES($1,$2,$3::membership_status,CASE WHEN $4 THEN now() END) ON CONFLICT DO NOTHING`,
      [q.params.id, q.user.sub, status, status === "approved"],
    );
    if (joined.rowCount) {
      // Tell the owner and moderators that someone joined, or is waiting for approval.
      const who =
        (await query("SELECT name FROM users WHERE id=$1", [q.user.sub]))
          .rows[0]?.name || "Someone";
      const managers = (
        await query(
          `SELECT creator_id AS id FROM communities WHERE id=$1 UNION SELECT member_id FROM community_members WHERE community_id=$1 AND is_moderator AND status='approved'`,
          [q.params.id],
        )
      ).rows.map((row) => row.id);
      await notify({
        to: managers,
        actor: q.user.sub,
        type:
          status === "pending"
            ? "community_join_request"
            : "community_member_joined",
        title:
          status === "pending"
            ? `${who} asked to join ${c.name}`
            : `${who} joined ${c.name}`,
        body:
          status === "pending"
            ? "Review the request from the member list."
            : null,
        link: `/communities/${q.params.id}`,
        entity: ["community", q.params.id],
        key: `join:${q.params.id}:${q.user.sub}:${status}`,
      });
    }
    s.status(201).json({ status });
  }),
);
r.post(
  "/:id/chats",
  auth(),
  asyncHandler(async (q, s) => {
    const ok = await query(
      `SELECT 1 FROM communities c LEFT JOIN community_members m ON m.community_id=c.id AND m.member_id=$2 WHERE c.id=$1 AND(c.creator_id=$2 OR(m.status='approved' AND m.is_moderator)OR $3 IN('admin','moderator'))`,
      [q.params.id, q.user.sub, q.user.role],
    );
    if (!ok.rowCount) throw new ApiError(403, "Moderator permission required");
    s.status(201).json(
      (
        await query(
          "INSERT INTO community_chats(community_id,name,description,sort_order) VALUES($1,$2,$3,$4) RETURNING *",
          [
            q.params.id,
            q.body.name,
            q.body.description,
            q.body.sort_order || 0,
          ],
        )
      ).rows[0],
    );
  }),
);
r.get(
  "/:id/chats/:chatId/messages",
  auth(),
  asyncHandler(async (q, s) => {
    const { limit, offset } = page(q);
    s.json(
      (
        await query(
          `SELECT m.*,u.name sender_name FROM community_chat_messages m JOIN users u ON u.id=m.sender_id JOIN community_members cm ON cm.community_id=m.community_id AND cm.member_id=$3 AND cm.status='approved' WHERE m.community_id=$1 AND m.chat_id=$2 AND m.deleted_at IS NULL ORDER BY m.created_at DESC LIMIT $4 OFFSET $5`,
          [q.params.id, q.params.chatId, q.user.sub, limit, offset],
        )
      ).rows,
    );
  }),
);
r.post(
  "/:id/chats/:chatId/messages",
  auth(),
  asyncHandler(async (q, s) => {
    const ok = await query(
      `SELECT 1 FROM community_members WHERE community_id=$1 AND member_id=$2 AND status='approved'`,
      [q.params.id, q.user.sub],
    );
    if (!ok.rowCount) throw new ApiError(403, "Approved membership required");
    s.status(201).json(
      (
        await query(
          `INSERT INTO community_chat_messages(community_id,chat_id,sender_id,reply_to_id,content) VALUES($1,$2,$3,$4,$5) RETURNING *`,
          [
            q.params.id,
            q.params.chatId,
            q.user.sub,
            q.body.reply_to_id,
            q.body.content,
          ],
        )
      ).rows[0],
    );
  }),
);
r.use(
  "/",
  resourceRouter({
    table: "communities",
    fields: [
      "name",
      "slug",
      "description",
      "category_id",
      "requires_approval",
      "is_private",
    ],
    required: ["name", "slug", "category_id"],
    search: ["name", "description"],
  }),
);
app.use("/", r);
export default app;
