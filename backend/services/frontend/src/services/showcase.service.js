import { one, uuid } from "./shared.service.js";
import { query, tx } from "@uddeepto/common";
export const nameOf = async id => (await query("SELECT name FROM users WHERE id=$1", [id])).rows[0]?.name || "Someone";
export const showcaseProjection = `p.id,p.creator_id,p.content,p.created_at,u.name creator_name,(u.picture IS NOT NULL) creator_has_picture,u.role::text creator_role,i.name category_name,(SELECT count(*) FROM showcase_post_reactions WHERE post_id=p.id) reactions,(SELECT count(*) FROM showcase_post_comments WHERE post_id=p.id AND deleted_at IS NULL) comments,EXISTS(SELECT 1 FROM showcase_post_reactions WHERE post_id=p.id AND user_id=$1 AND reaction='love') my_reaction,COALESCE((SELECT json_agg(json_build_object('id',m.id,'mime_type',m.mime_type,'file_name',m.file_name) ORDER BY m.sort_order) FROM showcase_post_media m WHERE m.post_id=p.id),'[]'::json) media`;
export const showcaseFrom = "FROM showcase_posts p JOIN users u ON u.id=p.creator_id JOIN interest_categories i ON i.id=p.category_id";
export async function visiblePost(id) {
  return one(`SELECT id,creator_id,content FROM showcase_posts WHERE id=$1 AND visibility='public' AND deleted_at IS NULL`, [uuid(id)]);
}
export async function toggleReaction(table, field, id, user) {
  let added = false;
  await tx(async db => {
    await db.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`${table}:${id}:${user}`]);
    const removed = await db.query(`DELETE FROM ${table} WHERE ${field}=$1 AND user_id=$2 AND reaction='love'`, [id, user]);
    if (!removed.rowCount) {
      await db.query(`INSERT INTO ${table}(${field},user_id,reaction) VALUES($1,$2,'love')`, [id, user]);
      added = true;
    }
  });
  return added;
}
