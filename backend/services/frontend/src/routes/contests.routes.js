import { createContestsByIdJoin, getContestsById, getContestsByIdParticipants, getContestsByIdParticipantsByUserIdSubmissions, createContestsByIdSubmit, getContestsByIdSubmissionsBySubmissionIdFile, getManageContestsByIdProblems, createManageContestsByIdProblems, getManageContestsByIdSubmissions, updateManageSubmissionsById } from "../controllers/contests.controller.js";
import { submitGate } from "../middleware/uploads.middleware.js";
import { submissionUpload } from "../services/contests.service.js";
export function registerContestsRoutes(router) {
  router.post("/contests/:id/join", createContestsByIdJoin);
  router.get("/contests/:id", getContestsById);
  router.get("/contests/:id/participants", getContestsByIdParticipants);
  router.get("/contests/:id/participants/:userId/submissions", getContestsByIdParticipantsByUserIdSubmissions);
  router.post("/contests/:id/submit", submitGate, submissionUpload.single("file"), createContestsByIdSubmit);
  router.get("/contests/:id/submissions/:submissionId/file", getContestsByIdSubmissionsBySubmissionIdFile);
  router.get("/manage/contests/:id/problems", getManageContestsByIdProblems);
  router.post("/manage/contests/:id/problems", createManageContestsByIdProblems);
  router.get("/manage/contests/:id/submissions", getManageContestsByIdSubmissions);
  router.patch("/manage/submissions/:id", updateManageSubmissionsById);
}
