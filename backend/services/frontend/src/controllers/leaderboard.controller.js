import { run } from "../middleware/response.middleware.js";
import { LEADERBOARD } from "../services/leaderboard.service.js";
import { uuid, one } from "../services/shared.service.js";
import { query } from "@uddeepto/common";
export const getLeaderboard = run(async req => {
  const category = req.query.category ? uuid(req.query.category) : null;
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
  const items = (await query(`${LEADERBOARD} SELECT * FROM r ORDER BY rank,name LIMIT $2`, [category, limit])).rows;
  const total = (await one(`${LEADERBOARD} SELECT count(*)::int n FROM r`, [category])).n;
  const me = req.user.role === "learner" ? (await query(`${LEADERBOARD} SELECT * FROM r WHERE id=$2`, [category, req.user.sub])).rows[0] || null : null;
  return {
    items,
    me,
    total
  };
});
