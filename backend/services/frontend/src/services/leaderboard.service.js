import { CONTEST_SCORE } from "./shared.service.js";
export const LEADERBOARD = `WITH s AS (
    SELECT u.id,u.name,u.username,u.uddeepto_id,(u.picture IS NOT NULL) has_picture,
      (coalesce(c.n,0)*10+coalesce(k.score,0))::int total,coalesce(c.n,0)::int courses,coalesce(k.score,0)::int contests
    FROM users u
    LEFT JOIN (SELECT user_id,count(*) n FROM course_enrollments WHERE status='completed' GROUP BY user_id) c ON c.user_id=u.id
    LEFT JOIN (SELECT cp.participant_id,sum(${CONTEST_SCORE}) score FROM contest_participants cp JOIN contests ct ON ct.id=cp.contest_id
               WHERE cp.payment_status='paid' AND ct.status='completed' AND cp.rank IS NOT NULL GROUP BY cp.participant_id) k ON k.participant_id=u.id
    WHERE u.role='learner' AND u.account_status='active'
      AND($1::uuid IS NULL OR EXISTS(SELECT 1 FROM user_interests ui WHERE ui.user_id=u.id AND ui.interest_id=$1::uuid))
  ), r AS (SELECT s.*,rank() OVER (ORDER BY total DESC)::int rank FROM s)`;
