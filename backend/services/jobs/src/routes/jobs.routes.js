import { listMyApplications, applyForJob, updateApplicationStatus } from "../controllers/jobs.controller.js";
import { normalizeJobLocation, observeJobCreation } from "../middleware/jobs.middleware.js";
import { auth, resourceRouter, upload } from "@uddeepto/common";
import express from "express";
const router = express.Router();
router.get("/me/applications", auth(), listMyApplications);
router.use("/", normalizeJobLocation);
router.post("/", observeJobCreation);
router.use("/", resourceRouter({
  table: "jobs",
  fields: ["category_id", "title", "description", "salary_min", "salary_max", "currency", "salary_period", "location", "latitude", "longitude", "criteria", "type", "is_remote", "status", "application_deadline"],
  required: ["title", "description", "type"],
  createRoles: ["hirer", "admin"],
  search: ["title", "description"],
  adminOnlyFields: ["status"]
}));
router.post("/:id/apply", auth(), upload.single("resume"), applyForJob);
router.patch("/:jobId/applications/:userId", auth(), updateApplicationStatus);
export default router;
