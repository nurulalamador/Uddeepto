import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import {
  createApp,
  query,
  tx,
  asyncHandler,
  auth,
  allow,
  ApiError,
  listen,
  upload,
  multer,
} from "@uddeepto/common";
const app = createApp("frontend-api");
app.use(auth());
// Look up current roles and account state; never authorize from a stale role claim.
app.use(
  asyncHandler(async (req, _res, next) => {
    const u = (
      await query("SELECT id,role,account_status FROM users WHERE id=$1", [
        req.user.sub,
      ])
    ).rows[0];
    if (!u || u.account_status !== "active")
      throw new ApiError(401, "Account is not active");
    req.user.role = u.role;
    next();
  }),
);
const run = (fn) =>
  asyncHandler(async (req, res) => {
    const value = await fn(req, res);
    if (!res.headersSent) res.json(value ?? { ok: true });
  });
const uuid = (v) => z.string().uuid().parse(v);
const text = (v) => z.string().trim().min(1).max(10000).parse(v);
const paging = (req) => [
  Math.min(100, Math.max(1, parseInt(req.query.limit) || 20)),
  Math.max(0, parseInt(req.query.offset) || 0),
];
const admin = (req) => {
  if (req.user.role !== "admin") throw new ApiError(403, "Admin required");
};
const learner = (req) => {
  if (req.user.role === "hirer")
    throw new ApiError(403, "Learner permission required");
};
const one = async (sql, args) => {
  const r = await query(sql, args);
  if (!r.rowCount) throw new ApiError(404, "Not found");
  return r.rows[0];
};
const ownJob = async (req) => {
  const j = await one("SELECT creator_id FROM jobs WHERE id=$1", [
    uuid(req.params.id),
  ]);
  if (j.creator_id !== req.user.sub && req.user.role !== "admin")
    throw new ApiError(403, "Only the job owner can view applications");
};
async function communityAccess(req) {
  const c = await one(
    `SELECT c.*,m.status membership,m.is_moderator FROM communities c LEFT JOIN community_members m ON m.community_id=c.id AND m.member_id=$2 WHERE c.id=$1`,
    [uuid(req.params.id), req.user.sub],
  );
  c.can_manage =
    c.creator_id === req.user.sub ||
    req.user.role === "admin" ||
    (c.membership === "approved" && c.is_moderator);
  if (c.creator_id === req.user.sub || req.user.role === "admin")
    c.membership = "approved";
  return c;
}
async function requireMember(req) {
  const c = await communityAccess(req);
  if (c.membership !== "approved")
    throw new ApiError(403, "Approved membership required");
  return c;
}
async function conversationAccess(req) {
  await one(
    "SELECT 1 FROM conversation_members WHERE conversation_id=$1 AND user_id=$2",
    [uuid(req.params.id), req.user.sub],
  );
}
app.get(
  "/dashboard",
  run(async (req) => {
    const id = req.user.sub;
    if (req.user.role === "hirer")
      return {
        ...(await one(
          `SELECT (SELECT count(*) FROM jobs WHERE creator_id=$1) jobs,(SELECT count(*) FROM jobs WHERE creator_id=$1 AND status='open') open_jobs,(SELECT count(*) FROM job_applications a JOIN jobs j ON j.id=a.job_id WHERE j.creator_id=$1) applications,(SELECT count(*) FROM showcase_posts WHERE creator_id=$1 AND deleted_at IS NULL) posts`,
          [id],
        )),
        recent: (
          await query(
            "SELECT j.title,a.status FROM job_applications a JOIN jobs j ON j.id=a.job_id WHERE j.creator_id=$1 ORDER BY a.applied_at DESC LIMIT 5",
            [id],
          )
        ).rows,
      };
    return {
      ...(await one(
        `SELECT (SELECT count(*) FROM course_enrollments WHERE user_id=$1 AND status IN ('active','completed')) enrollments,(SELECT count(*) FROM contest_participants WHERE participant_id=$1) contests,(SELECT count(*) FROM community_members WHERE member_id=$1 AND status='approved') communities,(SELECT count(*) FROM job_applications WHERE applicant_id=$1) applications`,
        [id],
      )),
      recent: (
        await query(
          `SELECT c.title,e.status FROM course_enrollments e JOIN courses c ON c.id=e.course_id WHERE e.user_id=$1 AND e.status IN('active','completed') ORDER BY e.enrolled_at DESC LIMIT 5`,
          [id],
        )
      ).rows,
      upcoming: (
        await query(
          `SELECT id,name,status,starting_time FROM webinars WHERE status='scheduled' AND starting_time>now() ORDER BY starting_time LIMIT 3`,
        )
      ).rows,
    };
  }),
);
app.get(
  "/dashboard/learner",
  run(async (req) => {
    learner(req);
    const id = req.user.sub;
    const stats = await one(
      `SELECT
    (SELECT count(*) FROM course_enrollments WHERE user_id=$1 AND status IN('active','completed'))::int enrolled,
    (SELECT count(*) FROM course_enrollments WHERE user_id=$1 AND status='completed')::int completed_courses,
    (SELECT count(*) FROM completed_course_materials WHERE user_id=$1)::int materials_done,
    (SELECT count(*) FROM course_materials m JOIN course_enrollments e ON e.course_id=m.course_id AND e.user_id=$1 AND e.status IN('active','completed'))::int materials_total,
    (SELECT count(*) FROM contest_participants WHERE participant_id=$1)::int contests_joined,
    (SELECT count(*) FROM contest_participants p JOIN contests c ON c.id=p.contest_id WHERE p.participant_id=$1 AND p.rank BETWEEN 1 AND 3 AND c.status='completed')::int podiums,
    (SELECT count(*) FROM community_members WHERE member_id=$1 AND status='approved')::int communities,
    (SELECT count(*) FROM job_applications WHERE applicant_id=$1)::int applications,
    (SELECT count(*) FROM webinar_participants WHERE participant_id=$1 AND status IN('registered','attended'))::int webinars`,
      [id],
    );
    const continueLearning = (
      await query(
        `SELECT c.id,c.title,(c.cover_image IS NOT NULL) has_cover_image,ins.name instructor_name,e.status::text status,e.last_accessed_at,
      (SELECT count(*) FROM course_materials WHERE course_id=c.id)::int progress_total,
      (SELECT count(*) FROM completed_course_materials WHERE course_id=c.id AND user_id=$1)::int progress_done,
      coalesce((SELECT m.id FROM course_materials m WHERE m.course_id=c.id AND NOT EXISTS(SELECT 1 FROM completed_course_materials cm WHERE cm.material_id=m.id AND cm.user_id=$1) ORDER BY m.sort_order LIMIT 1),(SELECT m.id FROM course_materials m WHERE m.course_id=c.id ORDER BY m.sort_order LIMIT 1)) next_material_id
    FROM course_enrollments e JOIN courses c ON c.id=e.course_id LEFT JOIN instructors ins ON ins.id=c.instructor_id
    WHERE e.user_id=$1 AND e.status IN('active','completed') ORDER BY (e.status='active') DESC,e.last_accessed_at DESC NULLS LAST,e.enrolled_at DESC LIMIT 4`,
        [id],
      )
    ).rows;
    const activity = (
      await query(
        `SELECT d.day::date::text AS day,coalesce(a.n,0)::int AS count
    FROM generate_series((now() AT TIME ZONE 'Asia/Dhaka')::date-13,(now() AT TIME ZONE 'Asia/Dhaka')::date,interval '1 day') AS d(day)
    LEFT JOIN(SELECT (completed_at AT TIME ZONE 'Asia/Dhaka')::date AS day,count(*) AS n FROM completed_course_materials WHERE user_id=$1 AND completed_at>now()-interval '16 days' GROUP BY 1) a ON a.day=d.day::date ORDER BY d.day`,
        [id],
      )
    ).rows;
    const activeDays = new Set(
      (
        await query(
          `SELECT DISTINCT (completed_at AT TIME ZONE 'Asia/Dhaka')::date::text AS day FROM completed_course_materials WHERE user_id=$1 AND completed_at>now()-interval '90 days'`,
          [id],
        )
      ).rows.map((row) => row.day),
    );
    const todayDhaka = (
      await one("SELECT (now() AT TIME ZONE 'Asia/Dhaka')::date::text today")
    ).today;
    let streak = 0;
    for (
      let cursor = new Date(todayDhaka + "T00:00:00Z"), first = true;
      streak <= 90;
      cursor.setUTCDate(cursor.getUTCDate() - 1), first = false
    ) {
      if (activeDays.has(cursor.toISOString().slice(0, 10))) streak++;
      else if (!first) break;
    }
    const schedule = (
      await query(
        `SELECT * FROM(
      SELECT 'webinar'::text kind,w.id,w.name,w.starting_time,w.ending_time FROM webinar_participants p JOIN webinars w ON w.id=p.webinar_id WHERE p.participant_id=$1 AND p.status='registered' AND w.ending_time>now() AND w.status IN('scheduled','live')
      UNION ALL
      SELECT 'contest'::text,c.id,c.name,c.starting_time,c.ending_time FROM contest_participants p JOIN contests c ON c.id=p.contest_id WHERE p.participant_id=$1 AND c.ending_time>now() AND c.status='published'
    ) s ORDER BY starting_time LIMIT 6`,
        [id],
      )
    ).rows;
    const discover = (
      await query(
        `SELECT * FROM(
      SELECT 'webinar'::text kind,w.id,w.name,w.starting_time,w.ending_time FROM webinars w WHERE w.status IN('scheduled','live') AND w.ending_time>now() AND NOT EXISTS(SELECT 1 FROM webinar_participants p WHERE p.webinar_id=w.id AND p.participant_id=$1 AND p.status IN('registered','attended'))
      UNION ALL
      SELECT 'contest'::text,c.id,c.name,c.starting_time,c.ending_time FROM contests c WHERE c.status='published' AND c.ending_time>now() AND NOT EXISTS(SELECT 1 FROM contest_participants p WHERE p.contest_id=c.id AND p.participant_id=$1)
    ) s ORDER BY starting_time LIMIT 4`,
        [id],
      )
    ).rows;
    const applications = (
      await query(
        `SELECT a.job_id,j.title,u.name company,a.status::text status,a.applied_at FROM job_applications a JOIN jobs j ON j.id=a.job_id JOIN users u ON u.id=j.creator_id WHERE a.applicant_id=$1 ORDER BY a.applied_at DESC LIMIT 4`,
        [id],
      )
    ).rows;
    const communities = (
      await query(
        `SELECT c.id,c.name,(SELECT count(*) FROM community_members WHERE community_id=c.id AND status='approved')::int member_count FROM communities c JOIN community_members m ON m.community_id=c.id AND m.member_id=$1 AND m.status='approved' ORDER BY m.approved_at DESC NULLS LAST LIMIT 4`,
        [id],
      )
    ).rows;
    const flags = await one(
      `SELECT (picture IS NOT NULL) picture,coalesce(headline,'')<>'' headline,coalesce(bio,'')<>'' bio,EXISTS(SELECT 1 FROM user_interests WHERE user_id=$1) interests,EXISTS(SELECT 1 FROM user_education WHERE user_id=$1) education,EXISTS(SELECT 1 FROM user_experiences WHERE user_id=$1) experience FROM users WHERE id=$1`,
      [id],
    );
    const checklist = [
      ["picture", "Add a profile picture"],
      ["headline", "Write a headline"],
      ["bio", "Tell people about yourself"],
      ["interests", "Choose your interests"],
      ["education", "Add your education"],
      ["experience", "Add your experience"],
    ].map(([key, label]) => ({ key, label, done: flags[key] }));
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
        percent: Math.round(
          (100 * checklist.filter((item) => item.done).length) /
            checklist.length,
        ),
        checklist,
      },
    };
  }),
);
app.get(
  "/people",
  run(
    async (req) =>
      (
        await query(
          `SELECT id,uddeepto_id,name,username,role,(picture IS NOT NULL) has_picture FROM users WHERE account_status='active' AND (name ILIKE $1 OR username::text ILIKE $1 OR uddeepto_id ILIKE $1) ORDER BY name LIMIT 30`,
          [`%${String(req.query.q || "").slice(0, 100)}%`],
        )
      ).rows,
  ),
);
const uddeeptoIdPattern = /^\d{3}-\d{3}-\d{3}$/;
const asDate = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const text = String(value);
  const full = /^\d{4}-\d{2}$/.test(text) ? `${text}-01` : text;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(full) || Number.isNaN(Date.parse(full)))
    throw new ApiError(422, "Enter a valid date");
  return full;
};
const monthDate = z
  .string()
  .regex(/^\d{4}-\d{2}(-\d{2})?$/, "Enter a valid date");
const optionalText = (max) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : null));
app.get(
  "/profile/:id",
  run(async (req) => {
    const ref = String(req.params.id);
    const byUddeeptoId = uddeeptoIdPattern.test(ref);
    const p = await one(
      `SELECT id,uddeepto_id,name,username,headline,bio,role::text role,created_at,(picture IS NOT NULL) has_picture,(cover_image IS NOT NULL) has_cover_image FROM users WHERE ${byUddeeptoId ? "uddeepto_id" : "id"}=$1 AND account_status='active'`,
      [byUddeeptoId ? ref : uuid(ref)],
    );
    const isSelf = p.id === req.user.sub;
    p.is_self = isSelf;
    p.interests = (
      await query(
        "SELECT i.id,i.name,i.icon FROM user_interests ui JOIN interest_categories i ON i.id=ui.interest_id WHERE ui.user_id=$1 ORDER BY i.name",
        [p.id],
      )
    ).rows;
    p.education = (
      await query(
        "SELECT id,institution,degree,field_of_study,start_date::text start_date,end_date::text end_date,grade,description FROM user_education WHERE user_id=$1 ORDER BY (end_date IS NULL) DESC,coalesce(end_date,start_date) DESC,start_date DESC",
        [p.id],
      )
    ).rows;
    p.experience = (
      await query(
        "SELECT e.id,e.title,e.workplace,e.location,e.category_id,ic.name category_name,ic.icon category_icon,e.start_date::text start_date,e.end_date::text end_date,e.description FROM user_experiences e JOIN interest_categories ic ON ic.id=e.category_id WHERE e.user_id=$1 ORDER BY (e.end_date IS NULL) DESC,coalesce(e.end_date,e.start_date) DESC,e.start_date DESC",
        [p.id],
      )
    ).rows;
    p.posts = (
      await query(
        `SELECT id,content FROM showcase_posts WHERE creator_id=$1 AND deleted_at IS NULL AND visibility='public' ORDER BY created_at DESC LIMIT 12`,
        [p.id],
      )
    ).rows;
    if (isSelf || req.user.role === "admin")
      p.personal = await one(
        "SELECT email::text email,phone,birth_date::text birth_date,gender,current_address,permanent_address FROM users WHERE id=$1",
        [p.id],
      );
    return p;
  }),
);
app.get(
  "/profile/:id/picture",
  run(async (req, res) => {
    const p = await one(
      `SELECT picture,picture_mime_type FROM users WHERE id=$1 AND account_status='active'`,
      [uuid(req.params.id)],
    );
    if (!p.picture) throw new ApiError(404, "Profile picture not found");
    res
      .set("Cache-Control", "private, max-age=300")
      .type(p.picture_mime_type)
      .send(p.picture);
  }),
);
app.get(
  "/profile/:id/cover",
  run(async (req, res) => {
    const p = await one(
      `SELECT cover_image,cover_image_mime_type FROM users WHERE id=$1 AND account_status='active'`,
      [uuid(req.params.id)],
    );
    if (!p.cover_image) throw new ApiError(404, "Profile cover not found");
    res
      .set("Cache-Control", "private, max-age=300")
      .type(p.cover_image_mime_type)
      .send(p.cover_image);
  }),
);
app.patch(
  "/profile",
  upload.fields([
    { name: "picture", maxCount: 1 },
    { name: "cover_image", maxCount: 1 },
  ]),
  run(async (req) => {
    let interestIds = req.body.interest_ids;
    try {
      if (typeof interestIds === "string")
        interestIds = JSON.parse(interestIds);
    } catch {
      throw new ApiError(422, "Invalid interest selection");
    }
    const b = z
      .object({
        name: z.string().trim().min(2).max(150),
        username: z.string().regex(/^[A-Za-z0-9_.-]{3,40}$/),
        bio: z.string().max(3000),
        headline: optionalText(200),
        phone: z
          .string()
          .trim()
          .max(30)
          .regex(/^[0-9+()\-\s.]*$/, "Enter a valid phone number")
          .optional()
          .transform((v) => (v ? v : null)),
        birth_date: z.string().optional(),
        gender: z
          .enum(["", "female", "male", "other", "prefer_not_to_say"])
          .optional(),
        current_address: optionalText(500),
        permanent_address: optionalText(500),
        interest_ids: z.array(z.string().uuid()).max(30),
        remove_picture: z.enum(["true", "false"]).optional(),
        remove_cover_image: z.enum(["true", "false"]).optional(),
      })
      .parse({ ...req.body, interest_ids: interestIds });
    const picture = req.files?.picture?.[0],
      cover = req.files?.cover_image?.[0];
    for (const file of [picture, cover])
      if (file && !instructorImageTypes.has(file.mimetype))
        throw new ApiError(422, "Use a JPEG, PNG, WebP, or AVIF image");
    await tx(async (db) => {
      const values = [b.name, b.username, b.bio];
      const fields = ["name=$1", "username=$2", "bio=$3"];
      const add = (column, value) => {
        values.push(value);
        fields.push(`${column}=$${values.length}`);
      };
      const birth = asDate(b.birth_date);
      if (birth && new Date(birth) > new Date())
        throw new ApiError(422, "Birth date cannot be in the future");
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
      await db.query(
        `UPDATE users SET ${fields.join(",")} WHERE id=$${values.length}`,
        values,
      );
      await db.query("DELETE FROM user_interests WHERE user_id=$1", [
        req.user.sub,
      ]);
      for (const id of new Set(b.interest_ids))
        await db.query(
          "INSERT INTO user_interests(user_id,interest_id) VALUES($1,$2)",
          [req.user.sub, id],
        );
    });
  }),
);
const educationBody = z
  .object({
    institution: z.string().trim().min(1).max(200),
    degree: optionalText(200),
    field_of_study: optionalText(200),
    start_date: monthDate,
    end_date: z.string().optional(),
    grade: optionalText(100),
    description: optionalText(2000),
  })
  .strict();
