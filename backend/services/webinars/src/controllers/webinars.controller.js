import { asyncHandler, query, ApiError } from "@uddeepto/common";
export const registerForWebinar = asyncHandler(async (q, s) => {
  const w = (await query(`SELECT capacity,status,(SELECT count(*) FROM webinar_participants WHERE webinar_id=$1 AND status='registered') count FROM webinars WHERE id=$1`, [q.params.id])).rows[0];
  if (!w) throw new ApiError(404, "Webinar not found");
  if (!["scheduled", "live"].includes(w.status) || w.capacity && Number(w.count) >= w.capacity) throw new ApiError(409, "Registration unavailable");
  await query(`INSERT INTO webinar_participants(webinar_id,participant_id) VALUES($1,$2) ON CONFLICT DO NOTHING`, [q.params.id, q.user.sub]);
  s.status(201).json({
    registered: true
  });
});
export const listMyRegistrations = asyncHandler(async (q, s) => s.json((await query("SELECT p.*,w.name,w.starting_time FROM webinar_participants p JOIN webinars w ON w.id=p.webinar_id WHERE p.participant_id=$1", [q.user.sub])).rows));
