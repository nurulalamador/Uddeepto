import { one, uuid } from "./shared.service.js";
export async function conversationAccess(req) {
  await one("SELECT 1 FROM conversation_members WHERE conversation_id=$1 AND user_id=$2", [uuid(req.params.id), req.user.sub]);
}
