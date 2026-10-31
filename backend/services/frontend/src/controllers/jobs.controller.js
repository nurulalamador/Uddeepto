import { run } from "../middleware/response.middleware.js";
import { finiteOrNull, distanceSql, ownJob } from "../services/jobs.service.js";
import { paging, uuid, catDetailsSql, one, afterStatusChange } from "../services/shared.service.js";
import { ApiError, query, notifyApplicationStatus } from "@uddeepto/common";
import { z } from "zod";
export const getJobs = run(async req => {
  const [limit, offset] = paging(req);
  const tab = req.query.tab;
  const filter = tab === "mine" ? `j.creator_id=$1` : tab === "applied" ? `a.applicant_id=$1` : `j.status='open' AND(j.application_deadline IS NULL OR j.application_deadline>now())`;
  const lat = finiteOrNull(req.query.lat, 90),
    lng = finiteOrNull(req.query.lng, 180),
    radius = finiteOrNull(req.query.radius, 20040);
  if (lat === null !== (lng === null)) throw new ApiError(422, "Send both latitude and longitude");
  const mapOnly = req.query.map === "1";
  const category = req.query.category ? uuid(req.query.category) : "";
  const sortColumn = {
    salary: "coalesce(x.salary_max,x.salary_min)",
    deadline: "x.application_deadline",
    created: "x.created_at"
  }[String(req.query.sort || "")];
  const direction = req.query.direction === "asc" ? "ASC" : "DESC";
  const orderBy = sortColumn ? `${sortColumn} ${direction} NULLS LAST,x.created_at DESC` : `${lat !== null ? "x.distance_km ASC NULLS LAST," : ""}x.created_at DESC`;
  const distance = distanceSql("$6", "$7");
  const rows = (await query(`SELECT * FROM(SELECT j.id,j.creator_id,j.title,j.description,j.status,j.type,j.salary_min,j.salary_max,j.currency,j.salary_period,j.location,j.latitude::float8 latitude,j.longitude::float8 longitude,j.is_remote,j.application_deadline,j.created_at,(SELECT count(*) FROM job_applications ap WHERE ap.job_id=j.id)::int application_count,u.name creator_name,${catDetailsSql("jobs", "j")} category_details,a.status application_status,${distance} distance_km FROM jobs j JOIN users u ON u.id=j.creator_id LEFT JOIN job_applications a ON a.job_id=j.id AND a.applicant_id=$1 WHERE ${filter} AND(j.title ILIKE $2 OR j.description ILIKE $2 OR j.location ILIKE $2) AND($3='' OR j.type::text=$3) AND($9='' OR j.category_id::text=$9 OR EXISTS(SELECT 1 FROM job_categories jc WHERE jc.job_id=j.id AND jc.category_id::text=$9))${mapOnly ? " AND j.latitude IS NOT NULL" : ""}) x WHERE($8::float8 IS NULL OR x.distance_km<=$8::float8) ORDER BY ${orderBy} LIMIT $4 OFFSET $5`, [req.user.sub, `%${String(req.query.q || "").slice(0, 200)}%`, req.query.type || "", limit, offset, lat, lng, radius, category])).rows;
  return rows.map(row => ({
    ...row,
    distance_km: row.distance_km === null ? null : Number(row.distance_km)
  }));
});
export const getJobsApplicants = run(async req => {
  if (!["hirer", "admin"].includes(req.user.role)) throw new ApiError(403, "Hiring account required");
  const [limit, offset] = paging(req);
  const jobId = req.query.job ? uuid(req.query.job) : null;
  const status = req.query.status ? z.enum(["applied", "shortlisted", "accepted", "rejected", "withdrawn"]).parse(req.query.status) : null;
  const like = `%${String(req.query.q || "").slice(0, 100)}%`;
  return (await query(`SELECT a.job_id,j.title job_title,a.applicant_id,u.name,u.username,u.uddeepto_id,(u.picture IS NOT NULL) has_picture,u.headline,a.status::text status,a.applied_at,a.cover_letter,(a.resume_blob IS NOT NULL) has_resume
    FROM job_applications a JOIN jobs j ON j.id=a.job_id JOIN users u ON u.id=a.applicant_id
    WHERE (j.creator_id=$1 OR $2='admin') AND($3::uuid IS NULL OR a.job_id=$3) AND($4::text IS NULL OR a.status::text=$4) AND(u.name ILIKE $5 OR u.username::text ILIKE $5)
    ORDER BY a.applied_at DESC LIMIT $6 OFFSET $7`, [req.user.sub, req.user.role, jobId, status, like, limit, offset])).rows;
});
export const getJobsById = run(async req => {
  const id = uuid(req.params.id);
  const job = await one(`SELECT j.id,j.creator_id,j.title,j.description,j.status::text status,j.type::text type,j.salary_min,j.salary_max,j.currency,j.salary_period,j.location,j.latitude::float8 latitude,j.longitude::float8 longitude,j.is_remote,j.criteria,j.application_deadline,j.created_at,u.name creator_name,u.uddeepto_id creator_uddeepto_id,(u.picture IS NOT NULL) creator_has_picture,a.status::text application_status,a.applied_at,(j.creator_id=$2 OR $3='admin') is_owner FROM jobs j JOIN users u ON u.id=j.creator_id LEFT JOIN job_applications a ON a.job_id=j.id AND a.applicant_id=$2 WHERE j.id=$1 AND(j.status<>'draft' OR j.creator_id=$2 OR $3='admin')`, [id, req.user.sub, req.user.role]);
  if (job.is_owner) job.application_count = Number((await one("SELECT count(*) FROM job_applications WHERE job_id=$1", [id])).count);
  job.accepting = job.status === "open" && (!job.application_deadline || new Date(job.application_deadline) > new Date());
  return job;
});
export const getJobsByIdApplications = run(async req => {
  await ownJob(req);
  return (await query("SELECT a.applicant_id,a.status,a.cover_letter,a.applied_at,a.resume_blob IS NOT NULL has_resume,u.name,u.username FROM job_applications a JOIN users u ON u.id=a.applicant_id WHERE job_id=$1 ORDER BY applied_at DESC LIMIT 100", [req.params.id])).rows;
});
export const getJobsByIdApplicationsByUserIdResume = run(async (req, res) => {
  await ownJob(req);
  const a = await one("SELECT resume_blob,resume_mime_type FROM job_applications WHERE job_id=$1 AND applicant_id=$2", [req.params.id, uuid(req.params.userId)]);
  if (!a.resume_blob) throw new ApiError(404, "Resume not found");
  res.set("Content-Disposition", 'attachment; filename="resume.pdf"').type("application/octet-stream").send(a.resume_blob);
});
export const updateJobsByIdApplicationsByUserId = run(async req => {
  await ownJob(req);
  const status = z.enum(["shortlisted", "accepted", "rejected", "applied"]).parse(req.body.status);
  const applicantId = uuid(req.params.userId);
  const updated = await query("UPDATE job_applications SET status=$1 WHERE job_id=$2 AND applicant_id=$3", [status, req.params.id, applicantId]);
  if (updated.rowCount) await notifyApplicationStatus(req.params.id, applicantId, status, req.user.sub);
});
export const updateJobsByIdStatus = run(async req => {
  await ownJob(req);
  const status = z.enum(["open", "closed"]).parse(req.body.status);
  const previous = (await one("SELECT status::text AS status FROM jobs WHERE id=$1", [req.params.id])).status;
  await query("UPDATE jobs SET status=$1 WHERE id=$2", [status, req.params.id]);
  if (previous !== status) await afterStatusChange("jobs", [req.params.id], status, req.user.sub);
});
