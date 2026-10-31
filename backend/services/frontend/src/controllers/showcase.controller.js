import { run } from "../middleware/response.middleware.js";
import { paging, uuid, one, text, decodeName, postRemoved, snippet } from "../services/shared.service.js";
import { showcaseProjection, showcaseFrom, visiblePost, toggleReaction, nameOf } from "../services/showcase.service.js";
import { query, ApiError, optimizeUpload, tx, notify, unnotify } from "@uddeepto/common";
export const getShowcase = run(async req => {
  const [limit, offset] = paging(req);
  return (await query(`SELECT ${showcaseProjection} ${showcaseFrom} WHERE p.deleted_at IS NULL AND p.visibility='public' AND p.content ILIKE $2 AND($3::uuid IS NULL OR p.category_id=$3) ORDER BY p.created_at DESC LIMIT $4 OFFSET $5`, [req.user.sub, `%${String(req.query.q || "").slice(0, 200)}%`, req.query.category ? uuid(req.query.category) : null, limit, offset])).rows;
});
export const getShowcaseById = run(async req => one(`SELECT ${showcaseProjection} ${showcaseFrom} WHERE p.id=$2 AND p.deleted_at IS NULL AND p.visibility='public'`, [req.user.sub, uuid(req.params.id)]));
export const getShowcaseByIdMediaByMediaId = run(async (req, res) => {
  const media = await one("SELECT mime_type,media_blob,file_name FROM showcase_post_media m JOIN showcase_posts p ON p.id=m.post_id WHERE m.id=$1 AND m.post_id=$2 AND p.deleted_at IS NULL AND p.visibility='public'", [uuid(req.params.mediaId), uuid(req.params.id)]);
  if (!media) throw new ApiError(404, "Media not found");
  res.set({
    "Content-Type": media.mime_type,
    "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(String(media.file_name || "media"))}`,
    "Cache-Control": "private, max-age=300",
    "X-Content-Type-Options": "nosniff"
  }).send(Buffer.from(media.media_blob));
});
export const createShowcase = run(async req => {
  const files = req.files || [];
  if (files.some(file => !["image", "audio", "video"].includes(file.mimetype.split("/")[0]))) throw new ApiError(422, "Only image, audio, and video files are allowed");
  for (const file of files) await optimizeUpload(file, "post");
  return tx(async db => {
    const post = (await db.query("INSERT INTO showcase_posts(creator_id,category_id,content,visibility) VALUES($1,$2,$3,$4) RETURNING *", [req.user.sub, req.body.category_id, text(req.body.content), req.body.visibility || "public"])).rows[0];
    for (const [index, file] of files.entries()) await db.query("INSERT INTO showcase_post_media(post_id,mime_type,media_blob,file_name,sort_order) VALUES($1,$2,$3,$4,$5)", [post.id, file.mimetype, file.buffer, decodeName(file.originalname).slice(0, 255), index]);
    return post;
  });
});
export const deleteShowcaseById = run(async req => {
  const r = await query("UPDATE showcase_posts SET deleted_at=now() WHERE id=$1 AND(creator_id=$2 OR $3='admin') RETURNING id,creator_id,content", [uuid(req.params.id), req.user.sub, req.user.role]);
  if (!r.rowCount) throw new ApiError(403, "Not your post");
  await postRemoved(r.rows, req.user.sub);
});
export const putShowcaseByIdReaction = run(async req => {
  const post = await visiblePost(req.params.id);
  const added = await toggleReaction("showcase_post_reactions", "post_id", req.params.id, req.user.sub);
  const key = `like:post:${post.id}:${req.user.sub}`;
  if (added) await notify({
    to: post.creator_id,
    actor: req.user.sub,
    type: "post_like",
    title: `${await nameOf(req.user.sub)} liked your post`,
    body: snippet(post.content),
    link: `/showcase/${post.id}`,
    entity: ["showcase_post", post.id],
    key
  });else await unnotify(post.creator_id, key);
});
export const getShowcaseByIdComments = run(async req => {
  await visiblePost(req.params.id);
  return (await query(`SELECT c.id,c.commenter_id,c.content,u.name,(u.picture IS NOT NULL) commenter_has_picture,(SELECT count(*) FROM showcase_post_comment_reactions WHERE comment_id=c.id) reactions,EXISTS(SELECT 1 FROM showcase_post_comment_reactions WHERE comment_id=c.id AND user_id=$2 AND reaction='love') my_reaction FROM showcase_post_comments c JOIN users u ON u.id=c.commenter_id WHERE c.post_id=$1 AND c.deleted_at IS NULL ORDER BY c.created_at LIMIT 100`, [req.params.id, req.user.sub])).rows;
});
export const createShowcaseByIdComments = run(async req => {
  const post = await visiblePost(req.params.id);
  const content = text(req.body.content);
  const comment = (await query("INSERT INTO showcase_post_comments(post_id,commenter_id,content) VALUES($1,$2,$3) RETURNING id", [req.params.id, req.user.sub, content])).rows[0];
  await notify({
    to: post.creator_id,
    actor: req.user.sub,
    type: "post_comment",
    title: `${await nameOf(req.user.sub)} commented on your post`,
    body: snippet(content),
    link: `/showcase/${post.id}#comments`,
    entity: ["showcase_post_comment", comment.id],
    key: `comment:${comment.id}`
  });
  return comment;
});
export const putCommentsByIdReaction = run(async req => {
  const c = await one("SELECT post_id,commenter_id,content FROM showcase_post_comments WHERE id=$1 AND deleted_at IS NULL", [uuid(req.params.id)]);
  await visiblePost(c.post_id);
  const added = await toggleReaction("showcase_post_comment_reactions", "comment_id", req.params.id, req.user.sub);
  const key = `like:comment:${req.params.id}:${req.user.sub}`;
  if (added) await notify({
    to: c.commenter_id,
    actor: req.user.sub,
    type: "comment_like",
    title: `${await nameOf(req.user.sub)} liked your comment`,
    body: snippet(c.content),
    link: `/showcase/${c.post_id}#comments`,
    entity: ["showcase_post_comment", req.params.id],
    key
  });else await unnotify(c.commenter_id, key);
});
