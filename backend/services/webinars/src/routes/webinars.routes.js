import { listMyRegistrations, registerForWebinar } from "../controllers/webinars.controller.js";
import { auth, resourceRouter } from "@uddeepto/common";
import express from "express";
const router = express.Router();
router.get("/me/registrations", auth(), listMyRegistrations);
router.use("/", resourceRouter({
  table: "webinars",
  fields: ["name", "description", "category_id", "meeting_url", "capacity", "status", "starting_time", "ending_time"],
  required: ["name", "description", "category_id", "starting_time", "ending_time"],
  createRoles: ["admin"],
  search: ["name", "description"],
  adminOnlyFields: ["status"]
}));
router.post("/:id/register", auth(), registerForWebinar);
export default router;
