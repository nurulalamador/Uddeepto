import express from "express";
import {
  createApp,
  resourceRouter,
  query,
  asyncHandler,
  auth,
  upload,
  ApiError,
  listen,
} from "@uddeepto/common";
const app = createApp("courses"),
  r = express.Router();
r.get(
  "/:id/materials",
  auth(false),
  asyncHandler(async (q, s) =>
    s.json(
      (
        await query(
          `SELECT id,course_id,name,description,type,mime_type,content_text,external_url,sort_order,is_preview,created_at FROM course_materials WHERE course_id=$1 ORDER BY sort_order`,
          [q.params.id],
        )
      ).rows,
    ),
  ),
);
r.post(
  "/:id/materials",
  auth(),
  upload.single("file"),
  asyncHandler(async (q, s) => {
    const own = await query(
      `SELECT 1 FROM courses WHERE id=$1 AND (creator_id=$2 OR $3 IN ('admin','moderator'))`,
      [q.params.id, q.user.sub, q.user.role],
    );
    if (!own.rowCount) throw new ApiError(403, "Not course owner");
    const vals = [
      q.params.id,
      q.body.name,
      q.body.description,
      q.body.type,
      q.file?.mimetype,
      q.file?.buffer,
      q.body.content_text,
      q.body.external_url,
      q.body.sort_order || 0,
      q.body.is_preview === "true",
    ];
    const x = await query(
      `INSERT INTO course_materials(course_id,name,description,type,mime_type,content_blob,content_text,external_url,sort_order,is_preview) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id,course_id,name,type,sort_order,is_preview`,
      vals,
    );
    s.status(201).json(x.rows[0]);
  }),
);
r.get(
  "/:courseId/materials/:materialId/content",
  auth(false),
  asyncHandler(async (q, s) => {
    const x = (
      await query(
        `SELECT m.*,c.creator_id,EXISTS(SELECT 1 FROM course_enrollments e WHERE e.course_id=c.id AND e.user_id=$3 AND e.status IN ('active','completed')) enrolled FROM course_materials m JOIN courses c ON c.id=m.course_id WHERE m.id=$1 AND m.course_id=$2`,
        [q.params.materialId, q.params.courseId, q.user?.sub || null],
      )
    ).rows[0];
    if (!x) throw new ApiError(404, "Material not found");
    if (!x.is_preview && !x.enrolled && x.creator_id !== q.user?.sub)
      throw new ApiError(403, "Enrollment required");
    if (x.content_blob) return s.type(x.mime_type).send(x.content_blob);
    s.json({ content_text: x.content_text, external_url: x.external_url });
  }),
);
r.post(
  "/:id/enroll",
  auth(),
  asyncHandler(async (q, s) => {
    const c = (
      await query(
        `SELECT price,currency FROM courses WHERE id=$1 AND status='published'`,
        [q.params.id],
      )
    ).rows[0];
    if (!c) throw new ApiError(404, "Published course not found");
    if (Number(c.price) > 0)
      throw new ApiError(402, "Complete payment before enrollment");
    await query(
      `INSERT INTO course_enrollments(course_id,user_id,price_paid,currency) VALUES($1,$2,0,$3) ON CONFLICT(course_id,user_id) DO UPDATE SET status='active'`,
      [q.params.id, q.user.sub, c.currency],
    );
    s.status(201).json({ enrolled: true });
  }),
);
r.get(
  "/me/enrollments",
  auth(),
  asyncHandler(async (q, s) =>
    s.json(
      (
        await query(
          `SELECT e.*,c.title,c.slug FROM course_enrollments e JOIN courses c ON c.id=e.course_id WHERE e.user_id=$1 ORDER BY e.enrolled_at DESC`,
          [q.user.sub],
        )
      ).rows,
    ),
  ),
);
r.use(
  "/",
  resourceRouter({
    table: "courses",
    fields: [
      "title",
      "slug",
      "description",
      "price",
      "currency",
      "category_id",
      "instructor_id",
      "status",
      "published_at",
    ],
    required: ["title", "slug", "description", "category_id", "instructor_id"],
    createRoles: ["admin"],
    adminOnlyWrites: true,
    search: ["title", "description"],
    adminOnlyFields: ["status", "published_at"],
  }),
);
app.use("/", r);
listen(app, process.env.COURSES_PORT || 4003, "courses");