const experienceBody = z
  .object({
    title: z.string().trim().min(1).max(200),
    workplace: z.string().trim().min(1).max(200),
    category_id: z.string().uuid(),
    location: optionalText(200),
    start_date: monthDate,
    end_date: z.string().optional(),
    description: optionalText(2000),
  })
  .strict();
const timeline = (body) => {
  const start = asDate(body.start_date),
    end = asDate(body.end_date);
  if (end && end < start)
    throw new ApiError(422, "The end date must be after the start date");
  return [start, end];
};
function timelineRoutes(route, table, schema, columns, label) {
  const columnList = columns.join(",");
  const values = (body) => {
    const [start, end] = timeline(body);
    return columns.map((c) =>
      c === "start_date" ? start : c === "end_date" ? end : (body[c] ?? null),
    );
  };
  app.post(
    `/profile/${route}`,
    run(async (req) => {
      const body = schema.parse(req.body);
      const v = values(body);
      if (
        Number(
          (
            await one(`SELECT count(*) FROM ${table} WHERE user_id=$1`, [
              req.user.sub,
            ])
          ).count,
        ) >= 30
      )
        throw new ApiError(409, `You can add up to 30 ${label} entries`);
      if (
        body.category_id &&
        !(
          await query("SELECT 1 FROM interest_categories WHERE id=$1", [
            body.category_id,
          ])
        ).rowCount
      )
        throw new ApiError(422, "Choose a valid interest");
      return (
        await query(
          `INSERT INTO ${table}(user_id,${columnList}) VALUES($1,${columns.map((_, n) => "$" + (n + 2)).join(",")}) RETURNING id`,
          [req.user.sub, ...v],
        )
      ).rows[0];
    }),
  );
  app.patch(
    `/profile/${route}/:entryId`,
    run(async (req) => {
      const body = schema.parse(req.body);
      const v = values(body);
      if (
        body.category_id &&
        !(
          await query("SELECT 1 FROM interest_categories WHERE id=$1", [
            body.category_id,
          ])
        ).rowCount
      )
        throw new ApiError(422, "Choose a valid interest");
      const result = await query(
        `UPDATE ${table} SET ${columns.map((c, n) => c + "=$" + (n + 3)).join(",")} WHERE id=$1 AND user_id=$2`,
        [uuid(req.params.entryId), req.user.sub, ...v],
      );
      if (!result.rowCount) throw new ApiError(404, "Entry not found");
    }),
  );
  app.delete(
    `/profile/${route}/:entryId`,
    run(async (req) => {
      const result = await query(
        `DELETE FROM ${table} WHERE id=$1 AND user_id=$2`,
        [uuid(req.params.entryId), req.user.sub],
      );
      if (!result.rowCount) throw new ApiError(404, "Entry not found");
    }),
  );
}
timelineRoutes(
  "education",
  "user_education",
  educationBody,
  [
    "institution",
    "degree",
    "field_of_study",
    "start_date",
    "end_date",
    "grade",
    "description",
  ],
  "education",
);
timelineRoutes(
  "experience",
  "user_experiences",
  experienceBody,
  [
    "title",
    "workplace",
    "category_id",
    "location",
    "start_date",
    "end_date",
    "description",
  ],
  "experience",
);
const showcaseProjection = `p.id,p.creator_id,p.content,p.created_at,u.name creator_name,(u.picture IS NOT NULL) creator_has_picture,i.name category_name,(SELECT count(*) FROM showcase_post_reactions WHERE post_id=p.id) reactions,(SELECT count(*) FROM showcase_post_comments WHERE post_id=p.id AND deleted_at IS NULL) comments,EXISTS(SELECT 1 FROM showcase_post_reactions WHERE post_id=p.id AND user_id=$1 AND reaction='love') my_reaction,COALESCE((SELECT json_agg(json_build_object('id',m.id,'mime_type',m.mime_type,'file_name',m.file_name) ORDER BY m.sort_order) FROM showcase_post_media m WHERE m.post_id=p.id),'[]'::json) media`;
const showcaseFrom =
  "FROM showcase_posts p JOIN users u ON u.id=p.creator_id JOIN interest_categories i ON i.id=p.category_id";
