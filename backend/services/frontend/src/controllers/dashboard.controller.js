import { learner, hirerOnly } from "../middleware/permissions.middleware.js";
import { run } from "../middleware/response.middleware.js";
import { one } from "../services/shared.service.js";
import { query } from "@uddeepto/common";
export const getDashboard = run(async req => {
  const id = req.user.sub;
  if (req.user.role === "hirer") return {
    ...(await one(`SELECT (SELECT count(*) FROM jobs WHERE creator_id=$1) jobs,(SELECT count(*) FROM jobs WHERE creator_id=$1 AND status='open') open_jobs,(SELECT count(*) FROM job_applications a JOIN jobs j ON j.id=a.job_id WHERE j.creator_id=$1) applications,(SELECT count(*) FROM showcase_posts WHERE creator_id=$1 AND deleted_at IS NULL) posts`, [id])),
    recent: (await query("SELECT j.title,a.status FROM job_applications a JOIN jobs j ON j.id=a.job_id WHERE j.creator_id=$1 ORDER BY a.applied_at DESC LIMIT 5", [id])).rows
  };
  return {
    ...(await one(`SELECT (SELECT count(*) FROM course_enrollments WHERE user_id=$1 AND status IN ('active','completed')) enrollments,(SELECT count(*) FROM contest_participants WHERE participant_id=$1) contests,(SELECT count(*) FROM community_members WHERE member_id=$1 AND status='approved') communities,(SELECT count(*) FROM job_applications WHERE applicant_id=$1) applications`, [id])),
    recent: (await query(`SELECT c.title,e.status FROM course_enrollments e JOIN courses c ON c.id=e.course_id WHERE e.user_id=$1 AND e.status IN('active','completed') ORDER BY e.enrolled_at DESC LIMIT 5`, [id])).rows,
    upcoming: (await query(`SELECT id,name,status,starting_time FROM webinars WHERE status='scheduled' AND starting_time>now() ORDER BY starting_time LIMIT 3`)).rows
  };
});
export const getDashboardLearner = run(async req => {
  learner(req);
  const id = req.user.sub;
  const stats = await one(`SELECT
    (SELECT count(*) FROM course_enrollments WHERE user_id=$1 AND status IN('active','completed'))::int enrolled,
    (SELECT count(*) FROM course_enrollments WHERE user_id=$1 AND status='completed')::int completed_courses,
    (SELECT count(*) FROM completed_course_materials WHERE user_id=$1)::int materials_done,
    (SELECT count(*) FROM course_materials m JOIN course_enrollments e ON e.course_id=m.course_id AND e.user_id=$1 AND e.status IN('active','completed'))::int materials_total,
    (SELECT count(*) FROM contest_participants WHERE participant_id=$1)::int contests_joined,
    (SELECT count(*) FROM contest_participants p JOIN contests c ON c.id=p.contest_id WHERE p.participant_id=$1 AND p.rank BETWEEN 1 AND 3 AND c.status='completed')::int podiums,
    (SELECT count(*) FROM community_members WHERE member_id=$1 AND status='approved')::int communities,
    (SELECT count(*) FROM job_applications WHERE applicant_id=$1)::int applications,
    (SELECT count(*) FROM webinar_participants WHERE participant_id=$1 AND status IN('registered','attended'))::int webinars`, [id]);
  const continueLearning = (await query(`SELECT c.id,c.title,(c.cover_image IS NOT NULL) has_cover_image,ins.name instructor_name,e.status::text status,e.last_accessed_at,
      (SELECT count(*) FROM course_materials WHERE course_id=c.id)::int progress_total,
      (SELECT count(*) FROM completed_course_materials WHERE course_id=c.id AND user_id=$1)::int progress_done,
      coalesce((SELECT m.id FROM course_materials m WHERE m.course_id=c.id AND NOT EXISTS(SELECT 1 FROM completed_course_materials cm WHERE cm.material_id=m.id AND cm.user_id=$1) ORDER BY m.sort_order LIMIT 1),(SELECT m.id FROM course_materials m WHERE m.course_id=c.id ORDER BY m.sort_order LIMIT 1)) next_material_id
    FROM course_enrollments e JOIN courses c ON c.id=e.course_id LEFT JOIN instructors ins ON ins.id=c.instructor_id
    WHERE e.user_id=$1 AND e.status IN('active','completed') ORDER BY (e.status='active') DESC,e.last_accessed_at DESC NULLS LAST,e.enrolled_at DESC LIMIT 4`, [id])).rows;
  const activity = (await query(`SELECT d.day::date::text AS day,coalesce(a.n,0)::int AS count
    FROM generate_series((now() AT TIME ZONE 'Asia/Dhaka')::date-13,(now() AT TIME ZONE 'Asia/Dhaka')::date,interval '1 day') AS d(day)
    LEFT JOIN(SELECT (completed_at AT TIME ZONE 'Asia/Dhaka')::date AS day,count(*) AS n FROM completed_course_materials WHERE user_id=$1 AND completed_at>now()-interval '16 days' GROUP BY 1) a ON a.day=d.day::date ORDER BY d.day`, [id])).rows;
  const activeDays = new Set((await query(`SELECT DISTINCT (completed_at AT TIME ZONE 'Asia/Dhaka')::date::text AS day FROM completed_course_materials WHERE user_id=$1 AND completed_at>now()-interval '90 days'`, [id])).rows.map(row => row.day));
  const todayDhaka = (await one("SELECT (now() AT TIME ZONE 'Asia/Dhaka')::date::text today")).today;
  let streak = 0;
  for (let cursor = new Date(todayDhaka + "T00:00:00Z"), first = true; streak <= 90; cursor.setUTCDate(cursor.getUTCDate() - 1), first = false) {
    if (activeDays.has(cursor.toISOString().slice(0, 10))) streak++;else if (!first) break;
  }
  const schedule = (await query(`SELECT * FROM(
      SELECT 'webinar'::text kind,w.id,w.name,w.starting_time,w.ending_time FROM webinar_participants p JOIN webinars w ON w.id=p.webinar_id WHERE p.participant_id=$1 AND p.status='registered' AND w.ending_time>now() AND w.status IN('scheduled','live')
      UNION ALL
      SELECT 'contest'::text,c.id,c.name,c.starting_time,c.ending_time FROM contest_participants p JOIN contests c ON c.id=p.contest_id WHERE p.participant_id=$1 AND c.ending_time>now() AND c.status='published'
    ) s ORDER BY starting_time LIMIT 6`, [id])).rows;
  const discover = (await query(`SELECT * FROM(
      SELECT 'webinar'::text kind,w.id,w.name,w.starting_time,w.ending_time FROM webinars w WHERE w.status IN('scheduled','live') AND w.ending_time>now() AND NOT EXISTS(SELECT 1 FROM webinar_participants p WHERE p.webinar_id=w.id AND p.participant_id=$1 AND p.status IN('registered','attended'))
      UNION ALL
      SELECT 'contest'::text,c.id,c.name,c.starting_time,c.ending_time FROM contests c WHERE c.status='published' AND c.ending_time>now() AND NOT EXISTS(SELECT 1 FROM contest_participants p WHERE p.contest_id=c.id AND p.participant_id=$1)
    ) s ORDER BY starting_time LIMIT 4`, [id])).rows;
  const applications = (await query(`SELECT a.job_id,j.title,u.name company,a.status::text status,a.applied_at FROM job_applications a JOIN jobs j ON j.id=a.job_id JOIN users u ON u.id=j.creator_id WHERE a.applicant_id=$1 ORDER BY a.applied_at DESC LIMIT 4`, [id])).rows;
  const communities = (await query(`SELECT c.id,c.name,(SELECT count(*) FROM community_members WHERE community_id=c.id AND status='approved')::int member_count FROM communities c JOIN community_members m ON m.community_id=c.id AND m.member_id=$1 AND m.status='approved' ORDER BY m.approved_at DESC NULLS LAST LIMIT 4`, [id])).rows;
  const flags = await one(`SELECT (picture IS NOT NULL) picture,coalesce(headline,'')<>'' headline,coalesce(bio,'')<>'' bio,EXISTS(SELECT 1 FROM user_interests WHERE user_id=$1) interests,EXISTS(SELECT 1 FROM user_education WHERE user_id=$1) education,EXISTS(SELECT 1 FROM user_experiences WHERE user_id=$1) experience FROM users WHERE id=$1`, [id]);
  const checklist = [["picture", "Add a profile picture"], ["headline", "Write a headline"], ["bio", "Tell people about yourself"], ["interests", "Choose your interests"], ["education", "Add your education"], ["experience", "Add your experience"]].map(([key, label]) => ({
    key,
    label,
    done: flags[key]
  }));
  return {
    stats,
    continue_learning: continueLearning,
    activity,
    streak,
    schedule,
    discover,
    applications,
    communities,
    profile: {
      percent: Math.round(100 * checklist.filter(item => item.done).length / checklist.length),
      checklist
    }
  };
});
export const getDashboardHirer = run(async req => {
  hirerOnly(req);
  const id = req.user.sub;
  const stats = await one(`SELECT
    (SELECT count(*) FROM jobs WHERE creator_id=$1)::int jobs,
    (SELECT count(*) FROM jobs WHERE creator_id=$1 AND status='open' AND (application_deadline IS NULL OR application_deadline>now()))::int open_jobs,
    (SELECT count(*) FROM job_applications a JOIN jobs j ON j.id=a.job_id WHERE j.creator_id=$1)::int applicants,
    (SELECT count(*) FROM job_applications a JOIN jobs j ON j.id=a.job_id WHERE j.creator_id=$1 AND a.status='applied')::int new_applicants,
    (SELECT count(*) FROM job_applications a JOIN jobs j ON j.id=a.job_id WHERE j.creator_id=$1 AND a.status='shortlisted')::int shortlisted,
    (SELECT count(*) FROM job_applications a JOIN jobs j ON j.id=a.job_id WHERE j.creator_id=$1 AND a.status='accepted')::int accepted,
    (SELECT count(*) FROM job_applications a JOIN jobs j ON j.id=a.job_id WHERE j.creator_id=$1 AND a.status='rejected')::int rejected,
    (SELECT count(*) FROM job_applications a JOIN jobs j ON j.id=a.job_id WHERE j.creator_id=$1 AND a.applied_at>now()-interval '7 days')::int applicants_week`, [id]);
  const recent = (await query(`SELECT a.job_id,j.title job_title,a.applicant_id,u.name,u.uddeepto_id,(u.picture IS NOT NULL) has_picture,u.headline,a.status::text status,a.applied_at
    FROM job_applications a JOIN jobs j ON j.id=a.job_id JOIN users u ON u.id=a.applicant_id WHERE j.creator_id=$1 ORDER BY a.applied_at DESC LIMIT 6`, [id])).rows;
  const topJobs = (await query(`SELECT * FROM(SELECT j.id,j.title,j.status::text status,j.application_deadline,j.created_at,
      (SELECT count(*) FROM job_applications WHERE job_id=j.id)::int application_count,
      (SELECT count(*) FROM job_applications WHERE job_id=j.id AND status='applied')::int new_count
    FROM jobs j WHERE j.creator_id=$1) x ORDER BY new_count DESC,created_at DESC LIMIT 5`, [id])).rows;
  const closing = (await query(`SELECT id,title,application_deadline FROM jobs WHERE creator_id=$1 AND status='open' AND application_deadline>now() AND application_deadline<now()+interval '7 days' ORDER BY application_deadline LIMIT 4`, [id])).rows;
  const activity = (await query(`SELECT d.day::date::text AS day,coalesce(a.n,0)::int AS count
    FROM generate_series((now() AT TIME ZONE 'Asia/Dhaka')::date-13,(now() AT TIME ZONE 'Asia/Dhaka')::date,interval '1 day') AS d(day)
    LEFT JOIN(SELECT (a.applied_at AT TIME ZONE 'Asia/Dhaka')::date AS day,count(*) AS n FROM job_applications a JOIN jobs j ON j.id=a.job_id WHERE j.creator_id=$1 AND a.applied_at>now()-interval '16 days' GROUP BY 1) a ON a.day=d.day::date ORDER BY d.day`, [id])).rows;
  return {
    stats,
    recent,
    top_jobs: topJobs,
    closing,
    activity
  };
});
