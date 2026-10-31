import { getShowcase, getShowcaseById, getShowcaseByIdMediaByMediaId, createShowcase, deleteShowcaseById, putShowcaseByIdReaction, getShowcaseByIdComments, createShowcaseByIdComments, putCommentsByIdReaction } from "../controllers/showcase.controller.js";
import { auth, upload } from "@uddeepto/common";
export function registerShowcaseRoutes(router) {
  router.get("/showcase", getShowcase);
  router.get("/showcase/:id", getShowcaseById);
  router.get("/showcase/:id/media/:mediaId", auth(false), getShowcaseByIdMediaByMediaId);
  router.post("/showcase", auth(), upload.array("media", 10), createShowcase);
  router.delete("/showcase/:id", deleteShowcaseById);
  router.put("/showcase/:id/reaction", putShowcaseByIdReaction);
  router.get("/showcase/:id/comments", getShowcaseByIdComments);
  router.post("/showcase/:id/comments", createShowcaseByIdComments);
  router.put("/comments/:id/reaction", putCommentsByIdReaction);
}
