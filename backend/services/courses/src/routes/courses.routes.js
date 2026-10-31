import { listMaterials, addMaterial, getMaterialContent, enrollInCourse, listMyEnrollments } from "../controllers/courses.controller.js";
import { auth, upload, resourceRouter } from "@uddeepto/common";
import express from "express";
const router = express.Router();
router.get("/:id/materials", auth(false), listMaterials);
router.post("/:id/materials", auth(), upload.single("file"), addMaterial);
router.get("/:courseId/materials/:materialId/content", auth(false), getMaterialContent);
router.post("/:id/enroll", auth(), enrollInCourse);
router.get("/me/enrollments", auth(), listMyEnrollments);
router.use("/", resourceRouter({
  table: "courses",
  fields: ["title", "slug", "description", "price", "currency", "category_id", "instructor_id", "status", "published_at"],
  required: ["title", "slug", "description", "category_id", "instructor_id"],
  createRoles: ["admin"],
  adminOnlyWrites: true,
  search: ["title", "description"],
  adminOnlyFields: ["status", "published_at"]
}));
export default router;
