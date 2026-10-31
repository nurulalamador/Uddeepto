import { MB, UPLOAD_ROOT } from "../config/storage.config.js";
import { learner } from "../middleware/permissions.middleware.js";
import { quizSchema } from "../validators/courses.validators.js";
import { askGemini } from "./ai.service.js";
import { decodeName, one, uuid } from "./shared.service.js";
import { multer, ApiError, query, tx } from "@uddeepto/common";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
export const materialLimits = {
  video: Number(process.env.MAX_VIDEO_UPLOAD_MB || 500) * MB,
  document: Number(process.env.MAX_DOCUMENT_UPLOAD_MB || 50) * MB,
  other: Number(process.env.MAX_OTHER_UPLOAD_MB || 100) * MB
};
export const documentExts = new Set([".pdf", ".doc", ".docx", ".ppt", ".pptx", ".xls", ".xlsx", ".odt", ".odp", ".ods", ".rtf", ".txt", ".csv", ".md"]);
export const blockedExts = new Set([".exe", ".bat", ".cmd", ".com", ".msi", ".scr", ".ps1", ".sh", ".js", ".mjs", ".vbs", ".jar", ".html", ".htm", ".svg", ".php", ".dll"]);
export const materialUpload = multer({
  storage: multer.diskStorage({
    destination: (req, _file, cb) => {
      const id = z.string().uuid().safeParse(req.params.id);
      if (!id.success) return cb(new ApiError(422, "Invalid course"));
      const dir = path.join(UPLOAD_ROOT, "course-materials", id.data);
      fs.mkdir(dir, {
        recursive: true
      }, error => cb(error, dir));
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(decodeName(file.originalname)).toLowerCase();
      cb(null, `${crypto.randomUUID()}${/^\.[a-z0-9]{1,10}$/.test(ext) ? ext : ""}`);
    }
  }),
  limits: {
    fileSize: Math.max(...Object.values(materialLimits))
  }
});
export function checkMaterialFile(type, file) {
  const ext = path.extname(decodeName(file.originalname)).toLowerCase();
  if (blockedExts.has(ext)) throw new ApiError(422, "This file type is not allowed");
  if (type === "video" && !file.mimetype.startsWith("video/")) throw new ApiError(422, "Video lectures must be video files (MP4, WebM, MOV…)");
  if (type === "document" && !documentExts.has(ext)) throw new ApiError(422, "Documents must be PDF, Word, PowerPoint, Excel, OpenDocument, RTF, TXT, CSV or Markdown files");
  if (file.size > materialLimits[type]) throw new ApiError(413, `${type === "video" ? "Video" : type === "document" ? "Document" : "File"} is larger than ${Math.round(materialLimits[type] / MB)} MB`);
}
export async function completeMaterial(db, courseId, userId, materialId) {
  await db.query("INSERT INTO completed_course_materials(course_id,user_id,material_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING", [courseId, userId, materialId]);
  await db.query("UPDATE course_enrollments SET last_accessed_at=now() WHERE course_id=$1 AND user_id=$2", [courseId, userId]);
  await db.query(`UPDATE course_enrollments SET status='completed',completed_at=now() WHERE course_id=$1 AND user_id=$2 AND status='active' AND NOT EXISTS(SELECT 1 FROM course_materials m WHERE course_id=$1 AND NOT EXISTS(SELECT 1 FROM completed_course_materials WHERE material_id=m.id AND user_id=$2))`, [courseId, userId]);
}
export async function materialAccess(req) {
  learner(req);
  const m = await one(`SELECT m.*,c.creator_id,c.status::text course_status,EXISTS(SELECT 1 FROM course_enrollments e WHERE e.course_id=c.id AND e.user_id=$3 AND e.status IN('active','completed')) enrolled FROM course_materials m JOIN courses c ON c.id=m.course_id WHERE m.id=$1 AND m.course_id=$2`, [uuid(req.params.materialId), uuid(req.params.id), req.user.sub]);
  const staff = req.user.role === "admin" || m.creator_id === req.user.sub;
  if (!staff && (m.course_status !== "published" || !(m.is_preview || m.enrolled))) throw new ApiError(403, "Enroll in this course to open this material");
  return m;
}
export const fileInfo = (courseId, m) => m.file_url ? {
  url: `/api/backend/frontend/courses/${courseId}/materials/${m.id}/file`,
  name: m.file_name,
  size: Number(m.file_size),
  mime_type: m.mime_type
} : m.content_blob ? {
  url: `/api/backend/courses/${courseId}/materials/${m.id}/content`,
  name: m.name,
  size: null,
  mime_type: m.mime_type
} : null;
export const AI_INLINE_LIMIT = 15 * 1024 * 1024;
export const QUIZ_QUESTIONS_PER_CHECKPOINT = 3;
export const QUIZ_PASS_RATIO = 2 / 3;
export const quizJobs = new Map();
export const quizFailedAt = new Map();
export const quizSourceKey = (courseTitle, lessonName) => crypto.createHash("sha256").update(`${courseTitle}\n${lessonName}`).digest("hex").slice(0, 32);
export const quizCheckpoint = req => z.coerce.number().int().min(1).max(3).parse(req.params.checkpoint);
export const quizSystemPrompt = `You write short multiple-choice check-point questions for a video course platform.
You know only the course title and the lecture title. You cannot see the video, so ask about the core ideas of that topic that any good lecture with this title would teach. Never ask about timestamps, the instructor, the examples shown or anything that depends on having watched the video.
Reply with JSON only, no commentary and no code fence.`;
export const quizPrompt = (courseTitle, lesson) => `Course: "${courseTitle}"
Lecture: "${lesson.name}"${lesson.description ? `\nLecture description: "${String(lesson.description).slice(0, 500)}"` : ""}

Write ${QUIZ_QUESTIONS_PER_CHECKPOINT} questions for each of three check-points of this lecture:
- checkpoint 1: foundations and key terms
- checkpoint 2: how the ideas work and how to apply them
- checkpoint 3: a review that checks overall understanding

Every question has exactly 4 options and exactly one correct option. Use the same language as the titles above. Keep each question and option short and clear.
JSON shape:
{"checkpoints":[{"checkpoint":1,"questions":[{"question":"...","options":["...","...","...","..."],"correct_index":0,"explanation":"one short sentence"}]},{"checkpoint":2,"questions":[...]},{"checkpoint":3,"questions":[...]}]}`;
export async function quizMaterial(req) {
  const m = await materialAccess(req);
  if (m.type !== "video") throw new ApiError(404, "Only video lessons have check-point questions");
  if (!m.enrolled) throw new ApiError(403, "Enroll in this course to answer check-point questions");
  const course = await one("SELECT title FROM courses WHERE id=$1", [m.course_id]);
  return {
    m,
    course,
    key: quizSourceKey(course.title, m.name)
  };
}
export const quizPasses = async (userId, materialId) => (await query("SELECT checkpoint FROM material_quiz_passes WHERE user_id=$1 AND material_id=$2 ORDER BY checkpoint", [userId, materialId])).rows.map(row => row.checkpoint);
export const quizReady = async (materialId, key) => (await query("SELECT count(*)::int n FROM material_quiz_questions WHERE material_id=$1 AND source_key=$2", [materialId, key])).rows[0].n >= 3;
/** Makes sure the questions for this lesson exist. Returns false when they cannot be written (Gemini off or busy). */
export async function ensureQuiz(userId, {
  m,
  course,
  key
}) {
  if (await quizReady(m.id, key)) return true;
  const slot = `${m.id}:${key}`;
  if (Date.now() - (quizFailedAt.get(slot) || 0) < 30000) return false;
  let job = quizJobs.get(slot);
  if (!job) {
    job = (async () => {
      try {
        const {
          reply
        } = await askGemini(userId, {
          system: quizSystemPrompt,
          messages: [{
            role: "user",
            content: quizPrompt(course.title, m)
          }]
        });
        const start = reply.indexOf("{"),
          end = reply.lastIndexOf("}");
        if (start < 0 || end < start) throw new Error("no JSON in the reply");
        const parsed = quizSchema.parse(JSON.parse(reply.slice(start, end + 1)));
        const rows = [];
        for (const checkpoint of [1, 2, 3]) {
          const group = parsed.checkpoints.find(item => item.checkpoint === checkpoint);
          if (!group) throw new Error(`checkpoint ${checkpoint} is missing`);
          group.questions.slice(0, QUIZ_QUESTIONS_PER_CHECKPOINT).forEach((item, position) => rows.push([checkpoint, position, item]));
        }
        await tx(async db => {
          await db.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`quiz:${m.id}`]);
          const done = await db.query("SELECT count(*)::int n FROM material_quiz_questions WHERE material_id=$1 AND source_key=$2", [m.id, key]);
          if (done.rows[0].n >= 3) return;
          await db.query("DELETE FROM material_quiz_questions WHERE material_id=$1", [m.id]);
          for (const [checkpoint, position, item] of rows) await db.query(`INSERT INTO material_quiz_questions(material_id,checkpoint,position,question,options,correct_index,explanation,source_key)
               VALUES($1,$2,$3,$4,$5::jsonb,$6,$7,$8)`, [m.id, checkpoint, position, item.question, JSON.stringify(item.options), item.correct_index, item.explanation || null, key]);
        });
        return true;
      } catch (error) {
        console.error("[quiz] could not write check-point questions:", error.message);
        quizFailedAt.set(slot, Date.now());
        return false;
      } finally {
        quizJobs.delete(slot);
      }
    })();
    quizJobs.set(slot, job);
  }
  return job;
}
