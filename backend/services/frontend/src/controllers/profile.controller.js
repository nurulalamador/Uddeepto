import { run } from "../middleware/response.middleware.js";
import { uddeeptoIdPattern, asDate } from "../services/profile.service.js";
import { one, uuid, catDetailsSql, CONTEST_SCORE, instructorImageTypes } from "../services/shared.service.js";
import { optionalText } from "../validators/profile.validators.js";
import { query, ApiError, optimizeUpload, tx } from "@uddeepto/common";
import { z } from "zod";
export const getPeople = run(async req => (await query(`SELECT id,uddeepto_id,name,username,role,(picture IS NOT NULL) has_picture FROM users WHERE account_status='active' AND (name ILIKE $1 OR username::text ILIKE $1 OR uddeepto_id ILIKE $1) ORDER BY name LIMIT 30`, [`%${String(req.query.q || "").slice(0, 100)}%`])).rows);
export const getProfileById = run(async req => {
  const ref = String(req.params.id);
  const byUddeeptoId = uddeeptoIdPattern.test(ref);
  const p = await one(`SELECT id,uddeepto_id,name,username,headline,bio,role::text role,created_at,(picture IS NOT NULL) has_picture,(cover_image IS NOT NULL) has_cover_image FROM users WHERE ${byUddeeptoId ? "uddeepto_id" : "id"}=$1 AND account_status='active'`, [byUddeeptoId ? ref : uuid(ref)]);
  const isSelf = p.id === req.user.sub;
  p.is_self = isSelf;
  p.interests = (await query("SELECT i.id,i.name,i.icon FROM user_interests ui JOIN interest_categories i ON i.id=ui.interest_id WHERE ui.user_id=$1 ORDER BY i.name", [p.id])).rows;
  p.education = (await query("SELECT id,institution,degree,field_of_study,start_date::text start_date,end_date::text end_date,grade,description FROM user_education WHERE user_id=$1 ORDER BY (end_date IS NULL) DESC,coalesce(end_date,start_date) DESC,start_date DESC", [p.id])).rows;
  p.experience = (await query("SELECT e.id,e.title,e.workplace,e.location,e.category_id,coalesce(ic.name,'Others') category_name,ic.icon category_icon,e.start_date::text start_date,e.end_date::text end_date,e.description FROM user_experiences e LEFT JOIN interest_categories ic ON ic.id=e.category_id WHERE e.user_id=$1 ORDER BY (e.end_date IS NULL) DESC,coalesce(e.end_date,e.start_date) DESC,e.start_date DESC", [p.id])).rows;
  p.posts = (await query(`SELECT id,content,COALESCE((SELECT json_agg(json_build_object('id',m.id,'mime_type',m.mime_type,'file_name',m.file_name) ORDER BY m.sort_order) FROM showcase_post_media m WHERE m.post_id=showcase_posts.id),'[]'::json) media FROM showcase_posts WHERE creator_id=$1 AND deleted_at IS NULL AND visibility='public' ORDER BY created_at DESC LIMIT 12`, [p.id])).rows;
  // Contests this person took part in, newest first. The final rank exists once the contest is completed.
  p.contests = (await query(`SELECT c.id,c.name,c.type::text type,c.status::text status,c.starting_time,c.ending_time,cp.points,
           CASE WHEN c.status='completed' THEN cp.rank END rank,
           (SELECT count(*) FROM contest_participants x WHERE x.contest_id=c.id AND x.payment_status='paid')::int participant_count
         FROM contest_participants cp JOIN contests c ON c.id=cp.contest_id
         WHERE cp.participant_id=$1 AND cp.payment_status='paid' AND c.status IN('published','completed')
         ORDER BY c.starting_time DESC LIMIT 30`, [p.id])).rows;
  // A hirer's active job posts: open and still accepting applications.
  if (p.role === "hirer") p.job_posts = (await query(`SELECT j.id,j.title,j.status::text status,j.type::text type,j.salary_min,j.salary_max,j.currency,j.salary_period,j.location,j.is_remote,j.application_deadline,j.created_at,
             u.name creator_name,${catDetailsSql("jobs", "j")} category_details
           FROM jobs j JOIN users u ON u.id=j.creator_id
           WHERE j.creator_id=$1 AND j.status='open' AND(j.application_deadline IS NULL OR j.application_deadline>now())
           ORDER BY j.created_at DESC LIMIT 20`, [p.id])).rows;
  // Learner points: +10 per completed course; a finished contest scores by final position (1st most, top 10 positive), and falls to -10 outside the top 10.
  if (p.role === "learner") p.points = await one(`SELECT (c.courses*10 + k.score)::int total,c.courses::int courses,k.score::int contests,k.entered::int contests_finished
         FROM (SELECT count(*) courses FROM course_enrollments WHERE user_id=$1 AND status='completed') c,
              (SELECT coalesce(sum(${CONTEST_SCORE}),0) score,count(*) entered
               FROM contest_participants cp JOIN contests ct ON ct.id=cp.contest_id
               WHERE cp.participant_id=$1 AND cp.payment_status='paid' AND ct.status='completed' AND cp.rank IS NOT NULL) k`, [p.id]);
  if (isSelf || req.user.role === "admin") p.personal = await one("SELECT email::text email,phone,birth_date::text birth_date,gender,current_address,permanent_address FROM users WHERE id=$1", [p.id]);
  return p;
});
export const getProfileByIdPicture = run(async (req, res) => {
  const p = await one(`SELECT picture,picture_mime_type FROM users WHERE id=$1 AND account_status='active'`, [uuid(req.params.id)]);
  if (!p.picture) throw new ApiError(404, "Profile picture not found");
  res.set("Cache-Control", "private, max-age=300").type(p.picture_mime_type).send(p.picture);
});
export const getProfileByIdCover = run(async (req, res) => {
  const p = await one(`SELECT cover_image,cover_image_mime_type FROM users WHERE id=$1 AND account_status='active'`, [uuid(req.params.id)]);
  if (!p.cover_image) throw new ApiError(404, "Profile cover not found");
  res.set("Cache-Control", "private, max-age=300").type(p.cover_image_mime_type).send(p.cover_image);
});
export const updateProfile = run(async req => {
  let interestIds = req.body.interest_ids;
  try {
    if (typeof interestIds === "string") interestIds = JSON.parse(interestIds);
  } catch {
    throw new ApiError(422, "Invalid interest selection");
  }
  const b = z.object({
    name: z.string().trim().min(2).max(150),
    username: z.string().regex(/^[A-Za-z0-9_.-]{3,40}$/),
    bio: z.string().max(3000),
    headline: optionalText(200),
    phone: z.string().trim().max(30).regex(/^[0-9+()\-\s.]*$/, "Enter a valid phone number").optional().transform(v => v ? v : null),
    birth_date: z.string().optional(),
    gender: z.enum(["", "female", "male", "other", "prefer_not_to_say"]).optional(),
    current_address: optionalText(500),
    permanent_address: optionalText(500),
    interest_ids: z.array(z.string().uuid()).max(30),
    remove_picture: z.enum(["true", "false"]).optional(),
    remove_cover_image: z.enum(["true", "false"]).optional()
  }).parse({
    ...req.body,
    interest_ids: interestIds
  });
  const picture = req.files?.picture?.[0],
    cover = req.files?.cover_image?.[0];
  for (const file of [picture, cover]) if (file && !instructorImageTypes.has(file.mimetype)) throw new ApiError(422, "Use a JPEG, PNG, WebP, or AVIF image");
  await optimizeUpload(picture, "avatar");
  await optimizeUpload(cover, "cover");
  await tx(async db => {
    const values = [b.name, b.username, b.bio];
    const fields = ["name=$1", "username=$2", "bio=$3"];
    const add = (column, value) => {
      values.push(value);
      fields.push(`${column}=$${values.length}`);
    };
    const birth = asDate(b.birth_date);
    if (birth && new Date(birth) > new Date()) throw new ApiError(422, "Birth date cannot be in the future");
    add("headline", b.headline);
    add("phone", b.phone);
    add("birth_date", birth);
    add("gender", b.gender || null);
    add("current_address", b.current_address);
    add("permanent_address", b.permanent_address);
    if (picture) {
      add("picture", picture.buffer);
      add("picture_mime_type", picture.mimetype);
    } else if (b.remove_picture === "true") {
      add("picture", null);
      add("picture_mime_type", null);
    }
    if (cover) {
      add("cover_image", cover.buffer);
      add("cover_image_mime_type", cover.mimetype);
    } else if (b.remove_cover_image === "true") {
      add("cover_image", null);
      add("cover_image_mime_type", null);
    }
    values.push(req.user.sub);
    await db.query(`UPDATE users SET ${fields.join(",")} WHERE id=$${values.length}`, values);
    await db.query("DELETE FROM user_interests WHERE user_id=$1", [req.user.sub]);
    for (const id of new Set(b.interest_ids)) await db.query("INSERT INTO user_interests(user_id,interest_id) VALUES($1,$2)", [req.user.sub, id]);
  });
});
export const putProfileInterests = run(async req => {
  const body = z.object({
    interest_ids: z.array(z.string().uuid()).min(1, 'Choose at least one interest').max(30)
  }).strict().parse(req.body);
  const ids = [...new Set(body.interest_ids)];
  await tx(async db => {
    if ((await db.query('SELECT id FROM interest_categories WHERE id=ANY($1::uuid[]) AND is_active=true', [ids])).rowCount !== ids.length) throw new ApiError(422, 'One or more interests are not available');
    await db.query('DELETE FROM user_interests WHERE user_id=$1', [req.user.sub]);
    await db.query('INSERT INTO user_interests(user_id,interest_id) SELECT $1,unnest($2::uuid[])', [req.user.sub, ids]);
  });
  return {
    interest_ids: ids
  };
});
