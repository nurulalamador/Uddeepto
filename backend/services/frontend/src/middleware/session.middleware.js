import { asyncHandler, query, ApiError } from "@uddeepto/common";
export const requireActiveAccount = asyncHandler(async (req, _res, next) => {
  const u = (await query("SELECT id,role,account_status FROM users WHERE id=$1", [req.user.sub])).rows[0];
  if (!u || u.account_status !== "active") throw new ApiError(401, "Account is not active");
  req.user.role = u.role;
  next();
});
