import { asyncHandler, query, ApiError, notify, notifyApplicationStatus } from "@uddeepto/common";
export const applyForJob = asyncHandler(async (q, s) => {
  const j = (await query(`SELECT creator_id,title FROM jobs WHERE id=$1 AND status='open' AND(application_deadline IS NULL OR application_deadline>now())`, [q.params.id])).rows[0];
  if (!j) throw new ApiError(409, "Job is not accepting applications");
  // "Your current CV" sends no file: the CV saved on the profile is copied into this application.
  let resume = q.file;
  if (!resume && ["true", "1"].includes(String(q.body.use_current_cv))) {
    const cv = (await query("SELECT file_data,mime_type FROM user_cvs WHERE user_id=$1", [q.user.sub])).rows[0];
    if (!cv) throw new ApiError(409, "You have no saved CV yet. Upload one or generate it from your profile.");
    resume = {
      buffer: Buffer.from(cv.file_data),
      mimetype: cv.mime_type
    };
  }
  await query(`INSERT INTO job_applications(job_id,applicant_id,cover_letter,resume_blob,resume_mime_type) VALUES($1,$2,$3,$4,$5)`, [q.params.id, q.user.sub, q.body.cover_letter, resume?.buffer, resume?.mimetype]);
  const applicant = (await query("SELECT name FROM users WHERE id=$1", [q.user.sub])).rows[0]?.name || "Someone";
  await notify({
    to: j.creator_id,
    actor: q.user.sub,
    type: "job_application_received",
    title: `${applicant} applied for “${j.title}”`,
    body: String(q.body.cover_letter || "").replace(/\s+/g, " ").trim().slice(0, 120) || "Review the application from Job Management.",
    link: "/applicants",
    entity: ["job", q.params.id],
    key: `apply:${q.params.id}:${q.user.sub}`
  });
  s.status(201).json({
    applied: true
  });
});
export const updateApplicationStatus = asyncHandler(async (q, s) => {
  const x = await query(`UPDATE job_applications a SET status=$1 WHERE job_id=$2 AND applicant_id=$3 AND EXISTS(SELECT 1 FROM jobs j WHERE j.id=a.job_id AND(j.creator_id=$4 OR $5='admin')) RETURNING a.*`, [q.body.status, q.params.jobId, q.params.userId, q.user.sub, q.user.role]);
  if (!x.rowCount) throw new ApiError(404, "Application not found");
  await notifyApplicationStatus(q.params.jobId, q.params.userId, x.rows[0].status, q.user.sub);
  s.json(x.rows[0]);
});
export const listMyApplications = asyncHandler(async (q, s) => s.json((await query("SELECT a.job_id,a.status,a.applied_at,j.title FROM job_applications a JOIN jobs j ON j.id=a.job_id WHERE a.applicant_id=$1", [q.user.sub])).rows));
