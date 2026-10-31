import { createAdminInstructors, updateAdminInstructorsById, deleteAdminInstructorsById, getAdminSettings, updateAdminSettings, getAdminOverview, getAdminByTable, createAdminUsers, createAdminByTableBulk, createAdminByTable, updateAdminByTableById, deleteAdminByTableById } from "../controllers/admin.controller.js";
import { upload } from "@uddeepto/common";
export function registerAdminRoutes(router) {
  router.post("/admin/instructors", upload.single("image"), createAdminInstructors);
  router.patch("/admin/instructors/:id", upload.single("image"), updateAdminInstructorsById);
  router.delete("/admin/instructors/:id", deleteAdminInstructorsById);
  router.get("/admin/settings", getAdminSettings);
  router.patch("/admin/settings", updateAdminSettings);
  router.get("/admin/overview", getAdminOverview);
  router.get("/admin/:table", getAdminByTable);
  router.post("/admin/users", createAdminUsers);
  router.post("/admin/:table/bulk", createAdminByTableBulk);
  router.post("/admin/:table", upload.single("cover_image"), createAdminByTable);
  router.patch("/admin/:table/:id", upload.single("cover_image"), updateAdminByTableById);
  router.delete("/admin/:table/:id", deleteAdminByTableById);
}
