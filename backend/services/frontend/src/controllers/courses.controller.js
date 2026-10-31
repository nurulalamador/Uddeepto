import { learner, admin, learnerOnly } from "../middleware/permissions.middleware.js";
import { run } from "../middleware/response.middleware.js";
import { askGemini } from "../services/ai.service.js";
import { completeMaterial, checkMaterialFile, materialAccess, quizPasses, fileInfo, AI_INLINE_LIMIT, quizCheckpoint, quizMaterial, ensureQuiz, QUIZ_PASS_RATIO } from "../services/courses.service.js";
import { one, uuid, decodeName, notifyRows, removeStored, storedPath, catNamesSql, catDetailsSql, aiSystemPrompt } from "../services/shared.service.js";
import { materialBody } from "../validators/courses.validators.js";
import { aiBody } from "../validators/shared.validators.js";
import { ApiError, tx, query } from "@uddeepto/common";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
export const getCourseCoversById = run(async (req, res) => {
  const course = await one(`SELECT cover_image,cover_image_mime_type FROM courses WHERE id=$1 AND(status='published' OR creator_id=$2 OR $3='admin')`, [uuid(req.params.id), req.user.sub, req.user.role]);
  if (!course.cover_image) throw new ApiError(404, "Course cover not found");
  res.set("Cache-Control", "private, max-age=300").type(course.cover_image_mime_type).send(course.cover_image);
});
export const putCoursesByIdCompleteByMaterialId = run(async req => {
  learner(req);
  await tx(async db => {
    const e = await db.query(`SELECT 1 FROM course_enrollments WHERE course_id=$1 AND user_id=$2 AND status IN('active','completed') FOR UPDATE`, [uuid(req.params.id), req.user.sub]);
    if (!e.rowCount) throw new ApiError(403, "Enrollment required");
    await completeMaterial(db, req.params.id, req.user.sub, uuid(req.params.materialId));
  });
});
export const getManageCoursesByIdMaterials = run(async req => {
  admin(req);
  return (await query("SELECT id,name,description,type,mime_type,file_name,file_size,sort_order,content_text,external_url,is_preview FROM course_materials WHERE course_id=$1 ORDER BY sort_order", [uuid(req.params.id)])).rows;
});
export const createManageCoursesByIdMaterials = run(async req => {
  const file = req.file;
  try {
    const courseId = uuid(req.params.id);
    const b = materialBody.parse(req.body);
    const type = b.type || "text";
    const preview = b.is_preview === true || b.is_preview === "true";
    let fileFields = [null, null, null, null];
    if (type === "text") {
      if (file) throw new ApiError(422, "Text lessons cannot have a file");
      if (!b.content_text?.trim()) throw new ApiError(422, "Write the lesson content");
    } else {
      if (!file) throw new ApiError(422, "Choose a file to upload");
      checkMaterialFile(type, file);
      fileFields = [`/uploads/course-materials/${courseId}/${file.filename}`, decodeName(file.originalname), file.size, file.mimetype];
    }
    const created = await tx(async db => {
      // Check and lock on the transaction's own connection (a second pool connection here could deadlock).
      const locked = await db.query("SELECT id FROM courses WHERE id=$1 FOR UPDATE", [courseId]);
      if (!locked.rowCount) throw new ApiError(404, "Not found");
      return (await db.query(`INSERT INTO course_materials(course_id,name,description,type,content_text,file_url,file_name,file_size,mime_type,is_preview,sort_order) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,(SELECT coalesce(max(sort_order),-1)+1 FROM course_materials WHERE course_id=$1)) RETURNING id`, [courseId, b.name, b.description || null, type, type === "text" ? b.content_text : null, ...fileFields, preview])).rows[0];
    });
    const course = (await query("SELECT title FROM courses WHERE id=$1", [courseId])).rows[0];
    await notifyRows("SELECT user_id id FROM course_enrollments WHERE course_id=$1 AND status IN('active','completed')", courseId, {
      actor: req.user.sub,
      type: "course_material_added",
      title: `New lesson in ${course.title}`,
      body: b.name,
      link: `/courses/${courseId}/materials/${created.id}`,
      entity: ["course_material", created.id],
      key: `material:${created.id}`
    });
    return created;
  } catch (error) {
    if (file) await fs.promises.unlink(file.path).catch(() => {});
    throw error;
  }
});
export const deleteManageCoursesByIdMaterialsByMaterialId = run(async req => {
  admin(req);
  const row = (await query("DELETE FROM course_materials WHERE id=$1 AND course_id=$2 RETURNING file_url", [uuid(req.params.materialId), uuid(req.params.id)])).rows[0];
  if (!row) throw new ApiError(404, "Material not found");
  await removeStored([row.file_url]);
  return {
    deleted: true
  };
});
export const getCoursesByIdMaterialsByMaterialIdContent = run(async req => {
  const m = await materialAccess(req);
  if (m.enrolled && !m.file_url && !m.content_blob) await tx(db => completeMaterial(db, m.course_id, req.user.sub, m.id));
  // A video the learner has not finished yet is played with check-point questions.
  let quiz = null;
  if (m.enrolled && m.type === "video" && m.file_url) {
    const done = await query("SELECT 1 FROM completed_course_materials WHERE user_id=$1 AND material_id=$2", [req.user.sub, m.id]);
    quiz = {
      completed: done.rowCount > 0,
      passed: await quizPasses(req.user.sub, m.id)
    };
  }
  return {
    quiz,
    id: m.id,
    type: m.type,
    name: m.name,
    description: m.description,
    content_text: m.content_text,
    external_url: m.external_url,
    file: fileInfo(m.course_id, m)
  };
});
export const getCoursesByIdMaterialsByMaterialIdFile = run(async (req, res) => {
  const m = await materialAccess(req);
  if (!m.file_url) throw new ApiError(404, "This material has no file");
  // Count a view/download once, not on every ranged chunk the video player requests.
  if (m.enrolled && m.type !== "video" && (!req.headers.range || /^bytes=0-/.test(req.headers.range))) await tx(db => completeMaterial(db, m.course_id, req.user.sub, m.id));
  if (/^https?:\/\//i.test(m.file_url)) return res.redirect(m.file_url);
  const full = storedPath(m.file_url);
  await fs.promises.access(full).catch(() => {
    throw new ApiError(404, "This file is missing from storage");
  });
  const isVideo = m.type === "video" && m.mime_type.startsWith("video/"),
    isPdf = m.mime_type === "application/pdf" && path.extname(m.file_name || "").toLowerCase() === ".pdf";
  const inline = (isVideo || isPdf) && req.query.download !== "1";
  res.set({
    "Content-Type": isVideo || isPdf ? m.mime_type : "application/octet-stream",
    "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(m.file_name || "download")}`,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff"
  });
  await new Promise((resolve, reject) => res.sendFile(full, {
    dotfiles: "allow"
  }, error => error ? reject(error) : resolve()));
});
export const getCoursesById = run(async req => {
  learner(req);
  const id = uuid(req.params.id);
  const course = await one(`SELECT c.id,c.title,c.slug,c.description,c.price,c.currency,c.status::text status,c.published_at,c.created_at,(c.cover_image IS NOT NULL) has_cover_image,c.instructor_id,ins.name instructor_name,ins.designation instructor_designation,ins.details instructor_details,(ins.image_blob IS NOT NULL) instructor_has_image,ins.social_links,${catNamesSql("courses", "c")} category_name,${catDetailsSql("courses", "c")} category_details,(SELECT count(*) FROM course_enrollments WHERE course_id=c.id AND status IN('active','completed')) enrollment_count,EXISTS(SELECT 1 FROM course_enrollments WHERE course_id=c.id AND user_id=$2 AND status IN('active','completed')) enrolled FROM courses c LEFT JOIN instructors ins ON ins.id=c.instructor_id WHERE c.id=$1 AND(c.status='published' OR c.creator_id=$2 OR $3='admin')`, [id, req.user.sub, req.user.role]);
  const materials = (await query(`SELECT m.id,m.name,m.description,m.type,m.mime_type,m.file_name,m.file_size,m.is_preview,(m.content_blob IS NOT NULL) has_blob,EXISTS(SELECT 1 FROM completed_course_materials WHERE material_id=m.id AND user_id=$2) completed FROM course_materials m WHERE m.course_id=$1 ORDER BY m.sort_order`, [id, req.user.sub])).rows;
  return {
    ...course,
    materials,
    progress_total: materials.length,
    progress_done: materials.filter(m => m.completed).length
  };
});
export const createCoursesByIdMaterialsByMaterialIdAi = run(async req => {
  learnerOnly(req);
  const m = await materialAccess(req);
  const {
    messages
  } = aiBody.parse(req.body);
  const course = await one("SELECT title FROM courses WHERE id=$1", [m.course_id]);
  let attachment = null,
    context = "metadata",
    lessonText = "";
  if (m.type === "text" && m.content_text) {
    lessonText = m.content_text.slice(0, 20000);
    context = "full";
  } else if (m.file_url && !/^https?:/i.test(m.file_url) && Number(m.file_size) <= AI_INLINE_LIMIT && (m.mime_type === "application/pdf" || m.mime_type.startsWith("video/") || m.mime_type === "text/plain")) {
    try {
      attachment = {
        mimeType: m.mime_type,
        data: (await fs.promises.readFile(storedPath(m.file_url))).toString("base64")
      };
      context = "full";
    } catch {
      /* file missing: fall back to metadata */
    }
  }
  const kind = {
    video: "lecture video",
    document: "document",
    text: "reading lesson",
    other: "file"
  }[m.type] || "material";
  const about = `The learner is studying the course "${course.title}" and is asking about this ${kind}: "${m.name}".${m.description ? ` Description: ${m.description}` : ""}`;
  const access = context === "full" ? attachment ? `The full ${kind} is attached to the first message. Base your answers on it and refer to specific parts (timestamps for videos, sections or pages for documents) when useful.` : `The full lesson text is below. Base your answers on it.\n\n"""\n${lessonText}\n"""` : "You cannot open the file itself, only its title and description. Answer from that and from general knowledge, and say clearly when a question needs the actual content.";
  const system = `${aiSystemPrompt}\n\n${about}\n${access}\nStay focused on helping the learner understand this material and the topic around it.`;
  const result = await askGemini(req.user.sub, {
    system,
    messages,
    attachment
  });
  return {
    ...result,
    context
  };
});
export const getCoursesByIdMaterialsByMaterialIdQuizByCheckpoint = run(async req => {
  const checkpoint = quizCheckpoint(req);
  const context = await quizMaterial(req);
  const {
    m,
    key
  } = context;
  const passed = await quizPasses(req.user.sub, m.id);
  if (!(await ensureQuiz(req.user.sub, context))) {
    // No questions could be written: do not block the learner. Reaching the end of the video completes it.
    if (checkpoint === 3) await tx(db => completeMaterial(db, m.course_id, req.user.sub, m.id));
    return {
      available: false,
      checkpoint,
      passed
    };
  }
  const questions = (await query(`SELECT id,question,options FROM material_quiz_questions WHERE material_id=$1 AND checkpoint=$2 AND source_key=$3 ORDER BY position`, [m.id, checkpoint, key])).rows;
  return {
    available: true,
    checkpoint,
    passed,
    questions
  };
});
export const createCoursesByIdMaterialsByMaterialIdQuizByCheckpoint = run(async req => {
  const checkpoint = quizCheckpoint(req);
  const {
    m,
    key
  } = await quizMaterial(req);
  const {
    answers
  } = z.object({
    answers: z.array(z.coerce.number().int().min(0).max(3)).min(1).max(20)
  }).strict().parse(req.body);
  const questions = (await query(`SELECT id,question,options,correct_index,explanation FROM material_quiz_questions WHERE material_id=$1 AND checkpoint=$2 AND source_key=$3 ORDER BY position`, [m.id, checkpoint, key])).rows;
  if (!questions.length) throw new ApiError(404, "There are no questions for this check-point");
  if (answers.length !== questions.length) throw new ApiError(422, "Answer every question");
  const earlier = await quizPasses(req.user.sub, m.id);
  for (let step = 1; step < checkpoint; step++) if (!earlier.includes(step)) throw new ApiError(409, "Answer the earlier check-point questions first");
  const results = questions.map((item, index) => answers[index] === item.correct_index);
  const correct = results.filter(Boolean).length;
  const needed = Math.ceil(questions.length * QUIZ_PASS_RATIO);
  const passed = correct >= needed;
  if (passed) {
    await tx(async db => {
      await db.query("INSERT INTO material_quiz_passes(user_id,material_id,checkpoint) VALUES($1,$2,$3) ON CONFLICT DO NOTHING", [req.user.sub, m.id, checkpoint]);
      if (checkpoint === 3) await completeMaterial(db, m.course_id, req.user.sub, m.id);
    });
  }
  return {
    passed,
    correct,
    total: questions.length,
    needed,
    results,
    completed: passed && checkpoint === 3,
    // The right answers are only shown once the learner has passed.
    review: passed ? questions.map(item => ({
      correct_index: item.correct_index,
      explanation: item.explanation
    })) : undefined
  };
});
