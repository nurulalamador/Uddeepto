import { one, uuid } from "./shared.service.js";
import { ApiError } from "@uddeepto/common";
export async function communityAccess(req) {
  const c = await one(`SELECT c.*,m.status membership,m.is_moderator FROM communities c LEFT JOIN community_members m ON m.community_id=c.id AND m.member_id=$2 WHERE c.id=$1`, [uuid(req.params.id), req.user.sub]);
  c.can_manage = c.creator_id === req.user.sub || req.user.role === "admin" || c.membership === "approved" && c.is_moderator;
  if (c.creator_id === req.user.sub || req.user.role === "admin") c.membership = "approved";
  return c;
}
export async function requireMember(req) {
  const c = await communityAccess(req);
  if (c.membership !== "approved") throw new ApiError(403, "Approved membership required");
  return c;
}
export const reactionKinds = ["like", "love", "celebrate", "insightful", "curious"];
