import { getCv, getCvFile, putCv, deleteCv } from "../controllers/cv.controller.js";
import { upload } from "@uddeepto/common";
export function registerCvRoutes(router) {
  router.get("/cv", getCv);
  router.get("/cv/file", getCvFile);
  router.put("/cv", upload.single("file"), putCv);
  router.delete("/cv", deleteCv);
}
