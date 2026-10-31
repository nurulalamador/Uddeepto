import { contestKindSql } from "../services/contests.service.js";
import { one, uuid } from "../services/shared.service.js";
import { admin, learner } from "./permissions.middleware.js";
import { asyncHandler } from "@uddeepto/common";
export const adminOnly = (req, _res, next) => {
  try {
    admin(req);
    next();
  } catch (error) {
    next(error);
  }
};
export const submitGate = asyncHandler(async (req, _res, next) => {
  learner(req);
  const contest = await one(`SELECT c.id,${contestKindSql} submission_kind,(SELECT count(*) FROM contest_problems WHERE contest_id=c.id) problem_count FROM contests c WHERE c.id=$1 AND c.status='published' AND c.starting_time<=now() AND c.ending_time>=now()`, [uuid(req.params.id)]);
  await one("SELECT 1 FROM contest_participants WHERE contest_id=$1 AND participant_id=$2 AND payment_status='paid'", [contest.id, req.user.sub]);
  req.contest = contest;
  next();
});
