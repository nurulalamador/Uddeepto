import { asyncHandler, query, publicUser, ApiError, updateRow, optimizeUpload, page } from "@uddeepto/common";
import { z } from "zod";
export const listInterests = asyncHandler(async (q, s) => s.json((await query("SELECT * FROM interest_categories WHERE is_active=true ORDER BY name")).rows));
export const createInterest = asyncHandler(async (q, s) => s.status(201).json((await query("INSERT INTO interest_categories(name,slug,icon,description) VALUES($1,$2,$3,$4) RETURNING *", [q.body.name, q.body.slug, q.body.icon, q.body.description])).rows[0]));
export const getCurrentUser = asyncHandler(async (q, s) => {
  const u = (await query(`SELECT ${publicUser} FROM users WHERE id=$1`, [q.user.sub])).rows[0];
  if (!u) throw new ApiError(404, "User not found");
  u.interests = (await query("SELECT i.* FROM interest_categories i JOIN user_interests ui ON ui.interest_id=i.id WHERE ui.user_id=$1", [q.user.sub])).rows;
  s.json(u);
});
export const updateCurrentUser = asyncHandler(async (q, s) => s.json(await updateRow("users", q.user.sub, q.body, ["name", "username", "bio"])));
export const updateProfilePicture = asyncHandler(async (q, s) => {
  if (!q.file) throw new ApiError(400, "picture file required");
  if (!q.file.mimetype.startsWith("image/")) throw new ApiError(422, "Use an image");
  await optimizeUpload(q.file, "avatar");
  await query("UPDATE users SET picture=$1,picture_mime_type=$2 WHERE id=$3", [q.file.buffer, q.file.mimetype, q.user.sub]);
  s.status(204).end();
});
export const getProfilePicture = asyncHandler(async (q, s) => {
  const x = (await query("SELECT picture,picture_mime_type FROM users WHERE id=$1", [q.params.id])).rows[0];
  if (!x?.picture) throw new ApiError(404, "Picture not found");
  s.type(x.picture_mime_type).send(x.picture);
});
export const updateUserInterests = asyncHandler(async (q, s) => {
  const ids = z.array(z.string().uuid()).max(30).parse(q.body.interestIds);
  await query("DELETE FROM user_interests WHERE user_id=$1", [q.user.sub]);
  for (const id of ids) await query("INSERT INTO user_interests(user_id,interest_id) VALUES($1,$2)", [q.user.sub, id]);
  s.json({
    interestIds: ids
  });
});
export const getUserById = asyncHandler(async (q, s) => {
  const u = (await query(`SELECT id,name,username,role,bio,created_at FROM users WHERE id=$1 AND account_status='active'`, [q.params.id])).rows[0];
  if (!u) throw new ApiError(404, "User not found");
  s.json(u);
});
export const listUsers = asyncHandler(async (q, s) => {
  const {
    limit,
    offset
  } = page(q);
  s.json((await query(`SELECT ${publicUser} FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2`, [limit, offset])).rows);
});