app.get(
  "/showcase",
  run(async (req) => {
    const [limit, offset] = paging(req);
    return (
      await query(
        `SELECT ${showcaseProjection} ${showcaseFrom} WHERE p.deleted_at IS NULL AND p.visibility='public' AND p.content ILIKE $2 AND($3::uuid IS NULL OR p.category_id=$3) ORDER BY p.created_at DESC LIMIT $4 OFFSET $5`,
        [
          req.user.sub,
          `%${String(req.query.q || "").slice(0, 200)}%`,
          req.query.category ? uuid(req.query.category) : null,
          limit,
          offset,
        ],
      )
    ).rows;
  }),
);
app.get(
  "/showcase/:id",
  run(async (req) =>
    one(
      `SELECT ${showcaseProjection} ${showcaseFrom} WHERE p.id=$2 AND p.deleted_at IS NULL AND p.visibility='public'`,
      [req.user.sub, uuid(req.params.id)],
    ),
  ),
);
app.get(
  "/showcase/:id/media/:mediaId",
  auth(false),
  run(async (req, res) => {
    const media = await one(
      "SELECT mime_type,media_blob,file_name FROM showcase_post_media m JOIN showcase_posts p ON p.id=m.post_id WHERE m.id=$1 AND m.post_id=$2 AND p.deleted_at IS NULL AND p.visibility='public'",
      [uuid(req.params.mediaId), uuid(req.params.id)],
    );
    if (!media) throw new ApiError(404, "Media not found");
    res
      .set({
        "Content-Type": media.mime_type,
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(String(media.file_name || "media"))}`,
        "Cache-Control": "private, max-age=300",
        "X-Content-Type-Options": "nosniff",
      })
      .send(Buffer.from(media.media_blob));
  }),
);
app.get(
  "/instructors/:id/image",
  run(async (req, res) => {
    const instructor = await one(
      "SELECT image_blob,image_mime_type FROM instructors WHERE id=$1",
      [uuid(req.params.id)],
    );
    if (!instructor.image_blob)
      throw new ApiError(404, "Instructor image not found");
    res
      .set("Cache-Control", "private, max-age=300")
      .type(instructor.image_mime_type)
      .send(instructor.image_blob);
  }),
);
app.get(
  "/course-covers/:id",
  run(async (req, res) => {
    const course = await one(
      `SELECT cover_image,cover_image_mime_type FROM courses WHERE id=$1 AND(status='published' OR creator_id=$2 OR $3='admin')`,
      [uuid(req.params.id), req.user.sub, req.user.role],
    );
    if (!course.cover_image) throw new ApiError(404, "Course cover not found");
    res
      .set("Cache-Control", "private, max-age=300")
      .type(course.cover_image_mime_type)
      .send(course.cover_image);
  }),
);
const noHirer = asyncHandler(async (req, _res, next) => {
  const account = (
    await query("SELECT role FROM users WHERE id=$1", [req.user.sub])
  ).rows[0];
  if (account?.role === "hirer")
    throw new ApiError(
      403,
      "Hiring accounts can view the showcase but not post to it",
    );
  next();
});
app.post(
  "/showcase",
  auth(),
  noHirer,
  upload.array("media", 10),
  run(async (req) => {
    const files = req.files || [];
    if (
      files.some(
        (file) =>
          !["image", "audio", "video"].includes(file.mimetype.split("/")[0]),
      )
    )
      throw new ApiError(422, "Only image, audio, and video files are allowed");
    return tx(async (db) => {
      const post = (
        await db.query(
          "INSERT INTO showcase_posts(creator_id,category_id,content,visibility) VALUES($1,$2,$3,$4) RETURNING *",
          [
            req.user.sub,
            req.body.category_id,
            text(req.body.content),
            req.body.visibility || "public",
          ],
        )
      ).rows[0];
      for (const [index, file] of files.entries())
        await db.query(
          "INSERT INTO showcase_post_media(post_id,mime_type,media_blob,file_name,sort_order) VALUES($1,$2,$3,$4,$5)",
          [
            post.id,
            file.mimetype,
            file.buffer,
            decodeName(file.originalname).slice(0, 255),
            index,
          ],
        );
      return post;
    });
  }),
);
async function visiblePost(id) {
  return one(
    `SELECT id FROM showcase_posts WHERE id=$1 AND visibility='public' AND deleted_at IS NULL`,
    [uuid(id)],
  );
}
app.delete(
  "/showcase/:id",
  run(async (req) => {
    const r = await query(
      "UPDATE showcase_posts SET deleted_at=now() WHERE id=$1 AND(creator_id=$2 OR $3='admin') RETURNING id",
      [uuid(req.params.id), req.user.sub, req.user.role],
    );
    if (!r.rowCount) throw new ApiError(403, "Not your post");
  }),
);
async function toggleReaction(table, field, id, user) {
  await tx(async (db) => {
    await db.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
      `${table}:${id}:${user}`,
    ]);
    const removed = await db.query(
      `DELETE FROM ${table} WHERE ${field}=$1 AND user_id=$2 AND reaction='love'`,
      [id, user],
    );
    if (!removed.rowCount)
      await db.query(
        `INSERT INTO ${table}(${field},user_id,reaction) VALUES($1,$2,'love')`,
        [id, user],
      );
  });
}
app.put(
  "/showcase/:id/reaction",
  run(async (req) => {
    await visiblePost(req.params.id);
    await toggleReaction(
      "showcase_post_reactions",
      "post_id",
      req.params.id,
      req.user.sub,
    );
  }),
);
app.get(
  "/showcase/:id/comments",
  run(async (req) => {
    await visiblePost(req.params.id);
    return (
      await query(
        `SELECT c.id,c.commenter_id,c.content,u.name,(u.picture IS NOT NULL) commenter_has_picture,(SELECT count(*) FROM showcase_post_comment_reactions WHERE comment_id=c.id) reactions,EXISTS(SELECT 1 FROM showcase_post_comment_reactions WHERE comment_id=c.id AND user_id=$2 AND reaction='love') my_reaction FROM showcase_post_comments c JOIN users u ON u.id=c.commenter_id WHERE c.post_id=$1 AND c.deleted_at IS NULL ORDER BY c.created_at LIMIT 100`,
        [req.params.id, req.user.sub],
      )
    ).rows;
  }),
);
app.post(
  "/showcase/:id/comments",
  run(async (req) => {
    await visiblePost(req.params.id);
    return (
      await query(
        "INSERT INTO showcase_post_comments(post_id,commenter_id,content) VALUES($1,$2,$3) RETURNING id",
        [req.params.id, req.user.sub, text(req.body.content)],
      )
    ).rows[0];
  }),
);
app.put(
  "/comments/:id/reaction",
  run(async (req) => {
    const c = await one(
      "SELECT post_id FROM showcase_post_comments WHERE id=$1 AND deleted_at IS NULL",
      [uuid(req.params.id)],
    );
    await visiblePost(c.post_id);
    await toggleReaction(
      "showcase_post_comment_reactions",
      "comment_id",
      req.params.id,
      req.user.sub,
    );
  }),
);
const catalogs = {
  courses: {
    title: "title",
    columns: "price,currency,slug",
    visible: "status='published'",
  },
  contests: {
    title: "name",
    columns:
      "type,entry_fee,currency,starting_time,ending_time,max_participants",
    visible: "status IN ('published','completed','cancelled')",
  },
  webinars: {
    title: "name",
    columns: "capacity,starting_time,ending_time",
    visible: "status IN ('scheduled','live','completed','cancelled')",
  },
  communities: { title: "name", columns: "slug,is_private", visible: "true" },
};
app.get(
  "/catalog/:kind",
  run(async (req) => {
    learner(req);
    const { kind } = req.params;
    const cfg = catalogs[kind];
    if (!cfg) throw new ApiError(404, "Unknown catalog");
    const [limit, offset] = paging(req);
    const args = [
      req.user.sub,
      `%${String(req.query.q || "").slice(0, 200)}%`,
      req.query.category ? uuid(req.query.category) : null,
      limit,
      offset,
    ];
    let filter = `t.${cfg.visible}`;
    if (kind === "communities")
      filter =
        req.query.tab === "explore"
          ? "NOT EXISTS(SELECT 1 FROM community_members WHERE community_id=t.id AND member_id=$1 AND status='approved') AND t.creator_id<>$1"
          : "true";
    if (req.query.tab === "recommended" && kind === "courses")
      filter += ` AND NOT EXISTS(SELECT 1 FROM course_enrollments WHERE course_id=t.id AND user_id=$1 AND status IN('active','completed')) AND EXISTS(SELECT 1 FROM user_interests ui WHERE ui.user_id=$1 AND(ui.interest_id=t.category_id OR EXISTS(SELECT 1 FROM course_categories cc WHERE cc.course_id=t.id AND cc.category_id=ui.interest_id)))`;
    if (req.query.tab === "enrolled" && kind === "courses")
      filter += ` AND EXISTS(SELECT 1 FROM course_enrollments WHERE course_id=t.id AND user_id=$1 AND status IN('active','completed'))`;
    if (["webinars", "contests"].includes(kind)) {
      const tab = req.query.tab;
      if (tab === "ongoing")
        filter += ` AND starting_time<=now() AND ending_time>=now() AND t.status NOT IN('completed','cancelled')`;
      if (tab === "upcoming")
        filter += ` AND starting_time>now() AND t.status NOT IN('completed','cancelled')`;
      if (tab === "previous")
        filter += ` AND(ending_time<now() OR t.status IN('completed','cancelled'))`;
    }
    const extras =
      kind === "courses"
        ? `,EXISTS(SELECT 1 FROM course_enrollments WHERE course_id=t.id AND user_id=$1 AND status IN('active','completed')) enrolled`
        : kind === "communities"
          ? `,(SELECT count(*) FROM community_members WHERE community_id=t.id AND status='approved') member_count,(SELECT status::text FROM community_members WHERE community_id=t.id AND member_id=$1) membership,($1::uuid IS NOT NULL) authenticated`
          : kind === "webinars"
            ? `,(SELECT count(*) FROM webinar_participants WHERE webinar_id=t.id AND status IN('registered','attended')) participant_count,EXISTS(SELECT 1 FROM webinar_participants WHERE webinar_id=t.id AND participant_id=$1 AND status IN('registered','attended')) joined,${speakersJsonSql("t")} speakers`
            : kind === "contests"
              ? `,(SELECT count(*) FROM contest_participants WHERE contest_id=t.id) participant_count,EXISTS(SELECT 1 FROM contest_participants WHERE contest_id=t.id AND participant_id=$1 AND payment_status='paid') joined`
              : ",($1::uuid IS NOT NULL) authenticated";
    const courseSorts = {
      price: "t.price",
      materials: "(SELECT count(*) FROM course_materials WHERE course_id=t.id)",
      learners:
        "(SELECT count(*) FROM course_enrollments WHERE course_id=t.id AND status IN('active','completed'))",
    };
    const sortColumn =
      kind === "courses"
        ? courseSorts[String(req.query.sort || "")]
        : undefined;
    const contestOrder = {
      ongoing: "t.ending_time ASC",
      upcoming: "t.starting_time ASC",
      previous: "t.ending_time DESC",
    }[String(req.query.tab || "")];
    const orderBy =
      ["contests", "webinars"].includes(kind) && contestOrder
        ? `${contestOrder}, t.created_at DESC`
        : sortColumn
          ? `${sortColumn} ${req.query.direction === "asc" ? "ASC" : "DESC"}, t.created_at DESC`
          : "t.created_at DESC";
    const progressFields =
      kind === "courses"
        ? ",(SELECT count(*) FROM course_materials WHERE course_id=t.id) progress_total,(SELECT count(*) FROM completed_course_materials WHERE course_id=t.id AND user_id=$1) progress_done"
        : "";
    const instructorFields =
      kind === "courses"
        ? ",t.instructor_id,ins.name instructor_name,ins.designation instructor_designation,ins.details instructor_details,ins.image_mime_type instructor_image_mime_type,(ins.image_blob IS NOT NULL) instructor_has_image"
        : "";
    const courseCoverFields =
      kind === "courses"
        ? ",t.cover_image_mime_type,(t.cover_image IS NOT NULL) has_cover_image"
        : "";
    const instructorJoin =
      kind === "courses"
        ? " LEFT JOIN instructors ins ON ins.id=t.instructor_id"
        : "";
    return (
      await query(
        `SELECT t.id,t.${cfg.title},t.description,${kind === "communities" ? "'active' AS status" : "t.status"},${cfg.columns
          .split(",")
          .map((c) => "t." + c)
          .join(
            ",",
          )},u.name creator_name,${catNamesSql(kind, "t")} category_name,${catIdsSql(kind, "t")} category_ids,${catDetailsSql(kind, "t")} category_details ${progressFields} ${instructorFields} ${courseCoverFields} ${extras} FROM ${kind} t JOIN users u ON u.id=t.creator_id JOIN interest_categories i ON i.id=t.category_id${instructorJoin} WHERE ${filter} AND(t.${cfg.title} ILIKE $2 OR t.description ILIKE $2) AND($3::uuid IS NULL OR t.category_id=$3 OR EXISTS(SELECT 1 FROM ${catTables[kind][0]} cc WHERE cc.${catTables[kind][1]}=t.id AND cc.category_id=$3)) ORDER BY ${orderBy} LIMIT $4 OFFSET $5`,
        args,
      )
    ).rows;
  }),
);
app.get(
  "/detail/:kind/:id",
  run(async (req) => {
    learner(req);
    const { kind } = req.params;
    uuid(req.params.id);
    if (!["courses", "contests", "webinars"].includes(kind))
      throw new ApiError(404, "Unknown kind");
    const cfg = catalogs[kind];
    const t = await one(
      `SELECT id,creator_id FROM ${kind} WHERE id=$1 AND(${cfg.visible} OR creator_id=$2 OR $3='admin')`,
      [req.params.id, req.user.sub, req.user.role],
    );
    if (kind === "courses") {
      const enrollment = await query(
        `SELECT status FROM course_enrollments WHERE course_id=$1 AND user_id=$2 AND status IN('active','completed')`,
        [t.id, req.user.sub],
      );
      return {
        enrolled: !!enrollment.rowCount,
        materials: (
          await query(
            `SELECT m.id,m.name,m.is_preview,m.content_blob IS NOT NULL has_blob,EXISTS(SELECT 1 FROM completed_course_materials WHERE material_id=m.id AND user_id=$2) completed FROM course_materials m WHERE course_id=$1 ORDER BY sort_order`,
            [t.id, req.user.sub],
          )
        ).rows,
      };
    }
    const participants = await query(
      `SELECT 1 FROM ${kind === "contests" ? "contest" : "webinar"}_participants WHERE ${kind === "contests" ? "contest" : "webinar"}_id=$1 AND participant_id=$2 ${kind === "webinars" ? "AND status IN('registered','attended')" : "AND payment_status='paid'"}`,
      [t.id, req.user.sub],
    );
    if (kind === "webinars")
      return {
        joined: !!participants.rowCount,
        meeting_url: participants.rowCount
          ? (await one("SELECT meeting_url FROM webinars WHERE id=$1", [t.id]))
              .meeting_url
          : null,
      };
    const started = await query(
      "SELECT 1 FROM contests WHERE id=$1 AND starting_time<=now()",
      [t.id],
    );
    return {
      joined: !!participants.rowCount,
      problems: started.rowCount
        ? (
            await query(
              "SELECT id,name,description,points,sample_input,sample_output FROM contest_problems WHERE contest_id=$1 ORDER BY sort_order",
              [t.id],
            )
          ).rows
        : [],
      leaderboard: (
        await query(
          "SELECT u.id,u.name,p.points FROM contest_participants p JOIN users u ON u.id=p.participant_id WHERE contest_id=$1 ORDER BY points DESC,participated_at LIMIT 50",
          [t.id],
        )
      ).rows,
    };
  }),
);
app.put(
  "/courses/:id/complete/:materialId",
  run(async (req) => {
    learner(req);
    await tx(async (db) => {
      const e = await db.query(
        `SELECT 1 FROM course_enrollments WHERE course_id=$1 AND user_id=$2 AND status IN('active','completed') FOR UPDATE`,
        [uuid(req.params.id), req.user.sub],
      );
      if (!e.rowCount) throw new ApiError(403, "Enrollment required");
      await completeMaterial(
        db,
        req.params.id,
        req.user.sub,
        uuid(req.params.materialId),
      );
    });
  }),
);
const webinarPhase =
  "CASE WHEN w.status IN('completed','cancelled') OR w.ending_time<now() THEN 'previous' WHEN w.starting_time>now() THEN 'upcoming' ELSE 'ongoing' END";
app.get(
  "/webinars/:id",
  run(async (req) => {
    learner(req);
    const w = await one(
      `SELECT w.id,w.name,w.description,w.status::text status,w.capacity,w.starting_time,w.ending_time,w.recording_url,w.meeting_url _meeting,u.name creator_name,${catNamesSql("webinars", "w")} category_name,${catDetailsSql("webinars", "w")} category_details,${speakersJsonSql("w")} speakers,(SELECT count(*) FROM webinar_participants WHERE webinar_id=w.id AND status IN('registered','attended')) participant_count,EXISTS(SELECT 1 FROM webinar_participants WHERE webinar_id=w.id AND participant_id=$2 AND status IN('registered','attended')) joined,${webinarPhase} phase FROM webinars w JOIN users u ON u.id=w.creator_id WHERE w.id=$1 AND(w.status IN('scheduled','live','completed','cancelled') OR w.creator_id=$2 OR $3='admin')`,
      [uuid(req.params.id), req.user.sub, req.user.role],
    );
    const meetingUrl =
      (w.joined || req.user.role === "admin") && w.phase !== "previous"
        ? w._meeting
        : null;
    delete w._meeting;
    return {
      ...w,
      meeting_url: meetingUrl,
      recording_url: w.phase === "previous" ? w.recording_url : null,
    };
  }),
);
app.post(
  "/webinars/:id/join",
  run(async (req) => {
    learner(req);
    await tx(async (db) => {
      const w = (
        await db.query("SELECT * FROM webinars WHERE id=$1 FOR UPDATE", [
          uuid(req.params.id),
        ])
      ).rows[0];
      if (
        !w ||
        !["scheduled", "live"].includes(w.status) ||
        new Date(w.ending_time) < new Date()
      )
        throw new ApiError(409, "Registration closed");
      const existing = await db.query(
        `SELECT 1 FROM webinar_participants WHERE webinar_id=$1 AND participant_id=$2 AND status IN('registered','attended')`,
        [w.id, req.user.sub],
      );
      if (existing.rowCount) return;
      const count = Number(
        (
          await db.query(
            `SELECT count(*) FROM webinar_participants WHERE webinar_id=$1 AND status IN('registered','attended')`,
            [w.id],
          )
        ).rows[0].count,
      );
      if (w.capacity && count >= w.capacity)
        throw new ApiError(409, "Webinar is full");
      await db.query(
        `INSERT INTO webinar_participants(webinar_id,participant_id) VALUES($1,$2) ON CONFLICT(webinar_id,participant_id) DO UPDATE SET status='registered'`,
        [w.id, req.user.sub],
      );
    });
  }),
);
app.post(
  "/contests/:id/join",
  run(async (req) => {
    learner(req);
    await tx(async (db) => {
      const c = (
        await db.query("SELECT * FROM contests WHERE id=$1 FOR UPDATE", [
          uuid(req.params.id),
        ])
      ).rows[0];
      if (
        !c ||
        c.status !== "published" ||
        new Date(c.ending_time) < new Date()
      )
        throw new ApiError(409, "Contest unavailable");
      if (Number(c.entry_fee) > 0)
        throw new ApiError(
          402,
          "Paid entries need a payment provider; contact the organizer.",
        );
      if (
        (
          await db.query(
            "SELECT 1 FROM contest_participants WHERE contest_id=$1 AND participant_id=$2",
            [c.id, req.user.sub],
          )
        ).rowCount
      )
        return;
      const n = Number(
        (
          await db.query(
            "SELECT count(*) FROM contest_participants WHERE contest_id=$1",
            [c.id],
          )
        ).rows[0].count,
      );
      if (c.max_participants && n >= c.max_participants)
        throw new ApiError(409, "Contest is full");
      await db.query(
        `INSERT INTO contest_participants(contest_id,participant_id,payment_status) VALUES($1,$2,'paid')`,
        [c.id, req.user.sub],
      );
    });
  }),
);
const contestKindSql = `(SELECT CASE WHEN k.kind='text' THEN CASE c.type::text WHEN 'competitive_programming' THEN 'code' WHEN 'singing' THEN 'audio' WHEN 'drawing' THEN 'image' ELSE 'text' END ELSE k.kind END FROM (SELECT CASE WHEN bool_or(ic.submission_kind='audio') THEN 'audio' WHEN bool_or(ic.submission_kind='image') THEN 'image' WHEN bool_or(ic.submission_kind='code') THEN 'code' ELSE 'text' END kind FROM interest_categories ic WHERE ic.id IN(SELECT category_id FROM contest_categories WHERE contest_id=c.id UNION SELECT c.category_id)) k)`;
const contestPhase =
  "CASE WHEN c.status IN('completed','cancelled') OR c.ending_time<now() THEN 'previous' WHEN c.starting_time>now() THEN 'upcoming' ELSE 'ongoing' END";
async function visibleContest(req) {
  const id = uuid(req.params.id);
  return one(
    `SELECT c.id,c.name,c.description,c.type::text type,c.entry_fee,c.currency,c.status::text status,c.max_participants,c.starting_time,c.ending_time,u.name creator_name,${catNamesSql("contests", "c")} category_name,${catDetailsSql("contests", "c")} category_details,(SELECT count(*) FROM contest_participants WHERE contest_id=c.id) participant_count,EXISTS(SELECT 1 FROM contest_participants WHERE contest_id=c.id AND participant_id=$2 AND payment_status='paid') joined,${contestPhase} phase,${contestKindSql} submission_kind FROM contests c JOIN users u ON u.id=c.creator_id WHERE c.id=$1 AND(c.status IN('published','completed','cancelled') OR c.creator_id=$2 OR $3='admin')`,
    [id, req.user.sub, req.user.role],
  );
}
app.get(
  "/contests/:id",
  run(async (req) => {
    learner(req);
    const contest = await visibleContest(req);
    const started = contest.phase !== "upcoming";
    const problems = started
      ? (
          await query(
            "SELECT id,name,description,points,sample_input,sample_output,time_limit_ms,memory_limit_mb FROM contest_problems WHERE contest_id=$1 ORDER BY sort_order",
            [contest.id],
          )
        ).rows
      : [];
    const mySubmissions = contest.joined
      ? (
          await query(
            "SELECT s.id,s.problem_id,p.name problem_name,s.content,s.language,s.status::text status,s.score,s.feedback,s.submitted_at,s.mime_type,s.file_name,s.file_size,(s.file_url IS NOT NULL) has_file FROM contest_submissions s LEFT JOIN contest_problems p ON p.id=s.problem_id WHERE s.contest_id=$1 AND s.participant_id=$2 ORDER BY s.submitted_at DESC",
            [contest.id, req.user.sub],
          )
        ).rows
      : [];
    return { ...contest, problems, my_submissions: mySubmissions };
  }),
);
app.get(
  "/contests/:id/participants",
  run(async (req) => {
    learner(req);
    const contest = await visibleContest(req);
    const started = contest.phase !== "upcoming";
    return (
      await query(
        `SELECT u.id,u.name,u.username,(u.picture IS NOT NULL) has_picture,p.participated_at,${started ? "p.points,coalesce(p.rank,rank() OVER (ORDER BY p.points DESC,p.participated_at)) AS rank," : "NULL::numeric AS points,NULL::int AS rank,"}(SELECT count(*) FROM contest_submissions s WHERE s.contest_id=p.contest_id AND s.participant_id=p.participant_id) submission_count FROM contest_participants p JOIN users u ON u.id=p.participant_id WHERE p.contest_id=$1 AND p.payment_status='paid' ORDER BY ${started ? "rank," : ""}p.participated_at LIMIT 300`,
        [contest.id],
      )
    ).rows;
  }),
);
app.get(
  "/contests/:id/participants/:userId/submissions",
  run(async (req) => {
    learner(req);
    const contest = await visibleContest(req);
    if (contest.phase === "upcoming" && req.user.role !== "admin")
      throw new ApiError(403, "Submissions open when the contest starts");
    const userId = uuid(req.params.userId);
    await one(
      "SELECT 1 FROM contest_participants WHERE contest_id=$1 AND participant_id=$2 AND payment_status='paid'",
      [contest.id, userId],
    );
    return (
      await query(
        "SELECT s.id,s.problem_id,p.name problem_name,s.content,s.language,s.status::text status,s.score,s.feedback,s.submitted_at,s.mime_type,s.file_name,s.file_size,(s.file_url IS NOT NULL) has_file FROM contest_submissions s LEFT JOIN contest_problems p ON p.id=s.problem_id WHERE s.contest_id=$1 AND s.participant_id=$2 ORDER BY s.submitted_at DESC LIMIT 50",
        [contest.id, userId],
      )
    ).rows;
  }),
);
const reactionKinds = ["like", "love", "celebrate", "insightful", "curious"];
app.post(
  "/communities",
  run(async (req) => {
    learner(req);
    const b = z
      .object({
        name: z.string().trim().min(2).max(150),
        slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
        description: z.string().max(10000),
        category_ids: z.array(z.string().uuid()).min(1).max(20),
        requires_approval: z.boolean(),
        is_private: z.boolean(),
      })
      .parse(req.body);
    const categories = [...new Set(b.category_ids)];
    return tx(async (db) => {
      if (
        (
          await db.query(
            "SELECT id FROM interest_categories WHERE id=ANY($1::uuid[])",
            [categories],
          )
        ).rowCount !== categories.length
      )
        throw new ApiError(422, "One or more interests no longer exist");
      const c = (
        await db.query(
          "INSERT INTO communities(creator_id,name,slug,description,category_id,requires_approval,is_private) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id",
          [
            req.user.sub,
            b.name,
            b.slug,
            b.description,
            categories[0],
            b.requires_approval,
            b.is_private,
          ],
        )
      ).rows[0];
      await saveCategories(db, "communities", c.id, categories);
      await db.query(
        `INSERT INTO community_members(community_id,member_id,status,is_moderator,approved_at,approved_by) VALUES($1,$2,'approved',true,now(),$2)`,
        [c.id, req.user.sub],
      );
      await db.query(
        `INSERT INTO community_chats(community_id,name) VALUES($1,'general')`,
        [c.id],
      );
      return c;
    });
  }),
);
app.get(
  "/communities/mine",
  run(async (req) => {
    learner(req);
    const [limit, offset] = paging(req);
    return (
      await query(
        `SELECT c.id,c.name,c.description,c.is_private,c.requires_approval,${catDetailsSql("communities", "c")} category_details,(SELECT count(*) FROM community_members WHERE community_id=c.id AND status='approved') member_count,(SELECT count(*) FROM community_chats WHERE community_id=c.id) channel_count,CASE WHEN c.creator_id=$1 THEN 'owner' WHEN m.is_moderator THEN 'moderator' ELSE 'member' END role,coalesce(m.approved_at,c.created_at) joined_at FROM communities c LEFT JOIN community_members m ON m.community_id=c.id AND m.member_id=$1 WHERE(m.status='approved' OR c.creator_id=$1) AND(c.name ILIKE $2 OR c.description ILIKE $2) ORDER BY coalesce(m.approved_at,c.created_at) DESC LIMIT $3 OFFSET $4`,
        [
          req.user.sub,
          `%${String(req.query.q || "").slice(0, 200)}%`,
          limit,
          offset,
        ],
      )
    ).rows;
  }),
);
app.get(
  "/communities/:id",
  run(async (req) => {
    learner(req);
    const c = await communityAccess(req);
    const info = await one(
      `SELECT c.id,c.name,c.description,c.is_private,c.requires_approval,c.created_at,u.name creator_name,${catDetailsSql("communities", "c")} category_details,(SELECT count(*) FROM community_members WHERE community_id=c.id AND status='approved') member_count FROM communities c JOIN users u ON u.id=c.creator_id WHERE c.id=$1`,
      [c.id],
    );
    const member = c.membership === "approved";
    const role =
      c.creator_id === req.user.sub
        ? "owner"
        : member && c.is_moderator
          ? "moderator"
          : member
            ? req.user.role === "admin"
              ? "admin"
              : "member"
            : null;
    return {
      ...info,
      membership: c.membership,
      role,
      can_manage: c.can_manage,
      chats: member
        ? (
            await query(
              "SELECT id,name,description FROM community_chats WHERE community_id=$1 ORDER BY sort_order,created_at",
              [c.id],
            )
          ).rows
        : [],
      pending: c.can_manage
        ? (
            await query(
              `SELECT m.member_id,u.name,u.username,m.requested_at FROM community_members m JOIN users u ON u.id=m.member_id WHERE community_id=$1 AND status='pending' ORDER BY m.requested_at LIMIT 100`,
              [c.id],
            )
          ).rows
        : [],
    };
  }),
);
app.get(
  "/communities/:id/members",
  run(async (req) => {
    learner(req);
    const c = await requireMember(req);
    return (
      await query(
        `SELECT u.id,u.name,u.username,(u.picture IS NOT NULL) has_picture,(u.id=$2) is_owner,m.is_moderator FROM community_members m JOIN users u ON u.id=m.member_id WHERE m.community_id=$1 AND m.status='approved' ORDER BY (u.id=$2) DESC,m.is_moderator DESC,u.name LIMIT 300`,
        [c.id, c.creator_id],
      )
    ).rows;
  }),
);
app.delete(
  "/communities/:id/membership",
  run(async (req) => {
    learner(req);
    const c = await communityAccess(req);
    if (c.creator_id === req.user.sub)
      throw new ApiError(409, "The owner cannot leave their own community");
    await query(
      "DELETE FROM community_members WHERE community_id=$1 AND member_id=$2",
      [c.id, req.user.sub],
    );
  }),
);
app.patch(
  "/communities/:id/members/:userId",
  run(async (req) => {
    learner(req);
    const c = await communityAccess(req);
    if (!c.can_manage) throw new ApiError(403, "Moderator required");
    const status = z
      .enum(["approved", "rejected", "blocked"])
      .parse(req.body.status);
    await query(
      `UPDATE community_members SET status=$1::membership_status,approved_at=CASE WHEN $5 THEN now() ELSE NULL END,approved_by=$2 WHERE community_id=$3 AND member_id=$4`,
      [
        status,
        req.user.sub,
        c.id,
        uuid(req.params.userId),
        status === "approved",
      ],
    );
  }),
);
app.post(
  "/communities/:id/chats",
  run(async (req) => {
    learner(req);
    const c = await communityAccess(req);
    if (!c.can_manage) throw new ApiError(403, "Moderator required");
    const b = z
      .object({
        name: z.string().trim().min(1).max(150),
        description: z.string().trim().max(500).optional(),
      })
      .parse(req.body);
    return (
      await query(
        "INSERT INTO community_chats(community_id,name,description,sort_order) VALUES($1,$2,$3,(SELECT coalesce(max(sort_order),-1)+1 FROM community_chats WHERE community_id=$1)) RETURNING id",
        [c.id, b.name, b.description || null],
      )
    ).rows[0];
  }),
);
app.get(
  "/communities/:id/chats/:chatId",
  run(async (req) => {
    learner(req);
    const c = await requireMember(req);
    const chatId = uuid(req.params.chatId);
    await one("SELECT 1 FROM community_chats WHERE id=$1 AND community_id=$2", [
      chatId,
      c.id,
    ]);
    return (
      await query(
        `SELECT * FROM(SELECT m.id,m.sender_id,m.content,m.created_at,u.name sender_name,(u.picture IS NOT NULL) sender_has_picture,coalesce((SELECT json_agg(json_build_object('reaction',r.reaction,'count',r.n,'mine',r.mine) ORDER BY r.first_at) FROM(SELECT reaction::text reaction,count(*) n,bool_or(user_id=$3) mine,min(created_at) first_at FROM community_chat_message_reactions WHERE message_id=m.id GROUP BY reaction) r),'[]'::json) reactions FROM community_chat_messages m JOIN users u ON u.id=m.sender_id WHERE m.community_id=$1 AND m.chat_id=$2 AND m.deleted_at IS NULL ORDER BY m.created_at DESC LIMIT 200) recent ORDER BY created_at`,
        [c.id, chatId, req.user.sub],
      )
    ).rows;
  }),
);
app.post(
  "/communities/:id/chats/:chatId",
  run(async (req) => {
    learner(req);
    const c = await requireMember(req);
    const content = z.string().trim().min(1).max(4000).parse(req.body.content);
    return (
      await query(
        "INSERT INTO community_chat_messages(community_id,chat_id,sender_id,content) VALUES($1,$2,$3,$4) RETURNING id",
        [c.id, uuid(req.params.chatId), req.user.sub, content],
      )
    ).rows[0];
  }),
);
app.put(
  "/communities/:id/chats/:chatId/messages/:messageId/reaction",
  run(async (req) => {
    learner(req);
    const c = await requireMember(req);
    const reaction = z.enum(reactionKinds).parse(req.body.reaction);
    const messageId = uuid(req.params.messageId);
    await one(
      "SELECT 1 FROM community_chat_messages WHERE id=$1 AND community_id=$2 AND chat_id=$3 AND deleted_at IS NULL",
      [messageId, c.id, uuid(req.params.chatId)],
    );
    await tx(async (db) => {
      await db.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
        `chat-reaction:${messageId}:${req.user.sub}`,
      ]);
      const removed = await db.query(
        "DELETE FROM community_chat_message_reactions WHERE message_id=$1 AND user_id=$2 AND reaction=$3",
        [messageId, req.user.sub, reaction],
      );
      if (!removed.rowCount)
        await db.query(
          "INSERT INTO community_chat_message_reactions(message_id,user_id,reaction) VALUES($1,$2,$3)",
          [messageId, req.user.sub, reaction],
        );
    });
  }),
);
app.delete(
  "/communities/:id/chats/:chatId/messages/:messageId",
  run(async (req) => {
    learner(req);
    const c = await requireMember(req);
    const m = await one(
      "SELECT sender_id FROM community_chat_messages WHERE id=$1 AND community_id=$2 AND chat_id=$3 AND deleted_at IS NULL",
      [uuid(req.params.messageId), c.id, uuid(req.params.chatId)],
    );
    if (m.sender_id !== req.user.sub && !c.can_manage)
      throw new ApiError(403, "You can only delete your own messages");
    await query(
      "UPDATE community_chat_messages SET deleted_at=now() WHERE id=$1",
      [req.params.messageId],
    );
  }),
);
const distanceSql = (lat, lng) =>
  `(CASE WHEN ${lat}::float8 IS NULL OR j.latitude IS NULL THEN NULL ELSE 6371*acos(least(1,greatest(-1,cos(radians(${lat}::float8))*cos(radians(j.latitude::float8))*cos(radians(j.longitude::float8)-radians(${lng}::float8))+sin(radians(${lat}::float8))*sin(radians(j.latitude::float8)))))END)`;
const finiteOrNull = (value, limit) => {
  if (value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || Math.abs(n) > limit)
    throw new ApiError(422, "Invalid map position");
  return n;
};
app.get(
  "/jobs",
  run(async (req) => {
    const [limit, offset] = paging(req);
    const tab = req.query.tab;
    const filter =
      tab === "mine"
        ? `j.creator_id=$1`
        : tab === "applied"
          ? `a.applicant_id=$1`
          : `j.status='open' AND(j.application_deadline IS NULL OR j.application_deadline>now())`;
    const lat = finiteOrNull(req.query.lat, 90),
      lng = finiteOrNull(req.query.lng, 180),
      radius = finiteOrNull(req.query.radius, 20040);
    if ((lat === null) !== (lng === null))
      throw new ApiError(422, "Send both latitude and longitude");
    const mapOnly = req.query.map === "1";
    const category = req.query.category ? uuid(req.query.category) : "";
    const sortColumn = {
      salary: "coalesce(x.salary_max,x.salary_min)",
      deadline: "x.application_deadline",
      created: "x.created_at",
    }[String(req.query.sort || "")];
    const direction = req.query.direction === "asc" ? "ASC" : "DESC";
    const orderBy = sortColumn
      ? `${sortColumn} ${direction} NULLS LAST,x.created_at DESC`
      : `${lat !== null ? "x.distance_km ASC NULLS LAST," : ""}x.created_at DESC`;
    const distance = distanceSql("$6", "$7");
    const rows = (
      await query(
        `SELECT * FROM(SELECT j.id,j.creator_id,j.title,j.description,j.status,j.type,j.salary_min,j.salary_max,j.currency,j.salary_period,j.location,j.latitude::float8 latitude,j.longitude::float8 longitude,j.is_remote,j.application_deadline,j.created_at,(SELECT count(*) FROM job_applications ap WHERE ap.job_id=j.id)::int application_count,u.name creator_name,${catDetailsSql("jobs", "j")} category_details,a.status application_status,${distance} distance_km FROM jobs j JOIN users u ON u.id=j.creator_id LEFT JOIN job_applications a ON a.job_id=j.id AND a.applicant_id=$1 WHERE ${filter} AND(j.title ILIKE $2 OR j.description ILIKE $2 OR j.location ILIKE $2) AND($3='' OR j.type::text=$3) AND($9='' OR j.category_id::text=$9 OR EXISTS(SELECT 1 FROM job_categories jc WHERE jc.job_id=j.id AND jc.category_id::text=$9))${mapOnly ? " AND j.latitude IS NOT NULL" : ""}) x WHERE($8::float8 IS NULL OR x.distance_km<=$8::float8) ORDER BY ${orderBy} LIMIT $4 OFFSET $5`,
        [
          req.user.sub,
          `%${String(req.query.q || "").slice(0, 200)}%`,
          req.query.type || "",
          limit,
          offset,
          lat,
          lng,
          radius,
          category,
        ],
      )
    ).rows;
    return rows.map((row) => ({
      ...row,
      distance_km: row.distance_km === null ? null : Number(row.distance_km),
    }));
  }),
);
const hirerOnly = (req) => {
  if (req.user.role !== "hirer")
    throw new ApiError(403, "Hiring account required");
};
app.get(
  "/jobs/applicants",
  run(async (req) => {
    if (!["hirer", "admin"].includes(req.user.role))
      throw new ApiError(403, "Hiring account required");
    const [limit, offset] = paging(req);
    const jobId = req.query.job ? uuid(req.query.job) : null;
    const status = req.query.status
      ? z
          .enum(["applied", "shortlisted", "accepted", "rejected", "withdrawn"])
          .parse(req.query.status)
      : null;
    const like = `%${String(req.query.q || "").slice(0, 100)}%`;
    return (
      await query(
        `SELECT a.job_id,j.title job_title,a.applicant_id,u.name,u.username,u.uddeepto_id,(u.picture IS NOT NULL) has_picture,u.headline,a.status::text status,a.applied_at,a.cover_letter,(a.resume_blob IS NOT NULL) has_resume
    FROM job_applications a JOIN jobs j ON j.id=a.job_id JOIN users u ON u.id=a.applicant_id
    WHERE (j.creator_id=$1 OR $2='admin') AND($3::uuid IS NULL OR a.job_id=$3) AND($4::text IS NULL OR a.status::text=$4) AND(u.name ILIKE $5 OR u.username::text ILIKE $5)
    ORDER BY a.applied_at DESC LIMIT $6 OFFSET $7`,
        [req.user.sub, req.user.role, jobId, status, like, limit, offset],
      )
    ).rows;
  }),
);
app.get(
  "/dashboard/hirer",
  run(async (req) => {
    hirerOnly(req);
    const id = req.user.sub;
    const stats = await one(
      `SELECT
    (SELECT count(*) FROM jobs WHERE creator_id=$1)::int jobs,
    (SELECT count(*) FROM jobs WHERE creator_id=$1 AND status='open' AND (application_deadline IS NULL OR application_deadline>now()))::int open_jobs,
    (SELECT count(*) FROM job_applications a JOIN jobs j ON j.id=a.job_id WHERE j.creator_id=$1)::int applicants,
    (SELECT count(*) FROM job_applications a JOIN jobs j ON j.id=a.job_id WHERE j.creator_id=$1 AND a.status='applied')::int new_applicants,
    (SELECT count(*) FROM job_applications a JOIN jobs j ON j.id=a.job_id WHERE j.creator_id=$1 AND a.status='shortlisted')::int shortlisted,
    (SELECT count(*) FROM job_applications a JOIN jobs j ON j.id=a.job_id WHERE j.creator_id=$1 AND a.status='accepted')::int accepted,
    (SELECT count(*) FROM job_applications a JOIN jobs j ON j.id=a.job_id WHERE j.creator_id=$1 AND a.status='rejected')::int rejected,
    (SELECT count(*) FROM job_applications a JOIN jobs j ON j.id=a.job_id WHERE j.creator_id=$1 AND a.applied_at>now()-interval '7 days')::int applicants_week`,
      [id],
    );
    const recent = (
      await query(
        `SELECT a.job_id,j.title job_title,a.applicant_id,u.name,u.uddeepto_id,(u.picture IS NOT NULL) has_picture,u.headline,a.status::text status,a.applied_at
    FROM job_applications a JOIN jobs j ON j.id=a.job_id JOIN users u ON u.id=a.applicant_id WHERE j.creator_id=$1 ORDER BY a.applied_at DESC LIMIT 6`,
        [id],
      )
    ).rows;
    const topJobs = (
      await query(
        `SELECT * FROM(SELECT j.id,j.title,j.status::text status,j.application_deadline,j.created_at,
      (SELECT count(*) FROM job_applications WHERE job_id=j.id)::int application_count,
      (SELECT count(*) FROM job_applications WHERE job_id=j.id AND status='applied')::int new_count
    FROM jobs j WHERE j.creator_id=$1) x ORDER BY new_count DESC,created_at DESC LIMIT 5`,
        [id],
      )
    ).rows;
    const closing = (
      await query(
        `SELECT id,title,application_deadline FROM jobs WHERE creator_id=$1 AND status='open' AND application_deadline>now() AND application_deadline<now()+interval '7 days' ORDER BY application_deadline LIMIT 4`,
        [id],
      )
    ).rows;
    const activity = (
      await query(
        `SELECT d.day::date::text AS day,coalesce(a.n,0)::int AS count
    FROM generate_series((now() AT TIME ZONE 'Asia/Dhaka')::date-13,(now() AT TIME ZONE 'Asia/Dhaka')::date,interval '1 day') AS d(day)
    LEFT JOIN(SELECT (a.applied_at AT TIME ZONE 'Asia/Dhaka')::date AS day,count(*) AS n FROM job_applications a JOIN jobs j ON j.id=a.job_id WHERE j.creator_id=$1 AND a.applied_at>now()-interval '16 days' GROUP BY 1) a ON a.day=d.day::date ORDER BY d.day`,
        [id],
      )
    ).rows;
    return { stats, recent, top_jobs: topJobs, closing, activity };
  }),
);
app.get(
  "/jobs/:id",
  run(async (req) => {
    const id = uuid(req.params.id);
    const job = await one(
      `SELECT j.id,j.creator_id,j.title,j.description,j.status::text status,j.type::text type,j.salary_min,j.salary_max,j.currency,j.salary_period,j.location,j.latitude::float8 latitude,j.longitude::float8 longitude,j.is_remote,j.criteria,j.application_deadline,j.created_at,u.name creator_name,u.uddeepto_id creator_uddeepto_id,(u.picture IS NOT NULL) creator_has_picture,a.status::text application_status,a.applied_at,(j.creator_id=$2 OR $3='admin') is_owner FROM jobs j JOIN users u ON u.id=j.creator_id LEFT JOIN job_applications a ON a.job_id=j.id AND a.applicant_id=$2 WHERE j.id=$1 AND(j.status<>'draft' OR j.creator_id=$2 OR $3='admin')`,
      [id, req.user.sub, req.user.role],
    );
    if (job.is_owner)
      job.application_count = Number(
        (
          await one("SELECT count(*) FROM job_applications WHERE job_id=$1", [
            id,
          ])
        ).count,
      );
    job.accepting =
      job.status === "open" &&
      (!job.application_deadline ||
        new Date(job.application_deadline) > new Date());
    return job;
  }),
);
app.get(
  "/jobs/:id/applications",
  run(async (req) => {
    await ownJob(req);
    return (
      await query(
        "SELECT a.applicant_id,a.status,a.cover_letter,a.applied_at,a.resume_blob IS NOT NULL has_resume,u.name,u.username FROM job_applications a JOIN users u ON u.id=a.applicant_id WHERE job_id=$1 ORDER BY applied_at DESC LIMIT 100",
        [req.params.id],
      )
    ).rows;
  }),
);
app.get(
  "/jobs/:id/applications/:userId/resume",
  run(async (req, res) => {
    await ownJob(req);
    const a = await one(
      "SELECT resume_blob,resume_mime_type FROM job_applications WHERE job_id=$1 AND applicant_id=$2",
      [req.params.id, uuid(req.params.userId)],
    );
    if (!a.resume_blob) throw new ApiError(404, "Resume not found");
    res
      .set("Content-Disposition", 'attachment; filename="resume.pdf"')
      .type("application/octet-stream")
      .send(a.resume_blob);
  }),
);
app.patch(
  "/jobs/:id/applications/:userId",
  run(async (req) => {
    await ownJob(req);
    const status = z
      .enum(["shortlisted", "accepted", "rejected", "applied"])
      .parse(req.body.status);
    await query(
      "UPDATE job_applications SET status=$1 WHERE job_id=$2 AND applicant_id=$3",
      [status, req.params.id, uuid(req.params.userId)],
    );
  }),
);
app.patch(
  "/jobs/:id/status",
  run(async (req) => {
    await ownJob(req);
    await query("UPDATE jobs SET status=$1 WHERE id=$2", [
      z.enum(["open", "closed"]).parse(req.body.status),
      req.params.id,
    ]);
  }),
);
app.get(
  "/messages",
  run(async (req) => {
    return (
      await query(
        `SELECT c.id,c.updated_at,u.name,u.id other_user_id,(u.picture IS NOT NULL) other_has_picture,(SELECT content FROM messages WHERE conversation_id=c.id AND deleted_at IS NULL ORDER BY sent_at DESC LIMIT 1) last_message FROM conversations c JOIN conversation_members mine ON mine.conversation_id=c.id AND mine.user_id=$1 JOIN conversation_members other ON other.conversation_id=c.id AND other.user_id<>$1 JOIN users u ON u.id=other.user_id WHERE (SELECT count(*) FROM conversation_members WHERE conversation_id=c.id)=2 ORDER BY c.updated_at DESC LIMIT 100`,
        [req.user.sub],
      )
    ).rows;
  }),
);
app.post(
  "/messages",
  run(async (req) => {
    const other = uuid(req.body.user_id);
    if (other === req.user.sub)
      throw new ApiError(422, "Choose another person");
    await one(`SELECT id FROM users WHERE id=$1 AND account_status='active'`, [
      other,
    ]);
    return tx(async (db) => {
      await db.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
        [other, req.user.sub].sort().join(":"),
      ]);
      const found = await db.query(
        `SELECT a.conversation_id id FROM conversation_members a JOIN conversation_members b ON b.conversation_id=a.conversation_id WHERE a.user_id=$1 AND b.user_id=$2 AND (SELECT count(*) FROM conversation_members WHERE conversation_id=a.conversation_id)=2 LIMIT 1`,
        [req.user.sub, other],
      );
      if (found.rowCount) return found.rows[0];
      const c = (
        await db.query("INSERT INTO conversations DEFAULT VALUES RETURNING id")
      ).rows[0];
      await db.query(
        "INSERT INTO conversation_members(conversation_id,user_id) VALUES($1,$2),($1,$3)",
        [c.id, req.user.sub, other],
      );
      return c;
    });
  }),
);
app.get(
  "/messages/:id",
  run(async (req) => {
    await conversationAccess(req);
    await query(
      "UPDATE conversation_members SET last_read_at=now() WHERE conversation_id=$1 AND user_id=$2",
      [req.params.id, req.user.sub],
    );
    return (
      await query(
        `SELECT * FROM(SELECT id,sender_id,content,sent_at FROM messages WHERE conversation_id=$1 AND deleted_at IS NULL ORDER BY sent_at DESC LIMIT 100) latest ORDER BY sent_at`,
        [req.params.id],
      )
    ).rows;
  }),
);
app.post(
  "/messages/:id",
  run(async (req) => {
    await conversationAccess(req);
    return tx(async (db) => {
      const m = (
        await db.query(
          "INSERT INTO messages(conversation_id,sender_id,content) VALUES($1,$2,$3) RETURNING id",
          [req.params.id, req.user.sub, text(req.body.content)],
        )
      ).rows[0];
      await db.query("UPDATE conversations SET updated_at=now() WHERE id=$1", [
        req.params.id,
      ]);
      return m;
    });
  }),
);
const managed = {
  users: {
    table: "users",
    fields: ["name", "email", "username", "role", "account_status"],
    select:
      "u.id,u.name,u.email,u.username,u.role::text role,u.account_status::text account_status,u.created_at,u.last_login_at",
    from: "users u",
    search: ["u.name", "u.email", "u.username"],
    statusField: "u.account_status",
    statusValues: ["active", "suspended", "deactivated"],
    sortable: {
      created_at: "u.created_at",
      name: "u.name",
      email: "u.email",
      role: "u.role",
      account_status: "u.account_status",
    },
    defaultSort: "u.created_at",
  },
  interest_categories: {
    table: "interest_categories",
    fields: [
      "name",
      "slug",
      "icon",
      "description",
      "is_active",
      "submission_kind",
    ],
    select:
      "id,name,slug,icon,description,is_active,submission_kind,created_at",
    search: ["name", "slug", "description"],
    statusField: "is_active",
    statusValues: ["true", "false"],
    sortable: { created_at: "created_at", name: "name", slug: "slug" },
    defaultSort: "created_at",
  },
  courses: {
    table: "courses",
    fields: [
      "title",
      "slug",
      "description",
      "category_id",
      "instructor_id",
      "price",
      "currency",
      "status",
    ],
    owner: true,
    select:
      "c.id,c.creator_id,c.instructor_id,c.title,c.slug,c.description,c.category_id,i.name category_name,u.name creator_name,ins.name instructor_name,ins.image_mime_type instructor_image_mime_type,(ins.image_blob IS NOT NULL) instructor_has_image,c.cover_image_mime_type,(c.cover_image IS NOT NULL) has_cover_image,c.price,c.currency,c.status::text status,c.published_at,c.created_at,(SELECT count(*) FROM course_enrollments e WHERE e.course_id=c.id) enrollment_count",
    from: "courses c JOIN users u ON u.id=c.creator_id JOIN interest_categories i ON i.id=c.category_id LEFT JOIN instructors ins ON ins.id=c.instructor_id",
    search: [
      "c.title",
      "c.slug",
      "u.name",
      "i.name",
      "ins.name",
      "c.description",
    ],
    statusField: "c.status",
    statusValues: ["draft", "published", "archived"],
    sortable: {
      created_at: "c.created_at",
      title: "c.title",
      status: "c.status",
      price: "c.price",
    },
    defaultSort: "c.created_at",
  },
  instructors: {
    table: "instructors",
    fields: ["name", "designation", "details", "social_links"],
    select:
      "id,name,designation,details,social_links,image_mime_type,(image_blob IS NOT NULL) has_image,created_at,(SELECT count(*) FROM courses c WHERE c.instructor_id=instructors.id) course_count",
    from: "instructors",
    search: ["name", "designation", "details"],
    sortable: {
      created_at: "created_at",
      name: "name",
      designation: "designation",
    },
    defaultSort: "created_at",
  },
  contests: {
    table: "contests",
    fields: [
      "name",
      "description",
      "category_id",
      "type",
      "entry_fee",
      "currency",
      "status",
      "max_participants",
      "starting_time",
      "ending_time",
    ],
    owner: true,
    select:
      "c.id,c.creator_id,c.name,c.description,c.category_id,i.name category_name,u.name creator_name,c.type::text type,c.entry_fee,c.currency,c.status::text status,c.max_participants,c.starting_time,c.ending_time,c.created_at,(SELECT count(*) FROM contest_participants p WHERE p.contest_id=c.id) participant_count",
    from: "contests c JOIN users u ON u.id=c.creator_id JOIN interest_categories i ON i.id=c.category_id",
    search: ["c.name", "u.name", "i.name", "c.description"],
    statusField: "c.status",
    statusValues: ["draft", "published", "cancelled", "completed"],
    sortable: {
      created_at: "c.created_at",
      name: "c.name",
      status: "c.status",
      starting_time: "c.starting_time",
    },
    defaultSort: "c.created_at",
  },
  webinars: {
    table: "webinars",
    fields: [
      "name",
      "description",
      "category_id",
      "meeting_url",
      "capacity",
      "status",
      "starting_time",
      "ending_time",
    ],
    owner: true,
    select:
      "w.id,w.creator_id,w.name,w.description,w.category_id,i.name category_name,u.name creator_name,w.meeting_url,w.capacity,w.status::text status,w.starting_time,w.ending_time,w.created_at,(SELECT count(*) FROM webinar_participants p WHERE p.webinar_id=w.id AND p.status IN ('registered','attended')) participant_count",
    from: "webinars w JOIN users u ON u.id=w.creator_id JOIN interest_categories i ON i.id=w.category_id",
    search: ["w.name", "u.name", "i.name", "w.description"],
    statusField: "w.status",
    statusValues: ["draft", "scheduled", "live", "completed", "cancelled"],
    sortable: {
      created_at: "w.created_at",
      name: "w.name",
      status: "w.status",
      starting_time: "w.starting_time",
    },
    defaultSort: "w.created_at",
  },
  jobs: {
    table: "jobs",
    fields: [
      "title",
      "description",
      "type",
      "status",
      "location",
      "is_remote",
      "salary_min",
      "salary_max",
      "currency",
      "salary_period",
      "application_deadline",
      "category_id",
    ],
    owner: true,
    select:
      "j.id,j.creator_id,j.title,j.description,j.type::text type,j.status::text status,j.location,j.is_remote,j.salary_min,j.salary_max,j.currency,j.salary_period,j.application_deadline,j.category_id,i.name category_name,u.name creator_name,j.created_at,(SELECT count(*) FROM job_applications a WHERE a.job_id=j.id) application_count",
    from: "jobs j JOIN users u ON u.id=j.creator_id LEFT JOIN interest_categories i ON i.id=j.category_id",
    search: ["j.title", "u.name", "j.location", "i.name", "j.description"],
    statusField: "j.status",
    statusValues: ["draft", "open", "closed", "filled", "cancelled"],
    sortable: {
      created_at: "j.created_at",
      title: "j.title",
      status: "j.status",
      application_deadline: "j.application_deadline",
    },
    defaultSort: "j.created_at",
  },
  communities: {
    table: "communities",
    fields: [
      "name",
      "slug",
      "description",
      "category_id",
      "requires_approval",
      "is_private",
    ],
    owner: true,
    select:
      "c.id,c.creator_id,c.name,c.slug,c.description,c.category_id,i.name category_name,u.name creator_name,c.requires_approval,c.is_private,c.created_at,(SELECT count(*) FROM community_members m WHERE m.community_id=c.id AND m.status='approved') member_count",
    from: "communities c JOIN users u ON u.id=c.creator_id JOIN interest_categories i ON i.id=c.category_id",
    search: ["c.name", "c.slug", "u.name", "i.name", "c.description"],
    sortable: { created_at: "c.created_at", name: "c.name" },
    defaultSort: "c.created_at",
  },
  showcase_posts: {
    table: "showcase_posts",
    fields: ["content", "visibility"],
    select:
      "p.id,p.creator_id,p.content,p.visibility::text visibility,p.created_at,p.deleted_at,u.name creator_name,i.name category_name",
    from: "showcase_posts p JOIN users u ON u.id=p.creator_id JOIN interest_categories i ON i.id=p.category_id",
    where: "p.deleted_at IS NULL",
    search: ["p.content", "u.name", "i.name"],
    statusField: "p.visibility",
    statusValues: ["public", "private"],
    sortable: { created_at: "p.created_at", visibility: "p.visibility" },
    defaultSort: "p.created_at",
  },
  reported_showcase_posts: {
    table: "reported_showcase_posts",
    fields: ["status", "resolution_note"],
    select:
      "r.id,r.post_id,r.reporter_id,r.reason,r.details,r.status::text status,r.resolution_note,r.created_at,p.deleted_at,p.content post_content,u.name reporter_name,creator.name post_creator_name",
    from: "reported_showcase_posts r JOIN showcase_posts p ON p.id=r.post_id JOIN users u ON u.id=r.reporter_id JOIN users creator ON creator.id=p.creator_id",
    search: ["r.reason", "r.details", "p.content", "u.name", "creator.name"],
    statusField: "r.status",
    statusValues: ["pending", "reviewing", "resolved", "dismissed"],
    sortable: {
      created_at: "r.created_at",
      status: "r.status",
      reason: "r.reason",
    },
    defaultSort: "r.created_at",
  },
};
const catTables = {
  courses: ["course_categories", "course_id", "c"],
  contests: ["contest_categories", "contest_id", "c"],
  webinars: ["webinar_categories", "webinar_id", "w"],
  jobs: ["job_categories", "job_id", "j"],
  communities: ["community_categories", "community_id", "c"],
};
const catNamesSql = (kind, alias) => {
  const [jt, fk] = catTables[kind];
  return `coalesce((SELECT string_agg(ic.name,', ' ORDER BY ic.name) FROM ${jt} cc JOIN interest_categories ic ON ic.id=cc.category_id WHERE cc.${fk}=${alias}.id),(SELECT name FROM interest_categories WHERE id=${alias}.category_id))`;
};
const catDetailsSql = (kind, alias) => {
  const [jt, fk] = catTables[kind];
  return `coalesce((SELECT json_agg(json_build_object('id',ic.id,'name',ic.name,'icon',ic.icon) ORDER BY ic.name) FROM ${jt} cc JOIN interest_categories ic ON ic.id=cc.category_id WHERE cc.${fk}=${alias}.id),(SELECT json_build_array(json_build_object('id',ic.id,'name',ic.name,'icon',ic.icon)) FROM interest_categories ic WHERE ic.id=${alias}.category_id),'[]'::json)`;
};
const speakersJsonSql = (alias) =>
  `coalesce((SELECT json_agg(json_build_object('id',ins.id,'name',ins.name,'designation',ins.designation,'has_image',ins.image_blob IS NOT NULL) ORDER BY ws.sort_order) FROM webinar_speakers ws JOIN instructors ins ON ins.id=ws.instructor_id WHERE ws.webinar_id=${alias}.id),'[]'::json)`;
const speakerNamesSql = (alias) =>
  `(SELECT string_agg(ins.name,', ' ORDER BY ws.sort_order) FROM webinar_speakers ws JOIN instructors ins ON ins.id=ws.instructor_id WHERE ws.webinar_id=${alias}.id)`;
const catIdsSql = (kind, alias) => {
  const [jt, fk] = catTables[kind];
  return `coalesce(nullif((SELECT array_agg(cc.category_id::text ORDER BY ic.name) FROM ${jt} cc JOIN interest_categories ic ON ic.id=cc.category_id WHERE cc.${fk}=${alias}.id),'{}'),CASE WHEN ${alias}.category_id IS NULL THEN '{}'::text[] ELSE ARRAY[${alias}.category_id::text] END)`;
};
managed.webinars.fields.push("recording_url");
managed.jobs.fields.push("latitude", "longitude");
managed.jobs.select = managed.jobs.select.replace(
  "j.application_deadline,",
  "j.application_deadline,j.latitude::float8 latitude,j.longitude::float8 longitude,",
);
managed.webinars.select =
  managed.webinars.select.replace(
    "w.meeting_url,",
    "w.meeting_url,w.recording_url,",
  ) + `,${speakersJsonSql("w")} speakers,${speakerNamesSql("w")} speaker_names`;
managed.webinars.search.push(`(${speakerNamesSql("w")})`);
function speakerIds(body, required) {
  let raw = body.speaker_ids;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      throw new ApiError(422, "Invalid speakers");
    }
  }
  if (raw === undefined && !required) return undefined;
  const ids = [
    ...new Set(
      z
        .array(z.string().uuid())
        .max(30)
        .parse(raw ?? []),
    ),
  ];
  if (!ids.length) throw new ApiError(422, "Add at least one speaker");
  return ids;
}
async function saveSpeakers(db, webinarId, ids) {
  const found = (
    await db.query("SELECT id FROM instructors WHERE id=ANY($1::uuid[])", [ids])
  ).rowCount;
  if (found !== ids.length)
    throw new ApiError(422, "One or more speakers no longer exist");
  await db.query(
    "DELETE FROM webinar_speakers WHERE webinar_id=$1 AND NOT(instructor_id=ANY($2::uuid[]))",
    [webinarId, ids],
  );
  await db.query(
    "INSERT INTO webinar_speakers(webinar_id,instructor_id,sort_order) SELECT $1,x.id,x.ord-1 FROM unnest($2::uuid[]) WITH ORDINALITY AS x(id,ord) ON CONFLICT(webinar_id,instructor_id) DO UPDATE SET sort_order=EXCLUDED.sort_order",
    [webinarId, ids],
  );
}
for (const [kind, [, , alias]] of Object.entries(catTables)) {
  const cfg = managed[kind];
  cfg.categories = true;
  cfg.select = cfg.select.replace(
    "i.name category_name",
    `${catNamesSql(kind, alias)} category_name,${catIdsSql(kind, alias)} category_ids`,
  );
  cfg.search = cfg.search.map((field) =>
    field === "i.name" ? `(${catNamesSql(kind, alias)})` : field,
  );
}
function categoryIds(body, required) {
  let raw = body.category_ids;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      throw new ApiError(422, "Invalid categories");
    }
  }
  if (raw === undefined && body.category_id) raw = [body.category_id];
  if (raw === undefined && !required) return undefined;
  const ids = [
    ...new Set(
      z
        .array(z.string().uuid())
        .max(20)
        .parse(raw ?? []),
    ),
  ];
  if (required && !ids.length)
    throw new ApiError(422, "Select at least one category");
  return ids;
}
async function saveCategories(db, kind, id, ids) {
  const [jt, fk] = catTables[kind];
  if (ids.length) {
    const found = (
      await db.query(
        "SELECT id FROM interest_categories WHERE id=ANY($1::uuid[])",
        [ids],
      )
    ).rowCount;
    if (found !== ids.length)
      throw new ApiError(422, "One or more categories no longer exist");
  }
  await db.query(
    `DELETE FROM ${jt} WHERE ${fk}=$1 AND NOT(category_id=ANY($2::uuid[]))`,
    [id, ids],
  );
  if (ids.length)
    await db.query(
      `INSERT INTO ${jt}(${fk},category_id) SELECT $1,unnest($2::uuid[]) ON CONFLICT DO NOTHING`,
      [id, ids],
    );
}
const managedConfig = (req) => {
  admin(req);
  const cfg = managed[req.params.table];
  if (!cfg) throw new ApiError(404, "Unknown collection");
  return cfg;
};

const instructorImageTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
]);
function checkInstructorImage(file) {
  if (!file) throw new ApiError(422, "Choose an instructor image");
  if (!instructorImageTypes.has(file.mimetype))
    throw new ApiError(422, "Use a JPEG, PNG, WebP, or AVIF image");
}
function instructorLinks(body) {
  const links = {};
  for (const key of ["linkedin", "github", "website"]) {
    const value = body[`${key}_url`]?.trim();
    if (!value) continue;
    let parsed;
    try {
      parsed = new URL(value);
    } catch {
      throw new ApiError(422, `Enter a complete URL for ${key}`);
    }
    if (!["http:", "https:"].includes(parsed.protocol))
      throw new ApiError(422, `Use an https:// or http:// URL for ${key}`);
    links[key] = parsed.toString();
  }
  return links;
}
const instructorFields = {
  name: z.string().trim().min(2).max(150),
  designation: z.string().trim().max(150).default(""),
  details: z.string().trim().max(10000).default(""),
  linkedin_url: z.string().trim().max(500).default(""),
  github_url: z.string().trim().max(500).default(""),
  website_url: z.string().trim().max(500).default(""),
  remove_image: z.enum(["true", "false"]).optional(),
};
app.post(
  "/admin/instructors",
  upload.single("image"),
  run(async (req) => {
    admin(req);
    checkInstructorImage(req.file);
    const instructor = z.object(instructorFields).strict().parse(req.body);
    const socialLinks = instructorLinks(instructor);
    return (
      await query(
        "INSERT INTO instructors(name,designation,image_blob,image_mime_type,details,social_links) VALUES($1,$2,$3,$4,$5,$6) RETURNING id,name,designation,details,social_links,image_mime_type,(image_blob IS NOT NULL) has_image,created_at",
        [
          instructor.name,
          instructor.designation,
          req.file.buffer,
          req.file.mimetype,
          instructor.details,
          JSON.stringify(socialLinks),
        ],
      )
    ).rows[0];
  }),
);
app.patch(
  "/admin/instructors/:id",
  upload.single("image"),
  run(async (req) => {
    admin(req);
    const id = uuid(req.params.id);
    const body = z
      .object({
        ...instructorFields,
        name: instructorFields.name.optional(),
        designation: instructorFields.designation.optional(),
        details: instructorFields.details.optional(),
        linkedin_url: instructorFields.linkedin_url.optional(),
        github_url: instructorFields.github_url.optional(),
        website_url: instructorFields.website_url.optional(),
      })
      .strict()
      .parse(req.body);
    if (req.file) checkInstructorImage(req.file);
    const fields = [],
      values = [];
    const add = (field, value) => {
      fields.push(`${field}=$${values.length + 1}`);
      values.push(value);
    };
    if (body.name !== undefined) add("name", body.name);
    if (body.designation !== undefined) add("designation", body.designation);
    if (body.details !== undefined) add("details", body.details);
    if (
      ["linkedin_url", "github_url", "website_url"].some(
        (key) => body[key] !== undefined,
      )
    )
      add(
        "social_links",
        JSON.stringify(
          instructorLinks({
            ...body,
            linkedin_url: body.linkedin_url || "",
            github_url: body.github_url || "",
            website_url: body.website_url || "",
          }),
        ),
      );
    if (req.file) {
      add("image_blob", req.file.buffer);
      add("image_mime_type", req.file.mimetype);
    } else if (body.remove_image === "true") {
      add("image_blob", null);
      add("image_mime_type", null);
    }
    if (!fields.length)
      throw new ApiError(422, "Update a profile field or choose a new image");
    values.push(id);
    const result = await query(
      `UPDATE instructors SET ${fields.join(",")} WHERE id=$${values.length} RETURNING id,name,designation,details,social_links,image_mime_type,(image_blob IS NOT NULL) has_image,created_at`,
      values,
    );
    if (!result.rowCount) throw new ApiError(404, "Instructor not found");
    return result.rows[0];
  }),
);
app.delete(
  "/admin/instructors/:id",
  run(async (req) => {
    admin(req);
    const id = uuid(req.params.id);
    const courses = Number(
      (await query("SELECT count(*) FROM courses WHERE instructor_id=$1", [id]))
        .rows[0].count,
    );
    const result = await query(
      "DELETE FROM instructors WHERE id=$1 RETURNING id",
      [id],
    );
    if (!result.rowCount) throw new ApiError(404, "Instructor not found");
    return { deleted: true, unassigned_courses: courses };
  }),
);

app.get(
  "/admin/settings",
  run(async (req) => {
    admin(req);
    const rows = (
      await query(
        "SELECT key,value FROM platform_settings WHERE key IN ('registration_open','content_review_required')",
      )
    ).rows;
    const values = { registration_open: true, content_review_required: true };
    for (const row of rows) values[row.key] = row.value === true;
    return values;
  }),
);
app.patch(
  "/admin/settings",
  run(async (req) => {
    admin(req);
    const settings = z
      .object({
        registration_open: z.boolean().optional(),
        content_review_required: z.boolean().optional(),
      })
      .strict()
      .refine((value) => Object.keys(value).length > 0)
      .parse(req.body);
    const descriptions = {
      registration_open: "Allow public self-registration.",
      content_review_required:
        "Require admin approval before creators publish courses, contests, webinars or jobs.",
    };
    for (const [key, value] of Object.entries(settings))
      await query(
        "INSERT INTO platform_settings(key,value,description,updated_by) VALUES($1,$2::jsonb,$3,$4) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value,description=EXCLUDED.description,updated_by=EXCLUDED.updated_by,updated_at=now()",
        [key, JSON.stringify(value), descriptions[key], req.user.sub],
      );
    return settings;
  }),
);
app.get(
  "/admin/overview",
  run(async (req) => {
    admin(req);
    const stats = await one(
      `SELECT (SELECT count(*) FROM users) total_users,(SELECT count(*) FROM users WHERE role='learner') learners,(SELECT count(*) FROM users WHERE role='hirer') hirers,(SELECT count(*) FROM users WHERE account_status='active') active_users,(SELECT count(*) FROM courses) courses,(SELECT count(*) FROM courses WHERE status='published') published_courses,(SELECT count(*) FROM courses WHERE status='draft') draft_courses,(SELECT count(*) FROM contests) contests,(SELECT count(*) FROM contests WHERE status='published') published_contests,(SELECT count(*) FROM webinars) webinars,(SELECT count(*) FROM webinars WHERE status IN('scheduled','live')) active_webinars,(SELECT count(*) FROM jobs) jobs,(SELECT count(*) FROM jobs WHERE status='open') open_jobs,(SELECT count(*) FROM reported_showcase_posts WHERE status IN('pending','reviewing')) open_reports`,
    );
    const activity = (
      await query(
        `SELECT * FROM(SELECT id::text id,'user'::text kind,'New account registered'::text title,name::text detail,created_at occurred_at FROM users UNION ALL SELECT id::text id,'course'::text kind,'Course created'::text title,title::text detail,created_at occurred_at FROM courses UNION ALL SELECT id::text id,'contest'::text kind,'Contest created'::text title,name::text detail,created_at occurred_at FROM contests UNION ALL SELECT id::text id,'webinar'::text kind,'Webinar created'::text title,name::text detail,created_at occurred_at FROM webinars UNION ALL SELECT id::text id,'job'::text kind,'Job posted'::text title,title::text detail,created_at occurred_at FROM jobs UNION ALL SELECT id::text id,'report'::text kind,'Post reported'::text title,reason::text detail,created_at occurred_at FROM reported_showcase_posts) activity ORDER BY occurred_at DESC LIMIT 12`,
      )
    ).rows;
    return { stats, activity };
  }),
);
app.get(
  "/admin/:table",
  run(async (req) => {
    const cfg = managedConfig(req);
    const [limit, offset] = paging(req);
    const values = [];
    const where = [cfg.where || "TRUE"];
    const add = (value) => {
      values.push(value);
      return `$${values.length}`;
    };
    const search = String(req.query.q || "")
      .trim()
      .slice(0, 200);
    if (search && cfg.search?.length) {
      const key = add(`%${search}%`);
      where.push(
        `(${cfg.search.map((field) => `${field}::text ILIKE ${key}`).join(" OR ")})`,
      );
    }
    if (req.query.status) {
      if (
        !cfg.statusField ||
        !cfg.statusValues?.includes(String(req.query.status))
      )
        throw new ApiError(422, "Invalid status filter");
      where.push(`${cfg.statusField}::text=${add(String(req.query.status))}`);
    }
    const created = cfg.sortable?.created_at || "created_at";
    for (const field of ["from", "to"])
      if (req.query[field]) {
        const day = z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .parse(String(req.query[field]));
        where.push(
          field === "from"
            ? `${created}>=${add(day)}::date`
            : `${created}<(${add(day)}::date + interval '1 day')`,
        );
      }
    const sort =
      cfg.sortable?.[String(req.query.sort || "")] ||
      cfg.defaultSort ||
      created;
    const direction = req.query.direction === "asc" ? "ASC" : "DESC";
    values.push(limit, offset);
    return (
      await query(
        `SELECT ${cfg.select || ["id", ...cfg.fields].join(",")} FROM ${cfg.from || cfg.table} WHERE ${where.join(" AND ")} ORDER BY ${sort} ${direction} NULLS LAST LIMIT $${values.length - 1} OFFSET $${values.length}`,
        values,
      )
    ).rows;
  }),
);
app.post(
  "/admin/users",
  run(async (req) => {
    admin(req);
    const user = z
      .object({
        name: z.string().trim().min(2).max(150),
        email: z.string().trim().email().max(254),
        username: z.string().regex(/^[A-Za-z0-9_.-]{3,40}$/),
        password: z.string().min(8).max(128),
        role: z.enum(["learner", "hirer", "admin"]),
      })
      .parse(req.body);
    const hash = await bcrypt.hash(user.password, 12);
    try {
      return (
        await query(
          "INSERT INTO users(name,email,username,password_hash,role) VALUES($1,$2,$3,$4,$5) RETURNING id,name,email,username,role::text role,account_status::text account_status,created_at",
          [user.name, user.email, user.username, hash, user.role],
        )
      ).rows[0];
    } catch (error) {
      if (error.code === "23505")
        throw new ApiError(409, "That email or username is already in use");
      throw error;
    }
  }),
);
app.post(
  "/admin/:table/bulk",
  run(async (req) => {
    const cfg = managedConfig(req);
    const body = z
      .object({
        ids: z.array(z.string().uuid()).min(1).max(100),
        action: z.enum(["status", "delete"]),
        status: z.string().optional(),
      })
      .parse(req.body);
    if (body.action === "status") {
      if (!cfg.statusField || !cfg.statusValues?.includes(body.status))
        throw new ApiError(
          422,
          "This status is not available for the selected records",
        );
      if (
        cfg.table === "users" &&
        body.ids.includes(req.user.sub) &&
        body.status !== "active"
      )
        throw new ApiError(409, "You cannot disable your own admin account");
      const column = cfg.statusField.split(".").at(-1);
      const sets = [`${column}=$1`];
      const values = [
        cfg.table === "interest_categories"
          ? body.status === "true"
          : body.status,
        body.ids,
      ];
      if (cfg.table === "reported_showcase_posts") {
        sets.push("reviewed_by=$3", "reviewed_at=now()");
        values.push(req.user.sub);
      }
      const result = await query(
        `UPDATE ${cfg.table} SET ${sets.join(",")} WHERE id=ANY($2::uuid[])`,
        values,
      );
      return { updated: result.rowCount };
    }
    if (cfg.table === "users")
      throw new ApiError(
        409,
        "Suspend accounts instead of deleting user history",
      );
    if (cfg.table === "showcase_posts") {
      const result = await query(
        "UPDATE showcase_posts SET deleted_at=now() WHERE id=ANY($1::uuid[]) AND deleted_at IS NULL",
        [body.ids],
      );
      return { updated: result.rowCount };
    }
    const files =
      cfg.table === "courses"
        ? await courseFileUrls(body.ids)
        : cfg.table === "contests"
          ? await contestFileUrls(body.ids)
          : [];
    const result = await query(
      `DELETE FROM ${cfg.table} WHERE id=ANY($1::uuid[])`,
      [body.ids],
    );
    await removeStored(files);
    return { updated: result.rowCount };
  }),
);
app.post(
  "/admin/:table",
  upload.single("cover_image"),
  run(async (req) => {
    const cfg = managedConfig(req);
    if (
      [
        "users",
        "showcase_posts",
        "reported_showcase_posts",
        "instructors",
      ].includes(cfg.table)
    )
      throw new ApiError(403, "Creation is not supported for this collection");
    const body = Object.fromEntries(
      cfg.fields
        .filter((key) => req.body[key] !== undefined)
        .map((key) => [key, req.body[key]]),
    );
    if (cfg.owner) body.creator_id = req.user.sub;
    if (cfg.table === "courses") {
      if (!body.instructor_id)
        throw new ApiError(
          422,
          "Assign an instructor before creating a course",
        );
      body.instructor_id = uuid(body.instructor_id);
      if (!body.title || !body.slug || !body.description)
        throw new ApiError(
          422,
          "Course title, slug, and description are required",
        );
      if (req.file) {
        checkInstructorImage(req.file);
        body.cover_image = req.file.buffer;
        body.cover_image_mime_type = req.file.mimetype;
      }
      if (body.status === "published") body.published_at = new Date();
    }
    if (
      cfg.statusField &&
      body[cfg.statusField.split(".").at(-1)] !== undefined &&
      !cfg.statusValues?.includes(
        String(body[cfg.statusField.split(".").at(-1)]),
      )
    )
      throw new ApiError(422, "Invalid status");
    let ids;
    if (cfg.categories) {
      ids = categoryIds(req.body, cfg.table !== "jobs");
      if (ids?.length) body.category_id = ids[0];
      else delete body.category_id;
    }
    const speakers =
      cfg.table === "webinars" ? speakerIds(req.body, true) : undefined;
    const keys = Object.keys(body);
    if (!keys.length) throw new ApiError(422, "No fields");
    return tx(async (db) => {
      const row = (
        await db.query(
          `INSERT INTO ${cfg.table}(${keys.join(",")}) VALUES(${keys.map((_, index) => `$${index + 1}`).join(",")}) RETURNING id`,
          Object.values(body),
        )
      ).rows[0];
      if (ids) await saveCategories(db, cfg.table, row.id, ids);
      if (speakers) await saveSpeakers(db, row.id, speakers);
      return row;
    });
  }),
);
app.patch(
  "/admin/:table/:id",
  upload.single("cover_image"),
  run(async (req) => {
    const cfg = managedConfig(req);
    uuid(req.params.id);
    const body = Object.fromEntries(
      cfg.fields
        .filter((key) => req.body[key] !== undefined)
        .map((key) => [key, req.body[key]]),
    );
    if (cfg.table === "courses") {
      if (body.instructor_id !== undefined)
        body.instructor_id = uuid(body.instructor_id);
      const removeCover = req.body.remove_cover_image;
      if (removeCover !== undefined && !["true", "false"].includes(removeCover))
        throw new ApiError(422, "Invalid remove cover flag");
      if (req.file) {
        checkInstructorImage(req.file);
        body.cover_image = req.file.buffer;
        body.cover_image_mime_type = req.file.mimetype;
      } else if (removeCover === "true") {
        body.cover_image = null;
        body.cover_image_mime_type = null;
      }
    }
    if (cfg.table === "users") {
      if (
        body.role !== undefined &&
        !z.enum(["learner", "hirer", "moderator", "admin"]).safeParse(body.role)
          .success
      )
        throw new ApiError(422, "Invalid user role");
      if (body.name !== undefined)
        body.name = z.string().trim().min(2).max(150).parse(body.name);
      if (body.email !== undefined)
        body.email = z.string().trim().email().max(254).parse(body.email);
      if (body.username !== undefined)
        body.username = z
          .string()
          .regex(/^[A-Za-z0-9_.-]{3,40}$/)
          .parse(body.username);
      if (body.account_status !== undefined)
        z.enum(["active", "suspended", "deactivated"]).parse(
          body.account_status,
        );
      if (
        req.params.id === req.user.sub &&
        ((body.role && body.role !== "admin") ||
          (body.account_status && body.account_status !== "active"))
      )
        throw new ApiError(
          409,
          "You cannot disable or demote your own admin account",
        );
    }
    if (
      cfg.statusField &&
      body[cfg.statusField.split(".").at(-1)] !== undefined &&
      !cfg.statusValues?.includes(
        String(body[cfg.statusField.split(".").at(-1)]),
      )
    )
      throw new ApiError(422, "Invalid status");
    if (
      cfg.table === "courses" &&
      body.status === "published" &&
      body.published_at === undefined
    )
      body.published_at = new Date();
    if (cfg.table === "reported_showcase_posts") {
      body.reviewed_by = req.user.sub;
      body.reviewed_at = new Date();
    }
    let ids;
    if (cfg.categories) {
      ids = categoryIds(req.body, false);
      if (ids !== undefined) {
        if (!ids.length && cfg.table !== "jobs")
          throw new ApiError(422, "Select at least one category");
        body.category_id = ids[0] ?? null;
      }
    }
    const speakers =
      cfg.table === "webinars" ? speakerIds(req.body, false) : undefined;
    const keys = Object.keys(body);
    if (!keys.length && !speakers) throw new ApiError(422, "No fields");
    const values = [...Object.values(body), req.params.id];
    await tx(async (db) => {
      const result = keys.length
        ? await db.query(
            `UPDATE ${cfg.table} SET ${keys.map((key, index) => `${key}=$${index + 1}`).join(",")} WHERE id=$${keys.length + 1}`,
            values,
          )
        : await db.query("SELECT 1 FROM webinars WHERE id=$1", [req.params.id]);
      if (!result.rowCount) throw new ApiError(404, "Record not found");
      if (ids !== undefined)
        await saveCategories(db, cfg.table, req.params.id, ids);
      if (speakers) await saveSpeakers(db, req.params.id, speakers);
    });
  }),
);
app.delete(
  "/admin/:table/:id",
  run(async (req) => {
    const cfg = managedConfig(req);
    const id = uuid(req.params.id);
    if (cfg.table === "users")
      throw new ApiError(
        409,
        "Suspend accounts instead of deleting user history",
      );
    if (cfg.table === "showcase_posts") {
      const result = await query(
        "UPDATE showcase_posts SET deleted_at=now() WHERE id=$1 AND deleted_at IS NULL",
        [id],
      );
      if (!result.rowCount) throw new ApiError(404, "Record not found");
      return;
    }
    const files =
      cfg.table === "courses"
        ? await courseFileUrls([id])
        : cfg.table === "contests"
          ? await contestFileUrls([id])
          : [];
    const result = await query(`DELETE FROM ${cfg.table} WHERE id=$1`, [id]);
    if (!result.rowCount) throw new ApiError(404, "Record not found");
    await removeStored(files);
  }),
);
// ---- Course materials: files live in backend storage, the database keeps only file_url ----
const UPLOAD_ROOT = path.resolve(
  process.env.UPLOAD_DIR ||
    fileURLToPath(new URL("../../../uploads", import.meta.url)),
);
const MB = 1024 * 1024;
const materialTypes = ["text", "video", "document", "other"];
const materialLimits = {
  video: Number(process.env.MAX_VIDEO_UPLOAD_MB || 500) * MB,
  document: Number(process.env.MAX_DOCUMENT_UPLOAD_MB || 50) * MB,
  other: Number(process.env.MAX_OTHER_UPLOAD_MB || 100) * MB,
};
const documentExts = new Set([
  ".pdf",
  ".doc",
  ".docx",
  ".ppt",
  ".pptx",
  ".xls",
  ".xlsx",
  ".odt",
  ".odp",
  ".ods",
  ".rtf",
  ".txt",
  ".csv",
  ".md",
]);
const blockedExts = new Set([
  ".exe",
  ".bat",
  ".cmd",
  ".com",
  ".msi",
  ".scr",
  ".ps1",
  ".sh",
  ".js",
  ".mjs",
  ".vbs",
  ".jar",
  ".html",
  ".htm",
  ".svg",
  ".php",
  ".dll",
]);
const storedPath = (url) => {
  const full = path.resolve(UPLOAD_ROOT, url.replace(/^\/uploads\//, ""));
  if (!full.startsWith(UPLOAD_ROOT + path.sep))
    throw new ApiError(404, "File not found");
  return full;
};
const removeStored = async (urls) => {
  for (const url of urls) {
    if (!url || /^https?:/i.test(url)) continue;
    try {
      await fs.promises.unlink(storedPath(url));
    } catch {
      /* already gone */
    }
  }
};
const courseFileUrls = async (ids) =>
  (
    await query(
      "SELECT file_url FROM course_materials WHERE course_id=ANY($1::uuid[]) AND file_url IS NOT NULL",
      [ids],
    )
  ).rows.map((row) => row.file_url);
const decodeName = (name) =>
  Buffer.from(name || "file", "latin1")
    .toString("utf8")
    .replace(/[\\/\0]/g, "_")
    .slice(0, 255);
const materialUpload = multer({
  storage: multer.diskStorage({
    destination: (req, _file, cb) => {
      const id = z.string().uuid().safeParse(req.params.id);
      if (!id.success) return cb(new ApiError(422, "Invalid course"));
      const dir = path.join(UPLOAD_ROOT, "course-materials", id.data);
      fs.mkdir(dir, { recursive: true }, (error) => cb(error, dir));
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(decodeName(file.originalname)).toLowerCase();
      cb(
        null,
        `${crypto.randomUUID()}${/^\.[a-z0-9]{1,10}$/.test(ext) ? ext : ""}`,
      );
    },
  }),
  limits: { fileSize: Math.max(...Object.values(materialLimits)) },
});
const adminOnly = (req, _res, next) => {
  try {
    admin(req);
    next();
  } catch (error) {
    next(error);
  }
};
function checkMaterialFile(type, file) {
  const ext = path.extname(decodeName(file.originalname)).toLowerCase();
  if (blockedExts.has(ext))
    throw new ApiError(422, "This file type is not allowed");
  if (type === "video" && !file.mimetype.startsWith("video/"))
    throw new ApiError(
      422,
      "Video lectures must be video files (MP4, WebM, MOV…)",
    );
  if (type === "document" && !documentExts.has(ext))
    throw new ApiError(
      422,
      "Documents must be PDF, Word, PowerPoint, Excel, OpenDocument, RTF, TXT, CSV or Markdown files",
    );
  if (file.size > materialLimits[type])
    throw new ApiError(
      413,
      `${type === "video" ? "Video" : type === "document" ? "Document" : "File"} is larger than ${Math.round(materialLimits[type] / MB)} MB`,
    );
}
const materialBody = z.object({
  name: z.string().trim().min(1).max(250),
  description: z.string().trim().max(2000).optional(),
  type: z.enum(materialTypes).optional(),
  content_text: z.string().optional(),
  is_preview: z.union([z.boolean(), z.enum(["true", "false"])]).optional(),
});
async function completeMaterial(db, courseId, userId, materialId) {
  await db.query(
    "INSERT INTO completed_course_materials(course_id,user_id,material_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",
    [courseId, userId, materialId],
  );
  await db.query(
    "UPDATE course_enrollments SET last_accessed_at=now() WHERE course_id=$1 AND user_id=$2",
    [courseId, userId],
  );
  await db.query(
    `UPDATE course_enrollments SET status='completed',completed_at=now() WHERE course_id=$1 AND user_id=$2 AND status='active' AND NOT EXISTS(SELECT 1 FROM course_materials m WHERE course_id=$1 AND NOT EXISTS(SELECT 1 FROM completed_course_materials WHERE material_id=m.id AND user_id=$2))`,
    [courseId, userId],
  );
}
app.get(
  "/manage/courses/:id/materials",
  run(async (req) => {
    admin(req);
    return (
      await query(
        "SELECT id,name,description,type,mime_type,file_name,file_size,sort_order,content_text,external_url,is_preview FROM course_materials WHERE course_id=$1 ORDER BY sort_order",
        [uuid(req.params.id)],
      )
    ).rows;
  }),
);
app.post(
  "/manage/courses/:id/materials",
  adminOnly,
  materialUpload.single("file"),
  run(async (req) => {
    const file = req.file;
    try {
      const courseId = uuid(req.params.id);
      const b = materialBody.parse(req.body);
      const type = b.type || "text";
      const preview = b.is_preview === true || b.is_preview === "true";
      let fileFields = [null, null, null, null];
      if (type === "text") {
        if (file) throw new ApiError(422, "Text lessons cannot have a file");
        if (!b.content_text?.trim())
          throw new ApiError(422, "Write the lesson content");
      } else {
        if (!file) throw new ApiError(422, "Choose a file to upload");
        checkMaterialFile(type, file);
        fileFields = [
          `/uploads/course-materials/${courseId}/${file.filename}`,
          decodeName(file.originalname),
          file.size,
          file.mimetype,
        ];
      }
      return await tx(async (db) => {
        await one("SELECT id FROM courses WHERE id=$1", [courseId]);
        await db.query("SELECT id FROM courses WHERE id=$1 FOR UPDATE", [
          courseId,
        ]);
        return (
          await db.query(
            `INSERT INTO course_materials(course_id,name,description,type,content_text,file_url,file_name,file_size,mime_type,is_preview,sort_order) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,(SELECT coalesce(max(sort_order),-1)+1 FROM course_materials WHERE course_id=$1)) RETURNING id`,
            [
              courseId,
              b.name,
              b.description || null,
              type,
              type === "text" ? b.content_text : null,
              ...fileFields,
              preview,
            ],
          )
        ).rows[0];
      });
    } catch (error) {
      if (file) await fs.promises.unlink(file.path).catch(() => {});
      throw error;
    }
  }),
);
app.delete(
  "/manage/courses/:id/materials/:materialId",
  run(async (req) => {
    admin(req);
    const row = (
      await query(
        "DELETE FROM course_materials WHERE id=$1 AND course_id=$2 RETURNING file_url",
        [uuid(req.params.materialId), uuid(req.params.id)],
      )
    ).rows[0];
    if (!row) throw new ApiError(404, "Material not found");
    await removeStored([row.file_url]);
    return { deleted: true };
  }),
);

async function materialAccess(req) {
  learner(req);
  const m = await one(
    `SELECT m.*,c.creator_id,c.status::text course_status,EXISTS(SELECT 1 FROM course_enrollments e WHERE e.course_id=c.id AND e.user_id=$3 AND e.status IN('active','completed')) enrolled FROM course_materials m JOIN courses c ON c.id=m.course_id WHERE m.id=$1 AND m.course_id=$2`,
    [uuid(req.params.materialId), uuid(req.params.id), req.user.sub],
  );
  const staff = req.user.role === "admin" || m.creator_id === req.user.sub;
  if (
    !staff &&
    (m.course_status !== "published" || !(m.is_preview || m.enrolled))
  )
    throw new ApiError(403, "Enroll in this course to open this material");
  return m;
}
const fileInfo = (courseId, m) =>
  m.file_url
    ? {
        url: `/api/backend/frontend/courses/${courseId}/materials/${m.id}/file`,
        name: m.file_name,
        size: Number(m.file_size),
        mime_type: m.mime_type,
      }
    : m.content_blob
      ? {
          url: `/api/backend/courses/${courseId}/materials/${m.id}/content`,
          name: m.name,
          size: null,
          mime_type: m.mime_type,
        }
      : null;
app.get(
  "/courses/:id/materials/:materialId/content",
  run(async (req) => {
    const m = await materialAccess(req);
    if (m.enrolled && !m.file_url && !m.content_blob)
      await tx((db) => completeMaterial(db, m.course_id, req.user.sub, m.id));
    return {
      id: m.id,
      type: m.type,
      name: m.name,
      description: m.description,
      content_text: m.content_text,
      external_url: m.external_url,
      file: fileInfo(m.course_id, m),
    };
  }),
);
app.get(
  "/courses/:id/materials/:materialId/file",
  run(async (req, res) => {
    const m = await materialAccess(req);
    if (!m.file_url) throw new ApiError(404, "This material has no file");
    // Count a view/download once, not on every ranged chunk the video player requests.
    if (
      m.enrolled &&
      (!req.headers.range || /^bytes=0-/.test(req.headers.range))
    )
      await tx((db) => completeMaterial(db, m.course_id, req.user.sub, m.id));
    if (/^https?:\/\//i.test(m.file_url)) return res.redirect(m.file_url);
    const full = storedPath(m.file_url);
    await fs.promises.access(full).catch(() => {
      throw new ApiError(404, "This file is missing from storage");
    });
    const isVideo = m.type === "video" && m.mime_type.startsWith("video/"),
      isPdf =
        m.mime_type === "application/pdf" &&
        path.extname(m.file_name || "").toLowerCase() === ".pdf";
    const inline = (isVideo || isPdf) && req.query.download !== "1";
    res.set({
      "Content-Type":
        isVideo || isPdf ? m.mime_type : "application/octet-stream",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(m.file_name || "download")}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    });
    await new Promise((resolve, reject) =>
      res.sendFile(full, { dotfiles: "allow" }, (error) =>
        error ? reject(error) : resolve(),
      ),
    );
  }),
);
app.get(
  "/courses/:id",
  run(async (req) => {
    learner(req);
    const id = uuid(req.params.id);
    const course = await one(
      `SELECT c.id,c.title,c.slug,c.description,c.price,c.currency,c.status::text status,c.published_at,c.created_at,(c.cover_image IS NOT NULL) has_cover_image,c.instructor_id,ins.name instructor_name,ins.designation instructor_designation,ins.details instructor_details,(ins.image_blob IS NOT NULL) instructor_has_image,ins.social_links,${catNamesSql("courses", "c")} category_name,${catDetailsSql("courses", "c")} category_details,(SELECT count(*) FROM course_enrollments WHERE course_id=c.id AND status IN('active','completed')) enrollment_count,EXISTS(SELECT 1 FROM course_enrollments WHERE course_id=c.id AND user_id=$2 AND status IN('active','completed')) enrolled FROM courses c LEFT JOIN instructors ins ON ins.id=c.instructor_id WHERE c.id=$1 AND(c.status='published' OR c.creator_id=$2 OR $3='admin')`,
      [id, req.user.sub, req.user.role],
    );
    const materials = (
      await query(
        `SELECT m.id,m.name,m.description,m.type,m.mime_type,m.file_name,m.file_size,m.is_preview,(m.content_blob IS NOT NULL) has_blob,EXISTS(SELECT 1 FROM completed_course_materials WHERE material_id=m.id AND user_id=$2) completed FROM course_materials m WHERE m.course_id=$1 ORDER BY m.sort_order`,
        [id, req.user.sub],
      )
    ).rows;
    return {
      ...course,
      materials,
      progress_total: materials.length,
      progress_done: materials.filter((m) => m.completed).length,
    };
  }),
);
app.get(
  "/instructors/:id",
  run(async (req) => {
    learner(req);
    const id = uuid(req.params.id);
    const instructor = await one(
      "SELECT id,name,designation,details,social_links,(image_blob IS NOT NULL) has_image FROM instructors WHERE id=$1",
      [id],
    );
    const courses = (
      await query(
        `SELECT c.id,c.title,c.description,c.price,c.currency,(c.cover_image IS NOT NULL) has_cover_image,${catDetailsSql("courses", "c")} category_details FROM courses c WHERE c.instructor_id=$1 AND c.status='published' ORDER BY c.published_at DESC NULLS LAST,c.created_at DESC`,
        [id],
      )
    ).rows;
    return { ...instructor, courses };
  }),
);

// ---- Contest submissions: code/text in the database, image/audio files in backend storage ----
const submissionLimits = {
  image: 10 * MB,
  audio: Number(process.env.MAX_AUDIO_UPLOAD_MB || 50) * MB,
};
const imageMimes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
]);
const contestFileUrls = async (ids) =>
  (
    await query(
      "SELECT file_url FROM contest_submissions WHERE contest_id=ANY($1::uuid[]) AND file_url IS NOT NULL",
      [ids],
    )
  ).rows.map((row) => row.file_url);
const submissionUpload = multer({
  storage: multer.diskStorage({
    destination: (req, _file, cb) => {
      const dir = path.join(UPLOAD_ROOT, "contest-submissions", req.contest.id);
      fs.mkdir(dir, { recursive: true }, (error) => cb(error, dir));
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(decodeName(file.originalname)).toLowerCase();
      cb(
        null,
        `${crypto.randomUUID()}${/^\.[a-z0-9]{1,10}$/.test(ext) ? ext : ""}`,
      );
    },
  }),
  limits: { fileSize: Math.max(...Object.values(submissionLimits)) },
});
const submitGate = asyncHandler(async (req, _res, next) => {
  learner(req);
  const contest = await one(
    `SELECT c.id,${contestKindSql} submission_kind,(SELECT count(*) FROM contest_problems WHERE contest_id=c.id) problem_count FROM contests c WHERE c.id=$1 AND c.status='published' AND c.starting_time<=now() AND c.ending_time>=now()`,
    [uuid(req.params.id)],
  );
  await one(
    "SELECT 1 FROM contest_participants WHERE contest_id=$1 AND participant_id=$2 AND payment_status='paid'",
    [contest.id, req.user.sub],
  );
  req.contest = contest;
  next();
});
app.post(
  "/contests/:id/submit",
  submitGate,
  submissionUpload.single("file"),
  run(async (req) => {
    const file = req.file,
      contest = req.contest,
      kind = contest.submission_kind;
    try {
      const body = z
        .object({
          problem_id: z.string().uuid().nullish().or(z.literal("")),
          content: z.string().max(100000).optional(),
          language: z.string().trim().max(50).optional(),
        })
        .parse(req.body);
      let problemId = null;
      if (Number(contest.problem_count) > 0) {
        if (!body.problem_id)
          throw new ApiError(
            422,
            "Choose which problem you are submitting for",
          );
        problemId = body.problem_id;
      }
      let content = body.content?.trim() || null,
        fileFields = [null, null, null, null];
      if (kind === "image" || kind === "audio") {
        if (!file)
          throw new ApiError(
            422,
            kind === "image" ? "Upload an image" : "Upload an audio recording",
          );
        const okMime =
          kind === "image"
            ? imageMimes.has(file.mimetype)
            : file.mimetype.startsWith("audio/");
        if (!okMime)
          throw new ApiError(
            422,
            kind === "image"
              ? "Use a JPEG, PNG, WebP, GIF or AVIF image"
              : "Use an audio file (MP3, WAV, M4A, OGG…)",
          );
        if (file.size > submissionLimits[kind])
          throw new ApiError(
            413,
            `File is larger than ${Math.round(submissionLimits[kind] / MB)} MB`,
          );
        fileFields = [
          `/uploads/contest-submissions/${contest.id}/${file.filename}`,
          decodeName(file.originalname),
          file.size,
          file.mimetype,
        ];
      } else {
        if (file)
          throw new ApiError(
            422,
            "This contest takes written answers, not files",
          );
        if (!content)
          throw new ApiError(
            422,
            kind === "code" ? "Paste your code" : "Write your answer",
          );
      }
      const language = kind === "code" && body.language ? body.language : null;
      return (
        await query(
          "INSERT INTO contest_submissions(contest_id,participant_id,problem_id,content,language,file_url,file_name,file_size,mime_type) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id",
          [
            contest.id,
            req.user.sub,
            problemId,
            content,
            language,
            ...fileFields,
          ],
        )
      ).rows[0];
    } catch (error) {
      if (file) await fs.promises.unlink(file.path).catch(() => {});
      throw error;
    }
  }),
);
app.get(
  "/contests/:id/submissions/:submissionId/file",
  run(async (req, res) => {
    learner(req);
    const contest = await visibleContest(req);
    if (contest.phase === "upcoming" && req.user.role !== "admin")
      throw new ApiError(403, "Submissions open when the contest starts");
    const row = await one(
      "SELECT file_url,file_name,mime_type FROM contest_submissions WHERE id=$1 AND contest_id=$2 AND file_url IS NOT NULL",
      [uuid(req.params.submissionId), contest.id],
    );
    const full = storedPath(row.file_url);
    await fs.promises.access(full).catch(() => {
      throw new ApiError(404, "This file is missing from storage");
    });
    const safe =
      imageMimes.has(row.mime_type) || row.mime_type.startsWith("audio/");
    res.set({
      "Content-Type": safe ? row.mime_type : "application/octet-stream",
      "Content-Disposition": `${safe ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(row.file_name || "submission")}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    });
    await new Promise((resolve, reject) =>
      res.sendFile(full, { dotfiles: "allow" }, (error) =>
        error ? reject(error) : resolve(),
      ),
    );
  }),
);
app.get(
  "/manage/contests/:id/problems",
  run(async (req) => {
    admin(req);
    return (
      await query(
        "SELECT id,name,description,points FROM contest_problems WHERE contest_id=$1 ORDER BY sort_order",
        [uuid(req.params.id)],
      )
    ).rows;
  }),
);
app.post(
  "/manage/contests/:id/problems",
  run(async (req) => {
    admin(req);
    const b = z
      .object({
        name: z.string().min(1),
        description: z.string().min(1),
        points: z.number().nonnegative(),
      })
      .parse(req.body);
    return tx(async (db) => {
      await db.query("SELECT id FROM contests WHERE id=$1 FOR UPDATE", [
        uuid(req.params.id),
      ]);
      return (
        await db.query(
          `INSERT INTO contest_problems(creator_id,contest_id,name,description,points,sort_order) VALUES($1,$2,$3,$4,$5,(SELECT coalesce(max(sort_order),-1)+1 FROM contest_problems WHERE contest_id=$2)) RETURNING id`,
          [req.user.sub, req.params.id, b.name, b.description, b.points],
        )
      ).rows[0];
    });
  }),
);
app.get(
  "/manage/contests/:id/submissions",
  run(async (req) => {
    admin(req);
    return (
      await query(
        "SELECT s.id,s.content,s.score,s.status,s.problem_id,u.name,s.mime_type,s.file_name,(s.file_url IS NOT NULL) has_file FROM contest_submissions s JOIN users u ON u.id=s.participant_id WHERE contest_id=$1 ORDER BY submitted_at DESC LIMIT 100",
        [uuid(req.params.id)],
      )
    ).rows;
  }),
);
app.patch(
  "/manage/submissions/:id",
  run(async (req) => {
    admin(req);
    const b = z
      .object({
        score: z.number().nonnegative(),
        status: z.enum(["accepted", "rejected", "disqualified", "judging"]),
      })
      .parse(req.body);
    await tx(async (db) => {
      const sub = (
        await db.query(
          "SELECT contest_id,participant_id FROM contest_submissions WHERE id=$1",
          [uuid(req.params.id)],
        )
      ).rows[0];
      if (!sub) throw new ApiError(404, "Submission not found");
      await db.query(
        "SELECT 1 FROM contest_participants WHERE contest_id=$1 AND participant_id=$2 FOR UPDATE",
        [sub.contest_id, sub.participant_id],
      );
      await db.query(
        "UPDATE contest_submissions SET score=$1,status=$2,judged_at=now(),judged_by=$3 WHERE id=$4",
        [b.score, b.status, req.user.sub, req.params.id],
      );
      await db.query(
        `UPDATE contest_participants SET points=(SELECT coalesce(sum(best),0) FROM(SELECT max(score) best FROM contest_submissions WHERE contest_id=$1 AND participant_id=$2 AND status='accepted' GROUP BY problem_id) scores) WHERE contest_id=$1 AND participant_id=$2`,
        [sub.contest_id, sub.participant_id],
      );
    });
  }),
);
// ---- AI assistant (Google Gemini free API). The key stays on the server. ----
const aiSystemPrompt = `You are Uddeepto AI, a friendly and knowledgeable learning assistant inside Uddeepto, a skill development platform with courses, contests, webinars, communities and jobs.
- Reply in the same language the learner writes in (Bangla, English or a mix).
- Be accurate, clear and encouraging. Explain step by step when it helps; keep simple answers short.
- Format answers in GitHub-flavoured Markdown: use headings sparingly, numbered lists for steps, bullet lists for options, tables when comparing, and **bold** for key terms.
- Put every piece of code in fenced code blocks with a language tag (for example \`\`\`python).
- Write mathematics in LaTeX: inline as $...$ and display equations as $$...$$.
- If you are not sure about something, say so instead of guessing. Do not claim to browse the web or to know the learner's private data.`;
const aiRequests = new Map();
const aiFallbackModels = [
  "gemini-flash-latest",
  "gemini-3.8-flash",
  "gemini-flash-lite-latest",
  "gemini-2.5-flash",
];
let aiWorkingModel = null;
const aiMessages = z
  .array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string().trim().min(1).max(8000),
    }),
  )
  .min(1)
  .max(40);
const aiBody = z.object({ messages: aiMessages }).strict();
/** Calls Gemini for a learner. attachment = {mimeType, data(base64)} is shown to the model together with the first question. */
async function askGemini(userId, { system, messages, attachment }) {
  const key = process.env.GEMINI_API_KEY;
  if (!key)
    throw new ApiError(
      503,
      "The AI assistant is not configured yet. Ask an admin to add a Gemini API key.",
    );
  if (messages.at(-1).role !== "user")
    throw new ApiError(422, "Send a question to get an answer");
  const now = Date.now(),
    recent = (aiRequests.get(userId) || []).filter(
      (time) => now - time < 60000,
    );
  if (recent.length >= Number(process.env.AI_REQUESTS_PER_MINUTE || 12))
    throw new ApiError(
      429,
      "You are sending messages too quickly. Please wait a moment and try again.",
    );
  aiRequests.set(userId, [...recent, now]);
  const contents = messages
    .slice(-24)
    .map((item) => ({
      role: item.role === "assistant" ? "model" : "user",
      parts: [{ text: item.content }],
    }));
  if (attachment)
    contents[0].parts.unshift({
      inlineData: { mimeType: attachment.mimeType, data: attachment.data },
    });
  const payload = JSON.stringify({
    systemInstruction: { parts: [{ text: system }] },
    contents,
    generationConfig: { temperature: 0.7, maxOutputTokens: 4096 },
  });
  // Google retires Gemini models over time, so fall back to newer ones when a model has been removed.
  const candidates = [
    ...new Set(
      [aiWorkingModel, process.env.GEMINI_MODEL, ...aiFallbackModels].filter(
        Boolean,
      ),
    ),
  ];
  // Models can be retired (404) or overloaded (503/500). Try the next model, and one more full round, within a time budget.
  const retriable = new Set([404, 500, 502, 503, 504]);
  const deadline = Date.now() + 55000;
  let response;
  attempts: for (let round = 0; round < 2; round++) {
    for (const model of candidates) {
      const remaining = deadline - Date.now();
      if (remaining < 4000) break attempts;
      try {
        response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": key,
            },
            signal: AbortSignal.timeout(Math.min(25000, remaining)),
            body: payload,
          },
        );
      } catch {
        response = null;
        continue;
      }
      if (response.ok) {
        aiWorkingModel = model;
        break attempts;
      }
      if (!retriable.has(response.status)) break attempts;
      console.error(
        `[ai] Gemini model "${model}" returned ${response.status}. Trying another model.`,
      );
    }
    if (round === 0 && Date.now() + 6000 < deadline)
      await new Promise((resolve) =>
        setTimeout(resolve, Number(process.env.AI_RETRY_DELAY_MS || 1500)),
      );
  }
  if (!response)
    throw new ApiError(
      504,
      "The AI assistant took too long to answer. Please try again.",
    );
  if (response.status === 503 || response.status === 500)
    throw new ApiError(
      503,
      "The AI service is very busy right now. Please try again in a moment.",
    );
  if (response.status === 429)
    throw new ApiError(
      429,
      "The AI assistant is busy right now (free quota reached). Please try again in a little while.",
    );
  if (!response.ok) {
    console.error(
      "[ai] Gemini error",
      response.status,
      (await response.text().catch(() => "")).slice(0, 300),
    );
    throw new ApiError(
      502,
      "The AI assistant could not answer right now. Please try again.",
    );
  }
  const data = await response.json();
  if (data.promptFeedback?.blockReason)
    throw new ApiError(
      422,
      "I can’t help with that request. Try rephrasing your question.",
    );
  const candidate = data.candidates?.[0];
  const text = (candidate?.content?.parts || [])
    .map((part) => part.text || "")
    .join("")
    .trim();
  if (!text)
    throw new ApiError(
      502,
      "The AI assistant returned an empty answer. Please try again.",
    );
  return { reply: text, truncated: candidate?.finishReason === "MAX_TOKENS" };
}
const learnerOnly = (req) => {
  if (req.user.role !== "learner")
    throw new ApiError(403, "The AI assistant is available to learners");
};
app.post(
  "/ai/chat",
  run(async (req) => {
    learnerOnly(req);
    const { messages } = aiBody.parse(req.body);
    return askGemini(req.user.sub, { system: aiSystemPrompt, messages });
  }),
);

// Help a new account choose its interests. Open to learners and hirers, and grounded in the interests that really exist.
app.post('/ai/interests',run(async req=>{
  if(!['learner','hirer'].includes(req.user.role))throw new ApiError(403,'The interest guide is available to learners and hirers');
  const{messages}=aiBody.parse(req.body);
  const interests=(await query('SELECT name,description FROM interest_categories WHERE is_active=true ORDER BY name')).rows;
  const list=interests.map(item=>item.description?item.name+' ('+item.description.slice(0,80)+')':item.name).join('; ');
  const system=aiSystemPrompt+'\n\nYou are helping a new '+req.user.role+' choose the interests for their Uddeepto profile. Interests decide which courses, contests, webinars and communities are recommended.\nThe interests that exist on the platform are exactly: '+list+'.\n- Ask one or two short questions about their goals, hobbies or job if that helps.\n- Recommend 1 to 4 interests, using ONLY the exact names from the list above, written in **bold**. Never invent an interest that is not in the list.\n- Explain each pick in one short sentence. Keep replies under 120 words unless asked for more.\n- Remind them they can change their interests later from their profile.';
  return askGemini(req.user.sub,{system,messages});
}));
app.put('/profile/interests',run(async req=>{
  const body=z.object({interest_ids:z.array(z.string().uuid()).min(1,'Choose at least one interest').max(30)}).strict().parse(req.body);
  const ids=[...new Set(body.interest_ids)];
  await tx(async db=>{
    if((await db.query('SELECT id FROM interest_categories WHERE id=ANY($1::uuid[]) AND is_active=true',[ids])).rowCount!==ids.length)throw new ApiError(422,'One or more interests are not available');
    await db.query('DELETE FROM user_interests WHERE user_id=$1',[req.user.sub]);
    await db.query('INSERT INTO user_interests(user_id,interest_id) SELECT $1,unnest($2::uuid[])',[req.user.sub,ids]);
  });
  return{interest_ids:ids};
}));

// Ask about the course material the learner is looking at. Text lessons, small PDFs and small videos are given to the model in full;
// other files are described by their title and description only, and the answer says which level of context was used.
const AI_INLINE_LIMIT = 15 * 1024 * 1024;
app.post(
  "/courses/:id/materials/:materialId/ai",
  run(async (req) => {
    learnerOnly(req);
    const m = await materialAccess(req);
    const { messages } = aiBody.parse(req.body);
    const course = await one("SELECT title FROM courses WHERE id=$1", [
      m.course_id,
    ]);
    let attachment = null,
      context = "metadata",
      lessonText = "";
    if (m.type === "text" && m.content_text) {
      lessonText = m.content_text.slice(0, 20000);
      context = "full";
    } else if (
      m.file_url &&
      !/^https?:/i.test(m.file_url) &&
      Number(m.file_size) <= AI_INLINE_LIMIT &&
      (m.mime_type === "application/pdf" ||
        m.mime_type.startsWith("video/") ||
        m.mime_type === "text/plain")
    ) {
      try {
        attachment = {
          mimeType: m.mime_type,
          data: (await fs.promises.readFile(storedPath(m.file_url))).toString(
            "base64",
          ),
        };
        context = "full";
      } catch {
        /* file missing: fall back to metadata */
      }
    }
    const kind =
      {
        video: "lecture video",
        document: "document",
        text: "reading lesson",
        other: "file",
      }[m.type] || "material";
    const about = `The learner is studying the course "${course.title}" and is asking about this ${kind}: "${m.name}".${m.description ? ` Description: ${m.description}` : ""}`;
    const access =
      context === "full"
        ? attachment
          ? `The full ${kind} is attached to the first message. Base your answers on it and refer to specific parts (timestamps for videos, sections or pages for documents) when useful.`
          : `The full lesson text is below. Base your answers on it.\n\n"""\n${lessonText}\n"""`
        : "You cannot open the file itself, only its title and description. Answer from that and from general knowledge, and say clearly when a question needs the actual content.";
    const system = `${aiSystemPrompt}\n\n${about}\n${access}\nStay focused on helping the learner understand this material and the topic around it.`;
    const result = await askGemini(req.user.sub, {
      system,
      messages,
      attachment,
    });
    return { ...result, context };
  }),
);
// ---- Global search: people, courses, contests, webinars, jobs and communities in one place ----
const searchEscape = (value) => value.replace(/[\\%_]/g, "\\$&");
const categoryMatch = (table, fk, alias) =>
  `EXISTS(SELECT 1 FROM ${table} sc JOIN interest_categories sic ON sic.id=sc.category_id WHERE sc.${fk}=${alias}.id AND sic.name ILIKE $1)`;
const shortDay = (value) =>
  value ? new Date(value).toISOString().slice(0, 10) : "";
// Each type has a WHERE builder (u = placeholder of the user id, r = of the role) plus SELECT/ORDER and a mapper to a common result shape.
const searchTypes = {
  users: {
    roles: ["learner", "hirer", "admin"],
    label: "People",
    from: () =>
      `users u WHERE u.account_status='active' AND(u.name ILIKE $1 OR u.username::text ILIKE $1 OR u.uddeepto_id ILIKE $1 OR coalesce(u.headline,'') ILIKE $1)`,
    select:
      "u.id,u.uddeepto_id,u.name,u.username,u.headline,u.role::text role,(u.picture IS NOT NULL) has_picture",
    order: "(u.name ILIKE $2) DESC,u.name",
    map: (row) => ({
      type: "users",
      id: row.id,
      title: row.name,
      subtitle: [`@${row.username}`, row.headline || row.role]
        .filter(Boolean)
        .join(" · "),
      href: `/profile/${row.uddeepto_id}`,
      image: row.has_picture
        ? `/api/backend/frontend/profile/${row.id}/picture`
        : null,
      meta: row.uddeepto_id,
    }),
  },
  courses: {
    roles: ["learner", "admin"],
    label: "Courses",
    from: () =>
      `courses c LEFT JOIN instructors ins ON ins.id=c.instructor_id WHERE c.status='published' AND(c.title ILIKE $1 OR c.description ILIKE $1 OR coalesce(ins.name,'') ILIKE $1 OR ${categoryMatch("course_categories", "course_id", "c")})`,
    select: `c.id,c.title,c.price,c.currency,(c.cover_image IS NOT NULL) has_cover_image,ins.name instructor_name,${catNamesSql("courses", "c")} category_name`,
    order: "(c.title ILIKE $2) DESC,c.published_at DESC NULLS LAST",
    map: (row) => ({
      type: "courses",
      id: row.id,
      title: row.title,
      subtitle: [row.instructor_name, row.category_name]
        .filter(Boolean)
        .join(" · "),
      href: `/courses/${row.id}`,
      image: row.has_cover_image
        ? `/api/backend/frontend/course-covers/${row.id}`
        : null,
      meta:
        Number(row.price) === 0
          ? "Free"
          : `${row.currency} ${Number(row.price)}`,
    }),
  },
  contests: {
    roles: ["learner", "admin"],
    label: "Contests",
    from: () =>
      `contests c WHERE c.status IN('published','completed') AND(c.name ILIKE $1 OR c.description ILIKE $1 OR ${categoryMatch("contest_categories", "contest_id", "c")})`,
    select: `c.id,c.name,c.starting_time,c.ending_time,c.status::text status,${catNamesSql("contests", "c")} category_name`,
    order: "(c.name ILIKE $2) DESC,c.starting_time DESC",
    map: (row) => ({
      type: "contests",
      id: row.id,
      title: row.name,
      subtitle: row.category_name || "Contest",
      href: `/contests/${row.id}`,
      image: null,
      meta:
        new Date(row.ending_time) < new Date() || row.status === "completed"
          ? "Ended"
          : new Date(row.starting_time) > new Date()
            ? `Starts ${shortDay(row.starting_time)}`
            : "Live now",
    }),
  },
  webinars: {
    roles: ["learner", "admin"],
    label: "Webinars",
    from: () =>
      `webinars w WHERE w.status IN('scheduled','live','completed') AND(w.name ILIKE $1 OR w.description ILIKE $1 OR ${categoryMatch("webinar_categories", "webinar_id", "w")} OR EXISTS(SELECT 1 FROM webinar_speakers ws JOIN instructors si ON si.id=ws.instructor_id WHERE ws.webinar_id=w.id AND si.name ILIKE $1))`,
    select: `w.id,w.name,w.starting_time,w.ending_time,w.status::text status,${speakerNamesSql("w")} speaker_names`,
    order: "(w.name ILIKE $2) DESC,w.starting_time DESC",
    map: (row) => ({
      type: "webinars",
      id: row.id,
      title: row.name,
      subtitle: row.speaker_names ? `with ${row.speaker_names}` : "Webinar",
      href: `/webinars/${row.id}`,
      image: null,
      meta:
        new Date(row.ending_time) < new Date() || row.status === "completed"
          ? "Ended"
          : new Date(row.starting_time) > new Date()
            ? `Starts ${shortDay(row.starting_time)}`
            : "Live now",
    }),
  },
  jobs: {
    roles: ["learner", "hirer", "admin"],
    label: "Jobs",
    from: (u, r) =>
      `jobs j JOIN users ju ON ju.id=j.creator_id WHERE((j.status='open' AND(j.application_deadline IS NULL OR j.application_deadline>now())) OR j.creator_id=${u} OR ${r}='admin') AND(j.title ILIKE $1 OR j.description ILIKE $1 OR coalesce(j.location,'') ILIKE $1 OR ju.name ILIKE $1)`,
    select:
      "j.id,j.title,j.location,j.is_remote,j.type::text type,j.status::text status,ju.name company",
    order: "(j.title ILIKE $2) DESC,j.created_at DESC",
    map: (row) => ({
      type: "jobs",
      id: row.id,
      title: row.title,
      subtitle: [row.company, row.is_remote ? "Remote" : row.location]
        .filter(Boolean)
        .join(" · "),
      href: `/jobs/${row.id}`,
      image: null,
      meta: row.type.replaceAll("_", " "),
    }),
  },
  communities: {
    roles: ["learner"],
    label: "Communities",
    from: (u) =>
      `communities c WHERE(NOT c.is_private OR c.creator_id=${u} OR EXISTS(SELECT 1 FROM community_members m WHERE m.community_id=c.id AND m.member_id=${u} AND m.status='approved')) AND(c.name ILIKE $1 OR c.description ILIKE $1 OR ${categoryMatch("community_categories", "community_id", "c")})`,
    select: `c.id,c.name,c.description,(SELECT count(*) FROM community_members WHERE community_id=c.id AND status='approved')::int member_count`,
    order: "(c.name ILIKE $2) DESC,c.created_at DESC",
    map: (row) => ({
      type: "communities",
      id: row.id,
      title: row.name,
      subtitle: (row.description || "").slice(0, 90),
      href: `/communities/${row.id}`,
      image: null,
      meta: `${row.member_count} member${row.member_count === 1 ? "" : "s"}`,
    }),
  },
};
app.get(
  "/search",
  run(async (req) => {
    const q = String(req.query.q || "")
      .trim()
      .slice(0, 100);
    const allowed = Object.keys(searchTypes).filter((key) =>
      searchTypes[key].roles.includes(req.user.role),
    );
    const labels = Object.fromEntries(
      allowed.map((key) => [key, searchTypes[key].label]),
    );
    if (q.length < 2)
      return { q, types: allowed, labels, counts: {}, results: {} };
    const type = req.query.type ? String(req.query.type) : "";
    if (type && !allowed.includes(type))
      throw new ApiError(422, "Unknown search type");
    const limit = Math.min(
      Math.max(parseInt(req.query.limit) || (type ? 20 : 4), 1),
      50,
    );
    const offset = type ? Math.max(parseInt(req.query.offset) || 0, 0) : 0;
    const like = `%${searchEscape(q)}%`,
      prefix = `${searchEscape(q)}%`;
    const counts = {},
      results = {};
    await Promise.all(
      allowed.map(async (key) => {
        const config = searchTypes[key];
        const bindings = (sql, values) =>
          values.slice(
            0,
            Math.max(
              ...[...sql.matchAll(/\$(\d+)/g)].map((match) => Number(match[1])),
            ),
          );
        const countSql = `SELECT count(*) FROM ${config.from("$2", "$3")}`;
        counts[key] = Number(
          (
            await query(
              countSql,
              bindings(countSql, [like, req.user.sub, req.user.role]),
            )
          ).rows[0].count,
        );
        if (type && type !== key) return;
        const rowsSql = `SELECT ${config.select} FROM ${config.from("$5", "$6")} ORDER BY ${config.order} LIMIT $3 OFFSET $4`;
        const rows = (
          await query(
            rowsSql,
            bindings(rowsSql, [
              like,
              prefix,
              limit,
              offset,
              req.user.sub,
              req.user.role,
            ]),
          )
        ).rows;
        results[key] = rows.map(config.map);
      }),
    );
    return { q, types: allowed, labels, counts, results };
  }),
);
listen(app, process.env.FRONTEND_API_PORT || 4010, "frontend-api");
