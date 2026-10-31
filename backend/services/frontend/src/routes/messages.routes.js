import { getMessages, createMessages, getMessagesById, createMessagesById } from "../controllers/messages.controller.js";
export function registerMessagesRoutes(router) {
  router.get("/messages", getMessages);
  router.post("/messages", createMessages);
  router.get("/messages/:id", getMessagesById);
  router.post("/messages/:id", createMessagesById);
}
