import { signAccess, signRefresh, verifyRefresh, query } from "@uddeepto/common";
import crypto from "node:crypto";
export async function issue(u) {
  const accessToken = signAccess(u),
    refreshToken = signRefresh(u);
  const p = verifyRefresh(refreshToken);
  await query("INSERT INTO auth_refresh_tokens(user_id,token_hash,expires_at) VALUES($1,$2,to_timestamp($3))", [u.id, hash(refreshToken), p.exp]);
  return {
    accessToken,
    refreshToken
  };
}
export const hash = s => crypto.createHash("sha256").update(s).digest("hex");
