import { cvOnly } from "../middleware/permissions.middleware.js";
import { run } from "../middleware/response.middleware.js";
import { cvSummary, CV_MAX_BYTES, cvTemplates } from "../services/cv.service.js";
import { one } from "../services/shared.service.js";
import { query, ApiError } from "@uddeepto/common";
import { z } from "zod";
export const getCv = run(async req => {
  cvOnly(req);
  const result = await query("SELECT file_name,file_size,source,template,updated_at,cv_data FROM user_cvs WHERE user_id=$1", [req.user.sub]);
  if (!result.rowCount) return {
    has_cv: false
  };
  return {
    ...cvSummary(result.rows[0]),
    data: result.rows[0].cv_data
  };
});
export const getCvFile = run(async (req, res) => {
  cvOnly(req);
  const cv = await one("SELECT file_name,mime_type,file_data FROM user_cvs WHERE user_id=$1", [req.user.sub]);
  res.set({
    "Content-Type": cv.mime_type,
    "Content-Disposition": `${req.query.download === "1" ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(cv.file_name)}`,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff"
  }).send(Buffer.from(cv.file_data));
});
export const putCv = run(async req => {
  cvOnly(req);
  const file = req.file;
  if (!file) throw new ApiError(422, "Choose a PDF file");
  if (file.size > CV_MAX_BYTES) throw new ApiError(413, "The CV must be 10 MB or smaller");
  // Judge the content, not the label: every PDF starts with %PDF.
  if (file.buffer.subarray(0, 5).toString("latin1") !== "%PDF-") throw new ApiError(422, "The CV must be a PDF file");
  const body = z.object({
    source: z.enum(["uploaded", "generated"]),
    template: z.string().max(40).optional(),
    data: z.string().max(200000).optional()
  }).parse(req.body);
  let data = null;
  if (body.source === "generated") {
    try {
      data = JSON.parse(body.data || "null");
    } catch {
      throw new ApiError(422, "The CV details could not be read");
    }
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new ApiError(422, "The CV details are missing");
    if (!cvTemplates.includes(body.template)) throw new ApiError(422, "Choose one of the CV templates");
  }
  const name = String(file.originalname || "cv.pdf").replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").slice(0, 150) || "cv.pdf";
  const fileName = /\.pdf$/i.test(name) ? name : `${name}.pdf`;
  const saved = (await query(`INSERT INTO user_cvs(user_id,file_name,file_size,mime_type,file_data,source,template,cv_data,updated_at)
         VALUES($1,$2,$3,'application/pdf',$4,$5,$6,$7::jsonb,now())
         ON CONFLICT (user_id) DO UPDATE SET file_name=EXCLUDED.file_name,file_size=EXCLUDED.file_size,mime_type=EXCLUDED.mime_type,
           file_data=EXCLUDED.file_data,source=EXCLUDED.source,template=EXCLUDED.template,cv_data=EXCLUDED.cv_data,updated_at=now()
         RETURNING file_name,file_size,source,template,updated_at`, [req.user.sub, fileName, file.size, file.buffer, body.source, body.source === "generated" ? body.template : null, data ? JSON.stringify(data) : null])).rows[0];
  return cvSummary(saved);
});
export const deleteCv = run(async req => {
  cvOnly(req);
  await query("DELETE FROM user_cvs WHERE user_id=$1", [req.user.sub]);
  return {
    has_cv: false
  };
});
