import { run } from "../middleware/response.middleware.js";
import { one } from "../services/shared.service.js";
import { accountPassword } from "../validators/account.validators.js";
import { ApiError, tx, query } from "@uddeepto/common";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { z } from "zod";
export const createAccountPassword = run(async req => {
  const body = z.object({
    currentPassword: accountPassword,
    newPassword: z.string().min(8, "Use at least 8 characters").max(128)
  }).strict().parse(req.body);
  const me = await one("SELECT password_hash FROM users WHERE id=$1", [req.user.sub]);
  // 403 (not 401): a 401 would make the website think the session expired and try to refresh it.
  if (!(await bcrypt.compare(body.currentPassword, me.password_hash))) throw new ApiError(403, "Your current password is not correct");
  if (body.currentPassword === body.newPassword) throw new ApiError(422, "Choose a new password that is different from the current one");
  const hash = await bcrypt.hash(body.newPassword, 12);
  await tx(async db => {
    await db.query("UPDATE users SET password_hash=$1,updated_at=now() WHERE id=$2", [hash, req.user.sub]);
    // Everywhere else the person has to sign in again with the new password.
    await db.query("UPDATE auth_refresh_tokens SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL", [req.user.sub]);
  });
  return {
    changed: true
  };
});
export const deleteAccount = run(async req => {
  const {
    password
  } = z.object({
    password: accountPassword
  }).strict().parse(req.body);
  const id = req.user.sub;
  const me = await one("SELECT role,password_hash FROM users WHERE id=$1", [id]);
  if (!(await bcrypt.compare(password, me.password_hash))) throw new ApiError(403, "Your password is not correct");
  if (me.role === "admin") {
    const others = (await query("SELECT count(*)::int n FROM users WHERE role='admin' AND account_status='active' AND id<>$1", [id])).rows[0].n;
    if (!others) throw new ApiError(409, "You are the only active administrator. Make someone else an admin before deleting this account.");
  }
  // Someone with no history is removed completely. Everyone else is referenced by records that have to stay
  // (course, job and contest owners, message senders ...), so the account is emptied instead: the name, contact
  // details, picture and CV are erased, the person can never sign in again and shows up as "Deleted user".
  try {
    await query("DELETE FROM users WHERE id=$1", [id]);
    return {
      deleted: true,
      anonymized: false
    };
  } catch (error) {
    if (!["23001", "23503"].includes(error.code)) throw error; // restrict or foreign-key violation: there is history to keep
  }
  const sealed = await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 4);
  await tx(async db => {
    await db.query(`UPDATE users SET name='Deleted user',email='deleted-'||replace(id::text,'-','')||'@deleted.invalid',
           username='deleted-'||substr(replace(id::text,'-',''),1,12),password_hash=$2,bio=NULL,headline=NULL,phone=NULL,
           birth_date=NULL,gender=NULL,current_address=NULL,permanent_address=NULL,picture=NULL,picture_mime_type=NULL,
           cover_image=NULL,cover_image_mime_type=NULL,email_verified_at=NULL,account_status='deactivated',updated_at=now()
         WHERE id=$1`, [id, sealed]);
    for (const table of ["user_education", "user_experiences", "user_interests", "user_cvs", "notifications", "auth_refresh_tokens"]) await db.query(`DELETE FROM ${table} WHERE user_id=$1`, [id]);
    await db.query("UPDATE showcase_posts SET deleted_at=now() WHERE creator_id=$1 AND deleted_at IS NULL", [id]);
    await db.query("UPDATE showcase_post_comments SET deleted_at=now() WHERE commenter_id=$1 AND deleted_at IS NULL", [id]);
    await db.query("UPDATE jobs SET status='closed' WHERE creator_id=$1 AND status IN('open','draft')", [id]);
  });
  return {
    deleted: true,
    anonymized: true
  };
});
