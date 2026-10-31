import { createCommunities, getCommunitiesMine, getCommunitiesById, getCommunitiesByIdMembers, deleteCommunitiesByIdMembership, updateCommunitiesByIdMembersByUserId, createCommunitiesByIdChats, getCommunitiesByIdChatsByChatId, createCommunitiesByIdChatsByChatId, putCommunitiesByIdChatsByChatIdMessagesByMessageIdReaction, deleteCommunitiesByIdChatsByChatIdMessagesByMessageId } from "../controllers/communities.controller.js";
export function registerCommunitiesRoutes(router) {
  router.post("/communities", createCommunities);
  router.get("/communities/mine", getCommunitiesMine);
  router.get("/communities/:id", getCommunitiesById);
  router.get("/communities/:id/members", getCommunitiesByIdMembers);
  router.delete("/communities/:id/membership", deleteCommunitiesByIdMembership);
  router.patch("/communities/:id/members/:userId", updateCommunitiesByIdMembersByUserId);
  router.post("/communities/:id/chats", createCommunitiesByIdChats);
  router.get("/communities/:id/chats/:chatId", getCommunitiesByIdChatsByChatId);
  router.post("/communities/:id/chats/:chatId", createCommunitiesByIdChatsByChatId);
  router.put("/communities/:id/chats/:chatId/messages/:messageId/reaction", putCommunitiesByIdChatsByChatIdMessagesByMessageIdReaction);
  router.delete("/communities/:id/chats/:chatId/messages/:messageId", deleteCommunitiesByIdChatsByChatIdMessagesByMessageId);
}
