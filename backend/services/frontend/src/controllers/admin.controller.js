import { admin } from "../middleware/permissions.middleware.js";
import { run } from "../middleware/response.middleware.js";
import { checkInstructorImage, instructorLinks, managedConfig, statusesOf, courseFileUrls, contestFileUrls, categoryIds, speakerIds, saveSpeakers, statusColumn } from "../services/admin.service.js";
import { uuid, one, paging, statusEffects, afterStatusChange, postRemoved, removeStored, saveCategories } from "../services/shared.service.js";
import { instructorFields } from "../validators/admin.validators.js";
import { optimizeUpload, query, ApiError, tx } from "@uddeepto/common";
import bcrypt from "bcryptjs";
import { z } from "zod";
export const createAdminInstructors = run(async req => {
  admin(req);
  checkInstructorImage(req.file);
  await optimizeUpload(req.file, "instructor");
  const instructor = z.object(instructorFields).strict().parse(req.body);
  const socialLinks = instructorLinks(instructor);
  return (await query("INSERT INTO instructors(name,designation,image_blob,image_mime_type,details,social_links) VALUES($1,$2,$3,$4,$5,$6) RETURNING id,name,designation,details,social_links,image_mime_type,(image_blob IS NOT NULL) has_image,created_at", [instructor.name, instructor.designation, req.file.buffer, req.file.mimetype, instructor.details, JSON.stringify(socialLinks)])).rows[0];
});
export const updateAdminInstructorsById = run(async req => {
  admin(req);
  const id = uuid(req.params.id);
  const body = z.object({
    ...instructorFields,
    name: instructorFields.name.optional(),
    designation: instructorFields.designation.optional(),
    details: instructorFields.details.optional(),
    linkedin_url: instructorFields.linkedin_url.optional(),
    github_url: instructorFields.github_url.optional(),
    website_url: instructorFields.website_url.optional()
  }).strict().parse(req.body);
  if (req.file) {
    checkInstructorImage(req.file);
    await optimizeUpload(req.file, "instructor");
  }
  const fields = [],
    values = [];
  const add = (field, value) => {
    fields.push(`${field}=$${values.length + 1}`);
    values.push(value);
  };
  if (body.name !== undefined) add("name", body.name);
  if (body.designation !== undefined) add("designation", body.designation);
  if (body.details !== undefined) add("details", body.details);
  if (["linkedin_url", "github_url", "website_url"].some(key => body[key] !== undefined)) add("social_links", JSON.stringify(instructorLinks({
    ...body,
    linkedin_url: body.linkedin_url || "",
    github_url: body.github_url || "",
    website_url: body.website_url || ""
  })));
  if (req.file) {
    add("image_blob", req.file.buffer);
    add("image_mime_type", req.file.mimetype);
  } else if (body.remove_image === "true") {
    add("image_blob", null);
    add("image_mime_type", null);
  }
  if (!fields.length) throw new ApiError(422, "Update a profile field or choose a new image");
  values.push(id);
  const result = await query(`UPDATE instructors SET ${fields.join(",")} WHERE id=$${values.length} RETURNING id,name,designation,details,social_links,image_mime_type,(image_blob IS NOT NULL) has_image,created_at`, values);
  if (!result.rowCount) throw new ApiError(404, "Instructor not found");
  return result.rows[0];
});
export const deleteAdminInstructorsById = run(async req => {
  admin(req);
  const id = uuid(req.params.id);
  const courses = Number((await query("SELECT count(*) FROM courses WHERE instructor_id=$1", [id])).rows[0].count);
  const result = await query("DELETE FROM instructors WHERE id=$1 RETURNING id", [id]);
  if (!result.rowCount) throw new ApiError(404, "Instructor not found");
  return {
    deleted: true,
    unassigned_courses: courses
  };
});
export const getAdminSettings = run(async req => {
  admin(req);
  const rows = (await query("SELECT key,value FROM platform_settings WHERE key IN ('registration_open','content_review_required')")).rows;
  const values = {
    registration_open: true,
    content_review_required: true
  };
  for (const row of rows) values[row.key] = row.value === true;
  return values;
});
export const updateAdminSettings = run(async req => {
  admin(req);
  const settings = z.object({
    registration_open: z.boolean().optional(),
    content_review_required: z.boolean().optional()
  }).strict().refine(value => Object.keys(value).length > 0).parse(req.body);
  const descriptions = {
    registration_open: "Allow public self-registration.",
    content_review_required: "Require admin approval before creators publish courses, contests, webinars or jobs."
  };
  for (const [key, value] of Object.entries(settings)) await query("INSERT INTO platform_settings(key,value,description,updated_by) VALUES($1,$2::jsonb,$3,$4) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value,description=EXCLUDED.description,updated_by=EXCLUDED.updated_by,updated_at=now()", [key, JSON.stringify(value), descriptions[key], req.user.sub]);
  return settings;
});
export const getAdminOverview = run(async req => {
  admin(req);
  const stats = await one(`SELECT (SELECT count(*) FROM users) total_users,(SELECT count(*) FROM users WHERE role='learner') learners,(SELECT count(*) FROM users WHERE role='hirer') hirers,(SELECT count(*) FROM users WHERE account_status='active') active_users,(SELECT count(*) FROM courses) courses,(SELECT count(*) FROM courses WHERE status='published') published_courses,(SELECT count(*) FROM courses WHERE status='draft') draft_courses,(SELECT count(*) FROM contests) contests,(SELECT count(*) FROM contests WHERE status='published') published_contests,(SELECT count(*) FROM webinars) webinars,(SELECT count(*) FROM webinars WHERE status IN('scheduled','live')) active_webinars,(SELECT count(*) FROM jobs) jobs,(SELECT count(*) FROM jobs WHERE status='open') open_jobs,(SELECT count(*) FROM reported_showcase_posts WHERE status IN('pending','reviewing')) open_reports`);
  const activity = (await query(`SELECT * FROM(SELECT id::text id,'user'::text kind,'New account registered'::text title,name::text detail,created_at occurred_at FROM users UNION ALL SELECT id::text id,'course'::text kind,'Course created'::text title,title::text detail,created_at occurred_at FROM courses UNION ALL SELECT id::text id,'contest'::text kind,'Contest created'::text title,name::text detail,created_at occurred_at FROM contests UNION ALL SELECT id::text id,'webinar'::text kind,'Webinar created'::text title,name::text detail,created_at occurred_at FROM webinars UNION ALL SELECT id::text id,'job'::text kind,'Job posted'::text title,title::text detail,created_at occurred_at FROM jobs UNION ALL SELECT id::text id,'report'::text kind,'Post reported'::text title,reason::text detail,created_at occurred_at FROM reported_showcase_posts) activity ORDER BY occurred_at DESC LIMIT 12`)).rows;
  return {
    stats,
    activity
  };
});
export const getAdminByTable = run(async req => {
  const cfg = managedConfig(req);
  const [limit, offset] = paging(req);
  const values = [];
  const where = [cfg.where || "TRUE"];
  const add = value => {
    values.push(value);
    return `$${values.length}`;
  };
  const search = String(req.query.q || "").trim().slice(0, 200);
  if (search && cfg.search?.length) {
    const key = add(`%${search}%`);
    where.push(`(${cfg.search.map(field => `${field}::text ILIKE ${key}`).join(" OR ")})`);
  }
  if (req.query.status) {
    if (!cfg.statusField || !cfg.statusValues?.includes(String(req.query.status))) throw new ApiError(422, "Invalid status filter");
    where.push(`${cfg.statusField}::text=${add(String(req.query.status))}`);
  }
  const created = cfg.sortable?.created_at || "created_at";
  for (const field of ["from", "to"]) if (req.query[field]) {
    const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).parse(String(req.query[field]));
    where.push(field === "from" ? `${created}>=${add(day)}::date` : `${created}<(${add(day)}::date + interval '1 day')`);
  }
  const sort = cfg.sortable?.[String(req.query.sort || "")] || cfg.defaultSort || created;
  const direction = req.query.direction === "asc" ? "ASC" : "DESC";
  values.push(limit, offset);
  return (await query(`SELECT ${cfg.select || ["id", ...cfg.fields].join(",")} FROM ${cfg.from || cfg.table} WHERE ${where.join(" AND ")} ORDER BY ${sort} ${direction} NULLS LAST LIMIT $${values.length - 1} OFFSET $${values.length}`, values)).rows;
});
export const createAdminUsers = run(async req => {
  admin(req);
  const user = z.object({
    name: z.string().trim().min(2).max(150),
    email: z.string().trim().email().max(254),
    username: z.string().regex(/^[A-Za-z0-9_.-]{3,40}$/),
    password: z.string().min(8).max(128),
    role: z.enum(["learner", "hirer", "admin"])
  }).parse(req.body);
  const hash = await bcrypt.hash(user.password, 12);
  try {
    return (await query("INSERT INTO users(name,email,username,password_hash,role) VALUES($1,$2,$3,$4,$5) RETURNING id,name,email,username,role::text role,account_status::text account_status,created_at", [user.name, user.email, user.username, hash, user.role])).rows[0];
  } catch (error) {
    if (error.code === "23505") throw new ApiError(409, "That email or username is already in use");
    throw error;
  }
});
export const createAdminByTableBulk = run(async req => {
  const cfg = managedConfig(req);
  const body = z.object({
    ids: z.array(z.string().uuid()).min(1).max(100),
    action: z.enum(["status", "delete"]),
    status: z.string().optional()
  }).parse(req.body);
  if (body.action === "status") {
    if (!cfg.statusField || !cfg.statusValues?.includes(body.status)) throw new ApiError(422, "This status is not available for the selected records");
    if (cfg.table === "users" && body.ids.includes(req.user.sub) && body.status !== "active") throw new ApiError(409, "You cannot disable your own admin account");
    const column = cfg.statusField.split(".").at(-1);
    const sets = [`${column}=$1`];
    const values = [cfg.table === "interest_categories" ? body.status === "true" : body.status, body.ids];
    if (cfg.table === "reported_showcase_posts") {
      sets.push("reviewed_by=$3", "reviewed_at=now()");
      values.push(req.user.sub);
    }
    const before = statusEffects[cfg.table] ? await statusesOf(cfg, body.ids) : new Map();
    const result = await query(`UPDATE ${cfg.table} SET ${sets.join(",")} WHERE id=ANY($2::uuid[])`, values);
    if (statusEffects[cfg.table]) await afterStatusChange(cfg.table, body.ids.filter(id => before.has(id) && before.get(id) !== body.status), body.status, req.user.sub);
    return {
      updated: result.rowCount
    };
  }
  if (cfg.table === "users") throw new ApiError(409, "Suspend accounts instead of deleting user history");
  if (cfg.table === "showcase_posts") {
    const result = await query("UPDATE showcase_posts SET deleted_at=now() WHERE id=ANY($1::uuid[]) AND deleted_at IS NULL RETURNING id,creator_id,content", [body.ids]);
    await postRemoved(result.rows, req.user.sub);
    return {
      updated: result.rowCount
    };
  }
  const files = cfg.table === "courses" ? await courseFileUrls(body.ids) : cfg.table === "contests" ? await contestFileUrls(body.ids) : [];
  const result = await query(`DELETE FROM ${cfg.table} WHERE id=ANY($1::uuid[])`, [body.ids]);
  await removeStored(files);
  return {
    updated: result.rowCount
  };
});
export const createAdminByTable = run(async req => {
  const cfg = managedConfig(req);
  if (["users", "showcase_posts", "reported_showcase_posts", "instructors"].includes(cfg.table)) throw new ApiError(403, "Creation is not supported for this collection");
  const body = Object.fromEntries(cfg.fields.filter(key => req.body[key] !== undefined).map(key => [key, req.body[key]]));
  if (cfg.owner) body.creator_id = req.user.sub;
  if (cfg.table === "courses") {
    if (!body.instructor_id) throw new ApiError(422, "Assign an instructor before creating a course");
    body.instructor_id = uuid(body.instructor_id);
    if (!body.title || !body.slug || !body.description) throw new ApiError(422, "Course title, slug, and description are required");
    if (req.file) {
      checkInstructorImage(req.file);
      await optimizeUpload(req.file, "course");
      body.cover_image = req.file.buffer;
      body.cover_image_mime_type = req.file.mimetype;
    }
    if (body.status === "published") body.published_at = new Date();
  }
  if (cfg.statusField && body[cfg.statusField.split(".").at(-1)] !== undefined && !cfg.statusValues?.includes(String(body[cfg.statusField.split(".").at(-1)]))) throw new ApiError(422, "Invalid status");
  let ids;
  if (cfg.categories) {
    ids = categoryIds(req.body, cfg.table !== "jobs");
    if (ids?.length) body.category_id = ids[0];else delete body.category_id;
  }
  const speakers = cfg.table === "webinars" ? speakerIds(req.body, true) : undefined;
  const keys = Object.keys(body);
  if (!keys.length) throw new ApiError(422, "No fields");
  const created = await tx(async db => {
    const row = (await db.query(`INSERT INTO ${cfg.table}(${keys.join(",")}) VALUES(${keys.map((_, index) => `$${index + 1}`).join(",")}) RETURNING id`, Object.values(body))).rows[0];
    if (ids) await saveCategories(db, cfg.table, row.id, ids);
    if (speakers) await saveSpeakers(db, row.id, speakers);
    return row;
  });
  const createdStatus = body[statusColumn(cfg)];
  if (createdStatus !== undefined && statusEffects[cfg.table]) await afterStatusChange(cfg.table, [created.id], String(createdStatus), req.user.sub);
  return created;
});
export const updateAdminByTableById = run(async req => {
  const cfg = managedConfig(req);
  uuid(req.params.id);
  const body = Object.fromEntries(cfg.fields.filter(key => req.body[key] !== undefined).map(key => [key, req.body[key]]));
  if (cfg.table === "courses") {
    if (body.instructor_id !== undefined) body.instructor_id = uuid(body.instructor_id);
    const removeCover = req.body.remove_cover_image;
    if (removeCover !== undefined && !["true", "false"].includes(removeCover)) throw new ApiError(422, "Invalid remove cover flag");
    if (req.file) {
      checkInstructorImage(req.file);
      await optimizeUpload(req.file, "course");
      body.cover_image = req.file.buffer;
      body.cover_image_mime_type = req.file.mimetype;
    } else if (removeCover === "true") {
      body.cover_image = null;
      body.cover_image_mime_type = null;
    }
  }
  if (cfg.table === "users") {
    if (body.role !== undefined && !z.enum(["learner", "hirer", "moderator", "admin"]).safeParse(body.role).success) throw new ApiError(422, "Invalid user role");
    if (body.name !== undefined) body.name = z.string().trim().min(2).max(150).parse(body.name);
    if (body.email !== undefined) body.email = z.string().trim().email().max(254).parse(body.email);
    if (body.username !== undefined) body.username = z.string().regex(/^[A-Za-z0-9_.-]{3,40}$/).parse(body.username);
    if (body.account_status !== undefined) z.enum(["active", "suspended", "deactivated"]).parse(body.account_status);
    if (req.params.id === req.user.sub && (body.role && body.role !== "admin" || body.account_status && body.account_status !== "active")) throw new ApiError(409, "You cannot disable or demote your own admin account");
  }
  if (cfg.statusField && body[cfg.statusField.split(".").at(-1)] !== undefined && !cfg.statusValues?.includes(String(body[cfg.statusField.split(".").at(-1)]))) throw new ApiError(422, "Invalid status");
  if (cfg.table === "courses" && body.status === "published" && body.published_at === undefined) body.published_at = new Date();
  if (cfg.table === "reported_showcase_posts") {
    body.reviewed_by = req.user.sub;
    body.reviewed_at = new Date();
  }
  let ids;
  if (cfg.categories) {
    ids = categoryIds(req.body, false);
    if (ids !== undefined) {
      if (!ids.length && cfg.table !== "jobs") throw new ApiError(422, "Select at least one category");
      body.category_id = ids[0] ?? null;
    }
  }
  const speakers = cfg.table === "webinars" ? speakerIds(req.body, false) : undefined;
  const keys = Object.keys(body);
  if (!keys.length && !speakers) throw new ApiError(422, "No fields");
  const values = [...Object.values(body), req.params.id];
  const newStatus = statusEffects[cfg.table] ? body[statusColumn(cfg)] : undefined;
  const previousStatus = newStatus !== undefined ? (await statusesOf(cfg, [req.params.id])).get(req.params.id) : undefined;
  await tx(async db => {
    const result = keys.length ? await db.query(`UPDATE ${cfg.table} SET ${keys.map((key, index) => `${key}=$${index + 1}`).join(",")} WHERE id=$${keys.length + 1}`, values) : await db.query("SELECT 1 FROM webinars WHERE id=$1", [req.params.id]);
    if (!result.rowCount) throw new ApiError(404, "Record not found");
    if (ids !== undefined) await saveCategories(db, cfg.table, req.params.id, ids);
    if (speakers) await saveSpeakers(db, req.params.id, speakers);
  });
  if (newStatus !== undefined && previousStatus !== String(newStatus)) await afterStatusChange(cfg.table, [req.params.id], String(newStatus), req.user.sub);
});
export const deleteAdminByTableById = run(async req => {
  const cfg = managedConfig(req);
  const id = uuid(req.params.id);
  if (cfg.table === "users") throw new ApiError(409, "Suspend accounts instead of deleting user history");
  if (cfg.table === "showcase_posts") {
    const result = await query("UPDATE showcase_posts SET deleted_at=now() WHERE id=$1 AND deleted_at IS NULL RETURNING id,creator_id,content", [id]);
    if (!result.rowCount) throw new ApiError(404, "Record not found");
    await postRemoved(result.rows, req.user.sub);
    return;
  }
  const files = cfg.table === "courses" ? await courseFileUrls([id]) : cfg.table === "contests" ? await contestFileUrls([id]) : [];
  const result = await query(`DELETE FROM ${cfg.table} WHERE id=$1`, [id]);
  if (!result.rowCount) throw new ApiError(404, "Record not found");
  await removeStored(files);
});
