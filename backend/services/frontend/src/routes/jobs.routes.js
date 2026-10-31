import { getJobs, getJobsApplicants, getJobsById, getJobsByIdApplications, getJobsByIdApplicationsByUserIdResume, updateJobsByIdApplicationsByUserId, updateJobsByIdStatus } from "../controllers/jobs.controller.js";
export function registerJobsRoutes(router) {
  router.get("/jobs", getJobs);
  router.get("/jobs/applicants", getJobsApplicants);
  router.get("/jobs/:id", getJobsById);
  router.get("/jobs/:id/applications", getJobsByIdApplications);
  router.get("/jobs/:id/applications/:userId/resume", getJobsByIdApplicationsByUserIdResume);
  router.patch("/jobs/:id/applications/:userId", updateJobsByIdApplicationsByUserId);
  router.patch("/jobs/:id/status", updateJobsByIdStatus);
}
