import { listShowcasePosts, createShowcasePost, createShowcaseComment, addShowcaseReaction, reportShowcasePost, joinCommunity, createCommunityChat, listCommunityMessages, sendCommunityMessage } from "../controllers/community.controller.js";
import { auth, resourceRouter } from "@uddeepto/common";
import express from "express";
const router = express.Router();
router.get("/showcase", auth(false), listShowcasePosts);
router.post("/showcase", auth(), createShowcasePost);
router.post("/showcase/:id/comments", auth(), createShowcaseComment);
router.put("/showcase/:id/reactions/:reaction", auth(), addShowcaseReaction);
router.post("/showcase/:id/report", auth(), reportShowcasePost);
router.post("/:id/join", auth(), joinCommunity);
router.post("/:id/chats", auth(), createCommunityChat);
router.get("/:id/chats/:chatId/messages", auth(), listCommunityMessages);
router.post("/:id/chats/:chatId/messages", auth(), sendCommunityMessage);
router.use("/", resourceRouter({
  table: "communities",
  fields: ["name", "slug", "description", "category_id", "requires_approval", "is_private"],
  required: ["name", "slug", "category_id"],
  search: ["name", "description"]
}));
export default router;
