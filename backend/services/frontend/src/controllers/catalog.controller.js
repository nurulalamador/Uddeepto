import { learner } from "../middleware/permissions.middleware.js";
import { run } from "../middleware/response.middleware.js";
import { catalogs } from "../services/catalog.service.js";
import { paging, uuid, speakersJsonSql, catNamesSql, catIdsSql, catDetailsSql, catTables, one } from "../services/shared.service.js";
import { ApiError, query } from "@uddeepto/common";
export const getCatalogByKind = run(async req => {
  learner(req);
  const {
    kind
  } = req.params;
  const cfg = catalogs[kind];
  if (!cfg) throw new ApiError(404, "Unknown catalog");
  const [limit, offset] = paging(req);
  const args = [req.user.sub, `%${String(req.query.q || "").slice(0, 200)}%`, req.query.category ? uuid(req.query.category) : null, limit, offset];
  let filter = `t.${cfg.visible}`;
  if (kind === "communities") filter = req.query.tab === "explore" ? "NOT EXISTS(SELECT 1 FROM community_members WHERE community_id=t.id AND member_id=$1 AND status='approved') AND t.creator_id<>$1" : "true";
  if (req.query.tab === "recommended" && kind === "courses") filter += ` AND NOT EXISTS(SELECT 1 FROM course_enrollments WHERE course_id=t.id AND user_id=$1 AND status IN('active','completed')) AND EXISTS(SELECT 1 FROM user_interests ui WHERE ui.user_id=$1 AND(ui.interest_id=t.category_id OR EXISTS(SELECT 1 FROM course_categories cc WHERE cc.course_id=t.id AND cc.category_id=ui.interest_id)))`;
  if (req.query.tab === "enrolled" && kind === "courses") filter += ` AND EXISTS(SELECT 1 FROM course_enrollments WHERE course_id=t.id AND user_id=$1 AND status IN('active','completed'))`;
  if (["webinars", "contests"].includes(kind)) {
    const tab = req.query.tab;
    if (tab === "ongoing") filter += ` AND starting_time<=now() AND ending_time>=now() AND t.status NOT IN('completed','cancelled')`;
    if (tab === "upcoming") filter += ` AND starting_time>now() AND t.status NOT IN('completed','cancelled')`;
    if (tab === "previous") filter += ` AND(ending_time<now() OR t.status IN('completed','cancelled'))`;
  }
  const extras = kind === "courses" ? `,EXISTS(SELECT 1 FROM course_enrollments WHERE course_id=t.id AND user_id=$1 AND status IN('active','completed')) enrolled` : kind === "communities" ? `,(SELECT count(*) FROM community_members WHERE community_id=t.id AND status='approved') member_count,(SELECT status::text FROM community_members WHERE community_id=t.id AND member_id=$1) membership,($1::uuid IS NOT NULL) authenticated` : kind === "webinars" ? `,(SELECT count(*) FROM webinar_participants WHERE webinar_id=t.id AND status IN('registered','attended')) participant_count,EXISTS(SELECT 1 FROM webinar_participants WHERE webinar_id=t.id AND participant_id=$1 AND status IN('registered','attended')) joined,${speakersJsonSql("t")} speakers` : kind === "contests" ? `,(SELECT count(*) FROM contest_participants WHERE contest_id=t.id) participant_count,EXISTS(SELECT 1 FROM contest_participants WHERE contest_id=t.id AND participant_id=$1 AND payment_status='paid') joined` : ",($1::uuid IS NOT NULL) authenticated";
  const courseSorts = {
    price: "t.price",
    materials: "(SELECT count(*) FROM course_materials WHERE course_id=t.id)",
    learners: "(SELECT count(*) FROM course_enrollments WHERE course_id=t.id AND status IN('active','completed'))"
  };
  const sortColumn = kind === "courses" ? courseSorts[String(req.query.sort || "")] : undefined;
  const contestOrder = {
    ongoing: "t.ending_time ASC",
    upcoming: "t.starting_time ASC",
    previous: "t.ending_time DESC"
  }[String(req.query.tab || "")];
  const orderBy = ["contests", "webinars"].includes(kind) && contestOrder ? `${contestOrder}, t.created_at DESC` : sortColumn ? `${sortColumn} ${req.query.direction === "asc" ? "ASC" : "DESC"}, t.created_at DESC` : "t.created_at DESC";
  const progressFields = kind === "courses" ? ",(SELECT count(*) FROM course_materials WHERE course_id=t.id) progress_total,(SELECT count(*) FROM completed_course_materials WHERE course_id=t.id AND user_id=$1) progress_done" : "";
  const instructorFields = kind === "courses" ? ",t.instructor_id,ins.name instructor_name,ins.designation instructor_designation,ins.details instructor_details,ins.image_mime_type instructor_image_mime_type,(ins.image_blob IS NOT NULL) instructor_has_image" : "";
  const courseCoverFields = kind === "courses" ? ",t.cover_image_mime_type,(t.cover_image IS NOT NULL) has_cover_image" : "";
  const instructorJoin = kind === "courses" ? " LEFT JOIN instructors ins ON ins.id=t.instructor_id" : "";
  return (await query(`SELECT t.id,t.${cfg.title},t.description,${kind === "communities" ? "'active' AS status" : "t.status"},${cfg.columns.split(",").map(c => "t." + c).join(",")},u.name creator_name,${catNamesSql(kind, "t")} category_name,${catIdsSql(kind, "t")} category_ids,${catDetailsSql(kind, "t")} category_details ${progressFields} ${instructorFields} ${courseCoverFields} ${extras} FROM ${kind} t JOIN users u ON u.id=t.creator_id JOIN interest_categories i ON i.id=t.category_id${instructorJoin} WHERE ${filter} AND(t.${cfg.title} ILIKE $2 OR t.description ILIKE $2) AND($3::uuid IS NULL OR t.category_id=$3 OR EXISTS(SELECT 1 FROM ${catTables[kind][0]} cc WHERE cc.${catTables[kind][1]}=t.id AND cc.category_id=$3)) ORDER BY ${orderBy} LIMIT $4 OFFSET $5`, args)).rows;
});
export const getDetailByKindById = run(async req => {
  learner(req);
  const {
    kind
  } = req.params;
  uuid(req.params.id);
  if (!["courses", "contests", "webinars"].includes(kind)) throw new ApiError(404, "Unknown kind");
  const cfg = catalogs[kind];
  const t = await one(`SELECT id,creator_id FROM ${kind} WHERE id=$1 AND(${cfg.visible} OR creator_id=$2 OR $3='admin')`, [req.params.id, req.user.sub, req.user.role]);
  if (kind === "courses") {
    const enrollment = await query(`SELECT status FROM course_enrollments WHERE course_id=$1 AND user_id=$2 AND status IN('active','completed')`, [t.id, req.user.sub]);
    return {
      enrolled: !!enrollment.rowCount,
      materials: (await query(`SELECT m.id,m.name,m.is_preview,m.content_blob IS NOT NULL has_blob,EXISTS(SELECT 1 FROM completed_course_materials WHERE material_id=m.id AND user_id=$2) completed FROM course_materials m WHERE course_id=$1 ORDER BY sort_order`, [t.id, req.user.sub])).rows
    };
  }
  const participants = await query(`SELECT 1 FROM ${kind === "contests" ? "contest" : "webinar"}_participants WHERE ${kind === "contests" ? "contest" : "webinar"}_id=$1 AND participant_id=$2 ${kind === "webinars" ? "AND status IN('registered','attended')" : "AND payment_status='paid'"}`, [t.id, req.user.sub]);
  if (kind === "webinars") return {
    joined: !!participants.rowCount,
    meeting_url: participants.rowCount ? (await one("SELECT meeting_url FROM webinars WHERE id=$1", [t.id])).meeting_url : null
  };
  const started = await query("SELECT 1 FROM contests WHERE id=$1 AND starting_time<=now()", [t.id]);
  return {
    joined: !!participants.rowCount,
    problems: started.rowCount ? (await query("SELECT id,name,description,points,sample_input,sample_output FROM contest_problems WHERE contest_id=$1 ORDER BY sort_order", [t.id])).rows : [],
    leaderboard: (await query("SELECT u.id,u.name,p.points FROM contest_participants p JOIN users u ON u.id=p.participant_id WHERE contest_id=$1 ORDER BY points DESC,participated_at LIMIT 50", [t.id])).rows
  };
});
