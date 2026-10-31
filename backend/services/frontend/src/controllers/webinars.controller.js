import { learner } from "../middleware/permissions.middleware.js";
import { run } from "../middleware/response.middleware.js";
import { one, catNamesSql, catDetailsSql, speakersJsonSql, uuid } from "../services/shared.service.js";
import { webinarPhase } from "../services/webinars.service.js";
import { tx, ApiError } from "@uddeepto/common";
export const getWebinarsById = run(async req => {
  learner(req);
  const w = await one(`SELECT w.id,w.name,w.description,w.status::text status,w.capacity,w.starting_time,w.ending_time,w.recording_url,w.meeting_url _meeting,u.name creator_name,${catNamesSql("webinars", "w")} category_name,${catDetailsSql("webinars", "w")} category_details,${speakersJsonSql("w")} speakers,(SELECT count(*) FROM webinar_participants WHERE webinar_id=w.id AND status IN('registered','attended')) participant_count,EXISTS(SELECT 1 FROM webinar_participants WHERE webinar_id=w.id AND participant_id=$2 AND status IN('registered','attended')) joined,${webinarPhase} phase FROM webinars w JOIN users u ON u.id=w.creator_id WHERE w.id=$1 AND(w.status IN('scheduled','live','completed','cancelled') OR w.creator_id=$2 OR $3='admin')`, [uuid(req.params.id), req.user.sub, req.user.role]);
  const meetingUrl = (w.joined || req.user.role === "admin") && w.phase !== "previous" ? w._meeting : null;
  delete w._meeting;
  return {
    ...w,
    meeting_url: meetingUrl,
    recording_url: w.phase === "previous" ? w.recording_url : null
  };
});
export const createWebinarsByIdJoin = run(async req => {
  learner(req);
  await tx(async db => {
    const w = (await db.query("SELECT * FROM webinars WHERE id=$1 FOR UPDATE", [uuid(req.params.id)])).rows[0];
    if (!w || !["scheduled", "live"].includes(w.status) || new Date(w.ending_time) < new Date()) throw new ApiError(409, "Registration closed");
    const existing = await db.query(`SELECT 1 FROM webinar_participants WHERE webinar_id=$1 AND participant_id=$2 AND status IN('registered','attended')`, [w.id, req.user.sub]);
    if (existing.rowCount) return;
    const count = Number((await db.query(`SELECT count(*) FROM webinar_participants WHERE webinar_id=$1 AND status IN('registered','attended')`, [w.id])).rows[0].count);
    if (w.capacity && count >= w.capacity) throw new ApiError(409, "Webinar is full");
    await db.query(`INSERT INTO webinar_participants(webinar_id,participant_id) VALUES($1,$2) ON CONFLICT(webinar_id,participant_id) DO UPDATE SET status='registered'`, [w.id, req.user.sub]);
  });
});
