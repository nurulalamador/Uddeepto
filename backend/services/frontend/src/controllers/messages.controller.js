import { run } from "../middleware/response.middleware.js";
import { conversationAccess } from "../services/messages.service.js";
import { uuid, one, text } from "../services/shared.service.js";
import { query, ApiError, tx, emit, userRoom } from "@uddeepto/common";
export const getMessages = run(async req => {
  return (await query(`SELECT c.id,c.updated_at,u.name,u.id other_user_id,(u.picture IS NOT NULL) other_has_picture,(SELECT content FROM messages WHERE conversation_id=c.id AND deleted_at IS NULL ORDER BY sent_at DESC LIMIT 1) last_message FROM conversations c JOIN conversation_members mine ON mine.conversation_id=c.id AND mine.user_id=$1 JOIN conversation_members other ON other.conversation_id=c.id AND other.user_id<>$1 JOIN users u ON u.id=other.user_id WHERE (SELECT count(*) FROM conversation_members WHERE conversation_id=c.id)=2 ORDER BY c.updated_at DESC LIMIT 100`, [req.user.sub])).rows;
});
export const createMessages = run(async req => {
  const other = uuid(req.body.user_id);
  if (other === req.user.sub) throw new ApiError(422, "Choose another person");
  await one(`SELECT id FROM users WHERE id=$1 AND account_status='active'`, [other]);
  return tx(async db => {
    await db.query("SELECT pg_advisory_xact_lock(hashtext($1))", [[other, req.user.sub].sort().join(":")]);
    const found = await db.query(`SELECT a.conversation_id id FROM conversation_members a JOIN conversation_members b ON b.conversation_id=a.conversation_id WHERE a.user_id=$1 AND b.user_id=$2 AND (SELECT count(*) FROM conversation_members WHERE conversation_id=a.conversation_id)=2 LIMIT 1`, [req.user.sub, other]);
    if (found.rowCount) return found.rows[0];
    const c = (await db.query("INSERT INTO conversations DEFAULT VALUES RETURNING id")).rows[0];
    await db.query("INSERT INTO conversation_members(conversation_id,user_id) VALUES($1,$2),($1,$3)", [c.id, req.user.sub, other]);
    return c;
  });
});
export const getMessagesById = run(async req => {
  await conversationAccess(req);
  await query("UPDATE conversation_members SET last_read_at=now() WHERE conversation_id=$1 AND user_id=$2", [req.params.id, req.user.sub]);
  return (await query(`SELECT * FROM(SELECT id,sender_id,content,sent_at FROM messages WHERE conversation_id=$1 AND deleted_at IS NULL ORDER BY sent_at DESC LIMIT 100) latest ORDER BY sent_at`, [req.params.id])).rows;
});
export const createMessagesById = run(async req => {
  await conversationAccess(req);
  const message = await tx(async db => {
    const m = (await db.query("INSERT INTO messages(conversation_id,sender_id,content) VALUES($1,$2,$3) RETURNING id,sender_id,content,sent_at", [req.params.id, req.user.sub, text(req.body.content)])).rows[0];
    await db.query("UPDATE conversations SET updated_at=now() WHERE id=$1", [req.params.id]);
    return m;
  });
  const members = (await query("SELECT user_id FROM conversation_members WHERE conversation_id=$1", [req.params.id])).rows.map(row => row.user_id);
  const sender = (await query("SELECT name,(picture IS NOT NULL) has_picture FROM users WHERE id=$1", [req.user.sub])).rows[0];
  emit(members.map(userRoom), "message:new", {
    conversation_id: req.params.id,
    message,
    sender_name: sender?.name,
    sender_has_picture: Boolean(sender?.has_picture)
  });
  return message;
});
