import { learner } from "../middleware/permissions.middleware.js";
import { run } from "../middleware/response.middleware.js";
import { one, uuid, catDetailsSql } from "../services/shared.service.js";
import { ApiError, query } from "@uddeepto/common";
export const getInstructorsByIdImage = run(async (req, res) => {
  const instructor = await one("SELECT image_blob,image_mime_type FROM instructors WHERE id=$1", [uuid(req.params.id)]);
  if (!instructor.image_blob) throw new ApiError(404, "Instructor image not found");
  res.set("Cache-Control", "private, max-age=300").type(instructor.image_mime_type).send(instructor.image_blob);
});
export const getInstructorsById = run(async req => {
  learner(req);
  const id = uuid(req.params.id);
  const instructor = await one("SELECT id,name,designation,details,social_links,(image_blob IS NOT NULL) has_image FROM instructors WHERE id=$1", [id]);
  const courses = (await query(`SELECT c.id,c.title,c.description,c.price,c.currency,(c.cover_image IS NOT NULL) has_cover_image,${catDetailsSql("courses", "c")} category_details FROM courses c WHERE c.instructor_id=$1 AND c.status='published' ORDER BY c.published_at DESC NULLS LAST,c.created_at DESC`, [id])).rows;
  return {
    ...instructor,
    courses
  };
});
