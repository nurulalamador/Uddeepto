import { createAiChat, createAiInterests } from "../controllers/ai.controller.js";
export function registerAiRoutes(router) {
  router.post("/ai/chat", createAiChat);
  router.post('/ai/interests', createAiInterests);
}
