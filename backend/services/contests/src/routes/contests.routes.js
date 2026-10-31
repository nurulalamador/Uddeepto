import { joinContest, listContestProblems, createContestProblem, submitContestEntry, getContestLeaderboard } from "../controllers/contests.controller.js";
import { auth, resourceRouter } from "@uddeepto/common";
import express from "express";
const router = express.Router();
router.post("/:id/join", auth(), joinContest);
router.get("/:id/problems", auth(false), listContestProblems);
router.post("/:id/problems", auth(), createContestProblem);
router.post("/:id/submissions", auth(), submitContestEntry);
router.get("/:id/leaderboard", getContestLeaderboard);
router.use("/", resourceRouter({
  table: "contests",
  fields: ["name", "description", "category_id", "type", "entry_fee", "currency", "status", "max_participants", "starting_time", "ending_time"],
  required: ["name", "description", "category_id", "starting_time", "ending_time"],
  createRoles: ["admin"],
  search: ["name", "description"],
  adminOnlyFields: ["status"]
}));
export default router;
