import { asyncHandler, query, ApiError } from "@uddeepto/common";
export const joinContest = asyncHandler(async (q, s) => {
  const c = (await query(`SELECT * FROM contests WHERE id=$1 AND status='published' AND now()<ending_time`, [q.params.id])).rows[0];
  if (!c) throw new ApiError(409, "Contest unavailable");
  if (Number(c.entry_fee) > 0) throw new ApiError(402, "Complete payment before joining");
  await query(`INSERT INTO contest_participants(contest_id,participant_id,payment_status) VALUES($1,$2,'paid') ON CONFLICT DO NOTHING`, [q.params.id, q.user.sub]);
  s.status(201).json({
    joined: true
  });
});
export const listContestProblems = asyncHandler(async (q, s) => s.json((await query("SELECT * FROM contest_problems WHERE contest_id=$1 ORDER BY sort_order", [q.params.id])).rows));
export const createContestProblem = asyncHandler(async (q, s) => {
  const ok = await query(`SELECT 1 FROM contests WHERE id=$1 AND(creator_id=$2 OR $3='admin')`, [q.params.id, q.user.sub, q.user.role]);
  if (!ok.rowCount) throw new ApiError(403, "Not contest owner");
  const b = q.body;
  s.status(201).json((await query(`INSERT INTO contest_problems(creator_id,contest_id,name,description,sample_input,sample_output,points,time_limit_ms,memory_limit_mb,sort_order) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`, [q.user.sub, q.params.id, b.name, b.description, b.sample_input, b.sample_output, b.points || 0, b.time_limit_ms, b.memory_limit_mb, b.sort_order || 0])).rows[0]);
});
export const submitContestEntry = asyncHandler(async (q, s) => {
  const b = q.body;
  s.status(201).json((await query(`INSERT INTO contest_submissions(contest_id,problem_id,participant_id,content,language) VALUES($1,$2,$3,$4,$5) RETURNING *`, [q.params.id, b.problem_id, q.user.sub, b.content, b.language])).rows[0]);
});
export const getContestLeaderboard = asyncHandler(async (q, s) => s.json((await query(`SELECT p.points,p.rank,u.id,u.name,u.username FROM contest_participants p JOIN users u ON u.id=p.participant_id WHERE p.contest_id=$1 ORDER BY p.points DESC,p.participated_at`, [q.params.id])).rows));
