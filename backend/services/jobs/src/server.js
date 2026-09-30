import express from "express";
import {
  createApp,
  resourceRouter,
  query,
  asyncHandler,
  auth,
  upload,
  ApiError,
  listen,
} from "@uddeepto/common";
const app = createApp("jobs"),
  r = express.Router();
r.use("/", (q, _s, n) => {
  if (
    ["POST", "PATCH"].includes(q.method) &&
    q.body &&
    ("latitude" in q.body || "longitude" in q.body)
  ) {
    const clean = (v) => (v === "" || v === undefined ? null : v);
    const la = clean(q.body.latitude),
      lo = clean(q.body.longitude);
    if ((la === null) !== (lo === null))
      return n(new ApiError(422, "Choose a location on the map"));
    if (la !== null) {
      const x = Number(la),
        y = Number(lo);
      if (
        !Number.isFinite(x) ||
        !Number.isFinite(y) ||
        Math.abs(x) > 90 ||
        Math.abs(y) > 180
      )
        return n(new ApiError(422, "That map position is not valid"));
      q.body.latitude = x;
      q.body.longitude = y;
    } else {
      q.body.latitude = null;
      q.body.longitude = null;
    }
  }
  n();
});
r.use(
  "/",
  resourceRouter({
    table: "jobs",
    fields: [
      "category_id",
      "title",
      "description",
      "salary_min",
      "salary_max",
      "currency",
      "salary_period",
      "location",
      "latitude",
      "longitude",
      "criteria",
      "type",
      "is_remote",
      "status",
      "application_deadline",
    ],
    required: ["title", "description", "type"],
    createRoles: ["hirer", "admin"],
    search: ["title", "description"],
    adminOnlyFields: ["status"],
  }),
);
r.post(
  "/:id/apply",
  auth(),
  upload.single("resume"),
  asyncHandler(async (q, s) => {
    const j = (
      await query(
        `SELECT 1 FROM jobs WHERE id=$1 AND status='open' AND(application_deadline IS NULL OR application_deadline>now())`,
        [q.params.id],
      )
    ).rowCount;
    if (!j) throw new ApiError(409, "Job is not accepting applications");
    await query(
      `INSERT INTO job_applications(job_id,applicant_id,cover_letter,resume_blob,resume_mime_type) VALUES($1,$2,$3,$4,$5)`,
      [
        q.params.id,
        q.user.sub,
        q.body.cover_letter,
        q.file?.buffer,
        q.file?.mimetype,
      ],
    );
    s.status(201).json({ applied: true });
  }),
);
r.patch(
  "/:jobId/applications/:userId",
  auth(),
  asyncHandler(async (q, s) => {
    const x = await query(
      `UPDATE job_applications a SET status=$1 WHERE job_id=$2 AND applicant_id=$3 AND EXISTS(SELECT 1 FROM jobs j WHERE j.id=a.job_id AND(j.creator_id=$4 OR $5='admin')) RETURNING a.*`,
      [q.body.status, q.params.jobId, q.params.userId, q.user.sub, q.user.role],
    );
    if (!x.rowCount) throw new ApiError(404, "Application not found");
    s.json(x.rows[0]);
  }),
);
app.get(
  "/me/applications",
  auth(),
  asyncHandler(async (q, s) =>
    s.json(
      (
        await query(
          "SELECT a.job_id,a.status,a.applied_at,j.title FROM job_applications a JOIN jobs j ON j.id=a.job_id WHERE a.applicant_id=$1",
          [q.user.sub],
        )
      ).rows,
    ),
  ),
);
app.use("/", r);
listen(app, process.env.JOBS_PORT || 4007, "jobs");
