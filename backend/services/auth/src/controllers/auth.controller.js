import { issue, hash } from "../services/auth.service.js";
import { asyncHandler, platformSetting, ApiError, tx, publicUser, notify, notifyAdmins, query, verifyRefresh } from "@uddeepto/common";
import bcrypt from "bcryptjs";
export const register = asyncHandler(async (req, res) => {
  if (!(await platformSetting("registration_open", true))) throw new ApiError(403, "Public registration is currently paused. Contact an administrator.");
  const hash = await bcrypt.hash(req.body.password, 12);
  const u = await tx(async c => (await c.query(`INSERT INTO users(name,email,username,password_hash,role) VALUES($1,$2,$3,$4,$5) RETURNING ${publicUser}`, [req.body.name, req.body.email, req.body.username, hash, req.body.role])).rows[0]);
  const tokens = await issue(u);
  await notify({
    to: u.id,
    type: "welcome",
    title: `Welcome to Uddeepto, ${u.name.split(" ")[0]}!`,
    body: u.role === "hirer" ? "Post your first job and start finding talent." : "Pick your interests, join a course or a contest, and start growing your skills.",
    link: "/dashboard",
    key: "welcome"
  });
  if (u.role === "hirer") await notifyAdmins({
    actor: u.id,
    type: "hirer_registered",
    title: `New hirer registered: ${u.name}`,
    body: `@${u.username}`,
    link: "/admin",
    entity: ["user", u.id],
    key: `hirer:${u.id}`
  });
  res.status(201).json({
    user: u,
    ...tokens
  });
});
export const login = asyncHandler(async (req, res) => {
  const r = await query(`SELECT * FROM users WHERE email=$1 OR username=$1`, [req.body.identifier]);
  const u = r.rows[0];
  if (!u || !(await bcrypt.compare(req.body.password, u.password_hash))) throw new ApiError(401, "Invalid credentials");
  if (u.account_status !== "active") throw new ApiError(403, `Account is ${u.account_status}`);
  await query("UPDATE users SET last_login_at=now() WHERE id=$1", [u.id]);
  const safe = Object.fromEntries(Object.entries(u).filter(([k]) => !["password_hash", "picture"].includes(k)));
  res.json({
    user: safe,
    ...(await issue(u))
  });
});
export const refresh = asyncHandler(async (req, res) => {
  let p;
  try {
    p = verifyRefresh(req.body.refreshToken);
  } catch {
    throw new ApiError(401, "Invalid or expired refresh token");
  }
  const h = hash(req.body.refreshToken);
  const r = await query(`SELECT u.* FROM auth_refresh_tokens t JOIN users u ON u.id=t.user_id WHERE t.token_hash=$1 AND t.revoked_at IS NULL AND t.expires_at>now()`, [h]);
  if (!r.rowCount || r.rows[0].account_status !== "active") throw new ApiError(401, "Refresh token revoked or account inactive");
  const consumed = await query("UPDATE auth_refresh_tokens SET revoked_at=now() WHERE token_hash=$1 AND revoked_at IS NULL RETURNING id", [h]);
  if (!consumed.rowCount) throw new ApiError(401, "Refresh token already used");
  res.json(await issue(r.rows[0]));
});
export const logout = asyncHandler(async (req, res) => {
  await query("UPDATE auth_refresh_tokens SET revoked_at=now() WHERE token_hash=$1", [hash(req.body.refreshToken)]);
  res.status(204).end();
});
export const logoutAll = asyncHandler(async (req, res) => {
  await query("UPDATE auth_refresh_tokens SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL", [req.user.sub]);
  res.status(204).end();
});
export const changePassword = asyncHandler(async (req, res) => {
  const u = (await query("SELECT password_hash FROM users WHERE id=$1", [req.user.sub])).rows[0];
  if (!u || !(await bcrypt.compare(req.body.currentPassword, u.password_hash))) throw new ApiError(401, "Current password is incorrect");
  await tx(async c => {
    await c.query("UPDATE users SET password_hash=$1 WHERE id=$2", [await bcrypt.hash(req.body.newPassword, 12), req.user.sub]);
    await c.query("UPDATE auth_refresh_tokens SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL", [req.user.sub]);
  });
  res.status(204).end();
});
