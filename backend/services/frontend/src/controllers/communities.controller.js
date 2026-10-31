import { learner } from "../middleware/permissions.middleware.js";
import { run } from "../middleware/response.middleware.js";
import { communityAccess, requireMember, reactionKinds } from "../services/communities.service.js";
import { saveCategories, paging, catDetailsSql, one, uuid } from "../services/shared.service.js";
import { tx, ApiError, query, leaveRoom, notify, emit } from "@uddeepto/common";
import { z } from "zod";
export const createCommunities = run(async req => {
  learner(req);
  const b = z.object({
    name: z.string().trim().min(2).max(150),
    slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
    description: z.string().max(10000),
    category_ids: z.array(z.string().uuid()).min(1).max(20),
    requires_approval: z.boolean(),
    is_private: z.boolean()
  }).parse(req.body);
  const categories = [...new Set(b.category_ids)];
  return tx(async db => {
    if ((await db.query("SELECT id FROM interest_categories WHERE id=ANY($1::uuid[])", [categories])).rowCount !== categories.length) throw new ApiError(422, "One or more interests no longer exist");
    const c = (await db.query("INSERT INTO communities(creator_id,name,slug,description,category_id,requires_approval,is_private) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id", [req.user.sub, b.name, b.slug, b.description, categories[0], b.requires_approval, b.is_private])).rows[0];
    await saveCategories(db, "communities", c.id, categories);
    await db.query(`INSERT INTO community_members(community_id,member_id,status,is_moderator,approved_at,approved_by) VALUES($1,$2,'approved',true,now(),$2)`, [c.id, req.user.sub]);
    await db.query(`INSERT INTO community_chats(community_id,name) VALUES($1,'general')`, [c.id]);
    return c;
  });
});
export const getCommunitiesMine = run(async req => {
  learner(req);
  const [limit, offset] = paging(req);
  return (await query(`SELECT c.id,c.name,c.description,c.is_private,c.requires_approval,${catDetailsSql("communities", "c")} category_details,(SELECT count(*) FROM community_members WHERE community_id=c.id AND status='approved') member_count,(SELECT count(*) FROM community_chats WHERE community_id=c.id) channel_count,CASE WHEN c.creator_id=$1 THEN 'owner' WHEN m.is_moderator THEN 'moderator' ELSE 'member' END role,coalesce(m.approved_at,c.created_at) joined_at FROM communities c LEFT JOIN community_members m ON m.community_id=c.id AND m.member_id=$1 WHERE(m.status='approved' OR c.creator_id=$1) AND(c.name ILIKE $2 OR c.description ILIKE $2) ORDER BY coalesce(m.approved_at,c.created_at) DESC LIMIT $3 OFFSET $4`, [req.user.sub, `%${String(req.query.q || "").slice(0, 200)}%`, limit, offset])).rows;
});
export const getCommunitiesById = run(async req => {
  learner(req);
  const c = await communityAccess(req);
  const info = await one(`SELECT c.id,c.name,c.description,c.is_private,c.requires_approval,c.created_at,u.name creator_name,${catDetailsSql("communities", "c")} category_details,(SELECT count(*) FROM community_members WHERE community_id=c.id AND status='approved') member_count FROM communities c JOIN users u ON u.id=c.creator_id WHERE c.id=$1`, [c.id]);
  const member = c.membership === "approved";
  const role = c.creator_id === req.user.sub ? "owner" : member && c.is_moderator ? "moderator" : member ? req.user.role === "admin" ? "admin" : "member" : null;
  return {
    ...info,
    membership: c.membership,
    role,
    can_manage: c.can_manage,
    chats: member ? (await query("SELECT id,name,description FROM community_chats WHERE community_id=$1 ORDER BY sort_order,created_at", [c.id])).rows : [],
    pending: c.can_manage ? (await query(`SELECT m.member_id,u.name,u.username,m.requested_at FROM community_members m JOIN users u ON u.id=m.member_id WHERE community_id=$1 AND status='pending' ORDER BY m.requested_at LIMIT 100`, [c.id])).rows : []
  };
});
export const getCommunitiesByIdMembers = run(async req => {
  learner(req);
  const c = await requireMember(req);
  return (await query(`SELECT u.id,u.name,u.username,(u.picture IS NOT NULL) has_picture,(u.id=$2) is_owner,m.is_moderator FROM community_members m JOIN users u ON u.id=m.member_id WHERE m.community_id=$1 AND m.status='approved' ORDER BY (u.id=$2) DESC,m.is_moderator DESC,u.name LIMIT 300`, [c.id, c.creator_id])).rows;
});
export const deleteCommunitiesByIdMembership = run(async req => {
  learner(req);
  const c = await communityAccess(req);
  if (c.creator_id === req.user.sub) throw new ApiError(409, "The owner cannot leave their own community");
  await query("DELETE FROM community_members WHERE community_id=$1 AND member_id=$2", [c.id, req.user.sub]);
  leaveRoom(req.user.sub, `community:${c.id}`);
});
export const updateCommunitiesByIdMembersByUserId = run(async req => {
  learner(req);
  const c = await communityAccess(req);
  if (!c.can_manage) throw new ApiError(403, "Moderator required");
  const status = z.enum(["approved", "rejected", "blocked"]).parse(req.body.status);
  const memberId = uuid(req.params.userId);
  const updated = await query(`UPDATE community_members SET status=$1::membership_status,approved_at=CASE WHEN $5 THEN now() ELSE NULL END,approved_by=$2 WHERE community_id=$3 AND member_id=$4`, [status, req.user.sub, c.id, memberId, status === "approved"]);
  if (updated.rowCount && status !== "approved") leaveRoom(memberId, `community:${c.id}`);
  if (updated.rowCount) await notify({
    to: memberId,
    actor: req.user.sub,
    type: "community_membership",
    title: status === "approved" ? `Your request to join ${c.name} was approved` : status === "rejected" ? `Your request to join ${c.name} was declined` : `Your access to ${c.name} was restricted`,
    body: status === "approved" ? "You can now read and post in its channels." : null,
    link: status === "approved" ? `/communities/${c.id}` : "/communities",
    entity: ["community", c.id],
    key: `membership:${c.id}:${memberId}:${status}`
  });
});
export const createCommunitiesByIdChats = run(async req => {
  learner(req);
  const c = await communityAccess(req);
  if (!c.can_manage) throw new ApiError(403, "Moderator required");
  const b = z.object({
    name: z.string().trim().min(1).max(150),
    description: z.string().trim().max(500).optional()
  }).parse(req.body);
  const created = (await query("INSERT INTO community_chats(community_id,name,description,sort_order) VALUES($1,$2,$3,(SELECT coalesce(max(sort_order),-1)+1 FROM community_chats WHERE community_id=$1)) RETURNING id", [c.id, b.name, b.description || null])).rows[0];
  emit(`community:${c.id}`, "community:chat_created", {
    community_id: c.id
  });
  return created;
});
export const getCommunitiesByIdChatsByChatId = run(async req => {
  learner(req);
  const c = await requireMember(req);
  const chatId = uuid(req.params.chatId);
  await one("SELECT 1 FROM community_chats WHERE id=$1 AND community_id=$2", [chatId, c.id]);
  return (await query(`SELECT * FROM(SELECT m.id,m.sender_id,m.content,m.created_at,u.name sender_name,(u.picture IS NOT NULL) sender_has_picture,coalesce((SELECT json_agg(json_build_object('reaction',r.reaction,'count',r.n,'mine',r.mine) ORDER BY r.first_at) FROM(SELECT reaction::text reaction,count(*) n,bool_or(user_id=$3) mine,min(created_at) first_at FROM community_chat_message_reactions WHERE message_id=m.id GROUP BY reaction) r),'[]'::json) reactions FROM community_chat_messages m JOIN users u ON u.id=m.sender_id WHERE m.community_id=$1 AND m.chat_id=$2 AND m.deleted_at IS NULL ORDER BY m.created_at DESC LIMIT 200) recent ORDER BY created_at`, [c.id, chatId, req.user.sub])).rows;
});
export const createCommunitiesByIdChatsByChatId = run(async req => {
  learner(req);
  const c = await requireMember(req);
  const content = z.string().trim().min(1).max(4000).parse(req.body.content);
  const chatId = uuid(req.params.chatId);
  const created = (await query("INSERT INTO community_chat_messages(community_id,chat_id,sender_id,content) VALUES($1,$2,$3,$4) RETURNING id,sender_id,content,created_at", [c.id, chatId, req.user.sub, content])).rows[0];
  const sender = (await query("SELECT name,(picture IS NOT NULL) has_picture FROM users WHERE id=$1", [req.user.sub])).rows[0];
  const message = {
    ...created,
    sender_name: sender?.name,
    sender_has_picture: Boolean(sender?.has_picture),
    reactions: []
  };
  emit(`community:${c.id}`, "community:message", {
    community_id: c.id,
    chat_id: chatId,
    message
  });
  return message;
});
export const putCommunitiesByIdChatsByChatIdMessagesByMessageIdReaction = run(async req => {
  learner(req);
  const c = await requireMember(req);
  const reaction = z.enum(reactionKinds).parse(req.body.reaction);
  const messageId = uuid(req.params.messageId);
  await one("SELECT 1 FROM community_chat_messages WHERE id=$1 AND community_id=$2 AND chat_id=$3 AND deleted_at IS NULL", [messageId, c.id, uuid(req.params.chatId)]);
  let added = false;
  await tx(async db => {
    await db.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`chat-reaction:${messageId}:${req.user.sub}`]);
    const removed = await db.query("DELETE FROM community_chat_message_reactions WHERE message_id=$1 AND user_id=$2 AND reaction=$3", [messageId, req.user.sub, reaction]);
    if (!removed.rowCount) {
      await db.query("INSERT INTO community_chat_message_reactions(message_id,user_id,reaction) VALUES($1,$2,$3)", [messageId, req.user.sub, reaction]);
      added = true;
    }
  });
  emit(`community:${c.id}`, "community:reaction", {
    community_id: c.id,
    chat_id: req.params.chatId,
    message_id: messageId,
    user_id: req.user.sub,
    reaction,
    added
  });
});
export const deleteCommunitiesByIdChatsByChatIdMessagesByMessageId = run(async req => {
  learner(req);
  const c = await requireMember(req);
  const m = await one("SELECT sender_id FROM community_chat_messages WHERE id=$1 AND community_id=$2 AND chat_id=$3 AND deleted_at IS NULL", [uuid(req.params.messageId), c.id, uuid(req.params.chatId)]);
  if (m.sender_id !== req.user.sub && !c.can_manage) throw new ApiError(403, "You can only delete your own messages");
  await query("UPDATE community_chat_messages SET deleted_at=now() WHERE id=$1", [req.params.messageId]);
  emit(`community:${c.id}`, "community:message_deleted", {
    community_id: c.id,
    chat_id: req.params.chatId,
    message_id: req.params.messageId
  });
});
