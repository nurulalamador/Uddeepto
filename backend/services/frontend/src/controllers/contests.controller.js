import { MB } from "../config/storage.config.js";
import { learner, admin } from "../middleware/permissions.middleware.js";
import { run } from "../middleware/response.middleware.js";
import { visibleContest, imageMimes, submissionLimits } from "../services/contests.service.js";
import { uuid, one, decodeName, storedPath } from "../services/shared.service.js";
import { tx, ApiError, query, optimizeStoredUpload, notify } from "@uddeepto/common";
import fs from "node:fs";
import { z } from "zod";
export const createContestsByIdJoin = run(async req => {
  learner(req);
  await tx(async db => {
    const c = (await db.query("SELECT * FROM contests WHERE id=$1 FOR UPDATE", [uuid(req.params.id)])).rows[0];
    if (!c || c.status !== "published" || new Date(c.ending_time) < new Date()) throw new ApiError(409, "Contest unavailable");
    if (Number(c.entry_fee) > 0) throw new ApiError(402, "Paid entries need a payment provider; contact the organizer.");
    if ((await db.query("SELECT 1 FROM contest_participants WHERE contest_id=$1 AND participant_id=$2", [c.id, req.user.sub])).rowCount) return;
    const n = Number((await db.query("SELECT count(*) FROM contest_participants WHERE contest_id=$1", [c.id])).rows[0].count);
    if (c.max_participants && n >= c.max_participants) throw new ApiError(409, "Contest is full");
    await db.query(`INSERT INTO contest_participants(contest_id,participant_id,payment_status) VALUES($1,$2,'paid')`, [c.id, req.user.sub]);
  });
});
export const getContestsById = run(async req => {
  learner(req);
  const contest = await visibleContest(req);
  const started = contest.phase !== "upcoming";
  const problems = started ? (await query("SELECT id,name,description,points,sample_input,sample_output,time_limit_ms,memory_limit_mb FROM contest_problems WHERE contest_id=$1 ORDER BY sort_order", [contest.id])).rows : [];
  const mySubmissions = contest.joined ? (await query("SELECT s.id,s.problem_id,p.name problem_name,s.content,s.language,s.status::text status,s.score,s.feedback,s.submitted_at,s.mime_type,s.file_name,s.file_size,(s.file_url IS NOT NULL) has_file FROM contest_submissions s LEFT JOIN contest_problems p ON p.id=s.problem_id WHERE s.contest_id=$1 AND s.participant_id=$2 ORDER BY s.submitted_at DESC", [contest.id, req.user.sub])).rows : [];
  return {
    ...contest,
    problems,
    my_submissions: mySubmissions
  };
});
export const getContestsByIdParticipants = run(async req => {
  learner(req);
  const contest = await visibleContest(req);
  const started = contest.phase !== "upcoming";
  return (await query(`SELECT u.id,u.name,u.username,(u.picture IS NOT NULL) has_picture,p.participated_at,${started ? "p.points,coalesce(p.rank,rank() OVER (ORDER BY p.points DESC,p.participated_at)) AS rank," : "NULL::numeric AS points,NULL::int AS rank,"}(SELECT count(*) FROM contest_submissions s WHERE s.contest_id=p.contest_id AND s.participant_id=p.participant_id) submission_count FROM contest_participants p JOIN users u ON u.id=p.participant_id WHERE p.contest_id=$1 AND p.payment_status='paid' ORDER BY ${started ? "rank," : ""}p.participated_at LIMIT 300`, [contest.id])).rows;
});
export const getContestsByIdParticipantsByUserIdSubmissions = run(async req => {
  learner(req);
  const contest = await visibleContest(req);
  if (contest.phase === "upcoming" && req.user.role !== "admin") throw new ApiError(403, "Submissions open when the contest starts");
  const userId = uuid(req.params.userId);
  await one("SELECT 1 FROM contest_participants WHERE contest_id=$1 AND participant_id=$2 AND payment_status='paid'", [contest.id, userId]);
  return (await query("SELECT s.id,s.problem_id,p.name problem_name,s.content,s.language,s.status::text status,s.score,s.feedback,s.submitted_at,s.mime_type,s.file_name,s.file_size,(s.file_url IS NOT NULL) has_file FROM contest_submissions s LEFT JOIN contest_problems p ON p.id=s.problem_id WHERE s.contest_id=$1 AND s.participant_id=$2 ORDER BY s.submitted_at DESC LIMIT 50", [contest.id, userId])).rows;
});
export const createContestsByIdSubmit = run(async req => {
  const file = req.file,
    contest = req.contest,
    kind = contest.submission_kind;
  try {
    const body = z.object({
      problem_id: z.string().uuid().nullish().or(z.literal("")),
      content: z.string().max(100000).optional(),
      language: z.string().trim().max(50).optional()
    }).parse(req.body);
    let problemId = null;
    if (Number(contest.problem_count) > 0) {
      if (!body.problem_id) throw new ApiError(422, "Choose which problem you are submitting for");
      problemId = body.problem_id;
    }
    let content = body.content?.trim() || null,
      fileFields = [null, null, null, null];
    if (kind === "image" || kind === "audio") {
      if (!file) throw new ApiError(422, kind === "image" ? "Upload an image" : "Upload an audio recording");
      const okMime = kind === "image" ? imageMimes.has(file.mimetype) : file.mimetype.startsWith("audio/");
      if (!okMime) throw new ApiError(422, kind === "image" ? "Use a JPEG, PNG, WebP, GIF or AVIF image" : "Use an audio file (MP3, WAV, M4A, OGG…)");
      if (kind === "image") await optimizeStoredUpload(file, "submission");
      if (file.size > submissionLimits[kind]) throw new ApiError(413, `File is larger than ${Math.round(submissionLimits[kind] / MB)} MB`);
      fileFields = [`/uploads/contest-submissions/${contest.id}/${file.filename}`, decodeName(file.originalname), file.size, file.mimetype];
    } else {
      if (file) throw new ApiError(422, "This contest takes written answers, not files");
      if (!content) throw new ApiError(422, kind === "code" ? "Paste your code" : "Write your answer");
    }
    const language = kind === "code" && body.language ? body.language : null;
    return (await query("INSERT INTO contest_submissions(contest_id,participant_id,problem_id,content,language,file_url,file_name,file_size,mime_type) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id", [contest.id, req.user.sub, problemId, content, language, ...fileFields])).rows[0];
  } catch (error) {
    if (file) await fs.promises.unlink(file.path).catch(() => {});
    throw error;
  }
});
export const getContestsByIdSubmissionsBySubmissionIdFile = run(async (req, res) => {
  learner(req);
  const contest = await visibleContest(req);
  if (contest.phase === "upcoming" && req.user.role !== "admin") throw new ApiError(403, "Submissions open when the contest starts");
  const row = await one("SELECT file_url,file_name,mime_type FROM contest_submissions WHERE id=$1 AND contest_id=$2 AND file_url IS NOT NULL", [uuid(req.params.submissionId), contest.id]);
  const full = storedPath(row.file_url);
  await fs.promises.access(full).catch(() => {
    throw new ApiError(404, "This file is missing from storage");
  });
  const safe = imageMimes.has(row.mime_type) || row.mime_type.startsWith("audio/");
  res.set({
    "Content-Type": safe ? row.mime_type : "application/octet-stream",
    "Content-Disposition": `${safe ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(row.file_name || "submission")}`,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff"
  });
  await new Promise((resolve, reject) => res.sendFile(full, {
    dotfiles: "allow"
  }, error => error ? reject(error) : resolve()));
});
export const getManageContestsByIdProblems = run(async req => {
  admin(req);
  return (await query("SELECT id,name,description,points FROM contest_problems WHERE contest_id=$1 ORDER BY sort_order", [uuid(req.params.id)])).rows;
});
export const createManageContestsByIdProblems = run(async req => {
  admin(req);
  const b = z.object({
    name: z.string().min(1),
    description: z.string().min(1),
    points: z.number().nonnegative()
  }).parse(req.body);
  return tx(async db => {
    await db.query("SELECT id FROM contests WHERE id=$1 FOR UPDATE", [uuid(req.params.id)]);
    return (await db.query(`INSERT INTO contest_problems(creator_id,contest_id,name,description,points,sort_order) VALUES($1,$2,$3,$4,$5,(SELECT coalesce(max(sort_order),-1)+1 FROM contest_problems WHERE contest_id=$2)) RETURNING id`, [req.user.sub, req.params.id, b.name, b.description, b.points])).rows[0];
  });
});
export const getManageContestsByIdSubmissions = run(async req => {
  admin(req);
  return (await query("SELECT s.id,s.content,s.score,s.status,s.problem_id,u.name,s.mime_type,s.file_name,(s.file_url IS NOT NULL) has_file FROM contest_submissions s JOIN users u ON u.id=s.participant_id WHERE contest_id=$1 ORDER BY submitted_at DESC LIMIT 100", [uuid(req.params.id)])).rows;
});
export const updateManageSubmissionsById = run(async req => {
  admin(req);
  const b = z.object({
    score: z.number().nonnegative(),
    status: z.enum(["accepted", "rejected", "disqualified", "judging"])
  }).parse(req.body);
  let judged = null;
  await tx(async db => {
    const sub = (await db.query("SELECT contest_id,participant_id FROM contest_submissions WHERE id=$1", [uuid(req.params.id)])).rows[0];
    if (!sub) throw new ApiError(404, "Submission not found");
    await db.query("SELECT 1 FROM contest_participants WHERE contest_id=$1 AND participant_id=$2 FOR UPDATE", [sub.contest_id, sub.participant_id]);
    await db.query("UPDATE contest_submissions SET score=$1,status=$2,judged_at=now(),judged_by=$3 WHERE id=$4", [b.score, b.status, req.user.sub, req.params.id]);
    await db.query(`UPDATE contest_participants SET points=(SELECT coalesce(sum(best),0) FROM(SELECT max(score) best FROM contest_submissions WHERE contest_id=$1 AND participant_id=$2 AND status='accepted' GROUP BY problem_id) scores) WHERE contest_id=$1 AND participant_id=$2`, [sub.contest_id, sub.participant_id]);
    judged = sub;
  });
  if (judged && b.status !== "judging") {
    const contest = (await query("SELECT name FROM contests WHERE id=$1", [judged.contest_id])).rows[0];
    await notify({
      to: judged.participant_id,
      actor: req.user.sub,
      type: "contest_submission_judged",
      title: b.status === "accepted" ? `Your submission in ${contest?.name ?? "the contest"} was accepted` : b.status === "rejected" ? `Your submission in ${contest?.name ?? "the contest"} was not accepted` : `Your submission in ${contest?.name ?? "the contest"} was disqualified`,
      body: b.status === "accepted" ? `Score: ${b.score}` : null,
      link: `/contests/${judged.contest_id}`,
      entity: ["contest", judged.contest_id],
      key: `judged:${req.params.id}:${b.status}`
    });
  }
});
