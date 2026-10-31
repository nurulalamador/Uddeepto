import { getCourseCoversById, putCoursesByIdCompleteByMaterialId, getManageCoursesByIdMaterials, createManageCoursesByIdMaterials, deleteManageCoursesByIdMaterialsByMaterialId, getCoursesByIdMaterialsByMaterialIdContent, getCoursesByIdMaterialsByMaterialIdFile, getCoursesById, createCoursesByIdMaterialsByMaterialIdAi, getCoursesByIdMaterialsByMaterialIdQuizByCheckpoint, createCoursesByIdMaterialsByMaterialIdQuizByCheckpoint } from "../controllers/courses.controller.js";
import { adminOnly } from "../middleware/uploads.middleware.js";
import { materialUpload } from "../services/courses.service.js";
export function registerCoursesRoutes(router) {
  router.get("/course-covers/:id", getCourseCoversById);
  router.put("/courses/:id/complete/:materialId", putCoursesByIdCompleteByMaterialId);
  router.get("/manage/courses/:id/materials", getManageCoursesByIdMaterials);
  router.post("/manage/courses/:id/materials", adminOnly, materialUpload.single("file"), createManageCoursesByIdMaterials);
  router.delete("/manage/courses/:id/materials/:materialId", deleteManageCoursesByIdMaterialsByMaterialId);
  router.get("/courses/:id/materials/:materialId/content", getCoursesByIdMaterialsByMaterialIdContent);
  router.get("/courses/:id/materials/:materialId/file", getCoursesByIdMaterialsByMaterialIdFile);
  router.get("/courses/:id", getCoursesById);
  router.post("/courses/:id/materials/:materialId/ai", createCoursesByIdMaterialsByMaterialIdAi);
  router.get("/courses/:id/materials/:materialId/quiz/:checkpoint", getCoursesByIdMaterialsByMaterialIdQuizByCheckpoint);
  router.post("/courses/:id/materials/:materialId/quiz/:checkpoint", createCoursesByIdMaterialsByMaterialIdQuizByCheckpoint);
}
