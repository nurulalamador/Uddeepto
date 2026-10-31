import { admin } from "../middleware/permissions.middleware.js";
import { instructorImageTypes, speakersJsonSql, speakerNamesSql, catTables, catNamesSql, catIdsSql } from "./shared.service.js";
import { query, ApiError } from "@uddeepto/common";
import { z } from "zod";
export const statusColumn = cfg => cfg.statusField?.split(".").at(-1);
export async function statusesOf(cfg, ids) {
  const rows = (await query(`SELECT id::text id,${statusColumn(cfg)}::text status FROM ${cfg.table} WHERE id=ANY($1::uuid[])`, [ids])).rows;
  return new Map(rows.map(row => [row.id, row.status]));
}
export const managed = {
  users: {
    table: "users",
    fields: ["name", "email", "username", "role", "account_status"],
    select: "u.id,u.name,u.email,u.username,u.role::text role,u.account_status::text account_status,u.created_at,u.last_login_at",
    from: "users u",
    search: ["u.name", "u.email", "u.username"],
    statusField: "u.account_status",
    statusValues: ["active", "suspended", "deactivated"],
    sortable: {
      created_at: "u.created_at",
      name: "u.name",
      email: "u.email",
      role: "u.role",
      account_status: "u.account_status"
    },
    defaultSort: "u.created_at"
  },
  interest_categories: {
    table: "interest_categories",
    fields: ["name", "slug", "icon", "description", "is_active", "submission_kind"],
    select: "id,name,slug,icon,description,is_active,submission_kind,created_at",
    search: ["name", "slug", "description"],
    statusField: "is_active",
    statusValues: ["true", "false"],
    sortable: {
      created_at: "created_at",
      name: "name",
      slug: "slug"
    },
    defaultSort: "created_at"
  },
  courses: {
    table: "courses",
    fields: ["title", "slug", "description", "category_id", "instructor_id", "price", "currency", "status"],
    owner: true,
    select: "c.id,c.creator_id,c.instructor_id,c.title,c.slug,c.description,c.category_id,i.name category_name,u.name creator_name,ins.name instructor_name,ins.image_mime_type instructor_image_mime_type,(ins.image_blob IS NOT NULL) instructor_has_image,c.cover_image_mime_type,(c.cover_image IS NOT NULL) has_cover_image,c.price,c.currency,c.status::text status,c.published_at,c.created_at,(SELECT count(*) FROM course_enrollments e WHERE e.course_id=c.id) enrollment_count",
    from: "courses c JOIN users u ON u.id=c.creator_id JOIN interest_categories i ON i.id=c.category_id LEFT JOIN instructors ins ON ins.id=c.instructor_id",
    search: ["c.title", "c.slug", "u.name", "i.name", "ins.name", "c.description"],
    statusField: "c.status",
    statusValues: ["draft", "published", "archived"],
    sortable: {
      created_at: "c.created_at",
      title: "c.title",
      status: "c.status",
      price: "c.price"
    },
    defaultSort: "c.created_at"
  },
  instructors: {
    table: "instructors",
    fields: ["name", "designation", "details", "social_links"],
    select: "id,name,designation,details,social_links,image_mime_type,(image_blob IS NOT NULL) has_image,created_at,(SELECT count(*) FROM courses c WHERE c.instructor_id=instructors.id) course_count",
    from: "instructors",
    search: ["name", "designation", "details"],
    sortable: {
      created_at: "created_at",
      name: "name",
      designation: "designation"
    },
    defaultSort: "created_at"
  },
  contests: {
    table: "contests",
    fields: ["name", "description", "category_id", "type", "entry_fee", "currency", "status", "max_participants", "starting_time", "ending_time"],
    owner: true,
    select: "c.id,c.creator_id,c.name,c.description,c.category_id,i.name category_name,u.name creator_name,c.type::text type,c.entry_fee,c.currency,c.status::text status,c.max_participants,c.starting_time,c.ending_time,c.created_at,(SELECT count(*) FROM contest_participants p WHERE p.contest_id=c.id) participant_count",
    from: "contests c JOIN users u ON u.id=c.creator_id JOIN interest_categories i ON i.id=c.category_id",
    search: ["c.name", "u.name", "i.name", "c.description"],
    statusField: "c.status",
    statusValues: ["draft", "published", "cancelled", "completed"],
    sortable: {
      created_at: "c.created_at",
      name: "c.name",
      status: "c.status",
      starting_time: "c.starting_time"
    },
    defaultSort: "c.created_at"
  },
  webinars: {
    table: "webinars",
    fields: ["name", "description", "category_id", "meeting_url", "capacity", "status", "starting_time", "ending_time"],
    owner: true,
    select: "w.id,w.creator_id,w.name,w.description,w.category_id,i.name category_name,u.name creator_name,w.meeting_url,w.capacity,w.status::text status,w.starting_time,w.ending_time,w.created_at,(SELECT count(*) FROM webinar_participants p WHERE p.webinar_id=w.id AND p.status IN ('registered','attended')) participant_count",
    from: "webinars w JOIN users u ON u.id=w.creator_id JOIN interest_categories i ON i.id=w.category_id",
    search: ["w.name", "u.name", "i.name", "w.description"],
    statusField: "w.status",
    statusValues: ["draft", "scheduled", "live", "completed", "cancelled"],
    sortable: {
      created_at: "w.created_at",
      name: "w.name",
      status: "w.status",
      starting_time: "w.starting_time"
    },
    defaultSort: "w.created_at"
  },
  jobs: {
    table: "jobs",
    fields: ["title", "description", "type", "status", "location", "is_remote", "salary_min", "salary_max", "currency", "salary_period", "application_deadline", "category_id"],
    owner: true,
    select: "j.id,j.creator_id,j.title,j.description,j.type::text type,j.status::text status,j.location,j.is_remote,j.salary_min,j.salary_max,j.currency,j.salary_period,j.application_deadline,j.category_id,i.name category_name,u.name creator_name,j.created_at,(SELECT count(*) FROM job_applications a WHERE a.job_id=j.id) application_count",
    from: "jobs j JOIN users u ON u.id=j.creator_id LEFT JOIN interest_categories i ON i.id=j.category_id",
    search: ["j.title", "u.name", "j.location", "i.name", "j.description"],
    statusField: "j.status",
    statusValues: ["draft", "open", "closed", "filled", "cancelled"],
    sortable: {
      created_at: "j.created_at",
      title: "j.title",
      status: "j.status",
      application_deadline: "j.application_deadline"
    },
    defaultSort: "j.created_at"
  },
  communities: {
    table: "communities",
    fields: ["name", "slug", "description", "category_id", "requires_approval", "is_private"],
    owner: true,
    select: "c.id,c.creator_id,c.name,c.slug,c.description,c.category_id,i.name category_name,u.name creator_name,c.requires_approval,c.is_private,c.created_at,(SELECT count(*) FROM community_members m WHERE m.community_id=c.id AND m.status='approved') member_count",
    from: "communities c JOIN users u ON u.id=c.creator_id JOIN interest_categories i ON i.id=c.category_id",
    search: ["c.name", "c.slug", "u.name", "i.name", "c.description"],
    sortable: {
      created_at: "c.created_at",
      name: "c.name"
    },
    defaultSort: "c.created_at"
  },
  showcase_posts: {
    table: "showcase_posts",
    fields: ["content", "visibility"],
    select: "p.id,p.creator_id,p.content,p.visibility::text visibility,p.created_at,p.deleted_at,u.name creator_name,i.name category_name",
    from: "showcase_posts p JOIN users u ON u.id=p.creator_id JOIN interest_categories i ON i.id=p.category_id",
    where: "p.deleted_at IS NULL",
    search: ["p.content", "u.name", "i.name"],
    statusField: "p.visibility",
    statusValues: ["public", "private"],
    sortable: {
      created_at: "p.created_at",
      visibility: "p.visibility"
    },
    defaultSort: "p.created_at"
  },
  reported_showcase_posts: {
    table: "reported_showcase_posts",
    fields: ["status", "resolution_note"],
    select: "r.id,r.post_id,r.reporter_id,r.reason,r.details,r.status::text status,r.resolution_note,r.created_at,p.deleted_at,p.content post_content,u.name reporter_name,creator.name post_creator_name",
    from: "reported_showcase_posts r JOIN showcase_posts p ON p.id=r.post_id JOIN users u ON u.id=r.reporter_id JOIN users creator ON creator.id=p.creator_id",
    search: ["r.reason", "r.details", "p.content", "u.name", "creator.name"],
    statusField: "r.status",
    statusValues: ["pending", "reviewing", "resolved", "dismissed"],
    sortable: {
      created_at: "r.created_at",
      status: "r.status",
      reason: "r.reason"
    },
    defaultSort: "r.created_at"
  }
};
export function speakerIds(body, required) {
  let raw = body.speaker_ids;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      throw new ApiError(422, "Invalid speakers");
    }
  }
  if (raw === undefined && !required) return undefined;
  const ids = [...new Set(z.array(z.string().uuid()).max(30).parse(raw ?? []))];
  if (!ids.length) throw new ApiError(422, "Add at least one speaker");
  return ids;
}
export async function saveSpeakers(db, webinarId, ids) {
  const found = (await db.query("SELECT id FROM instructors WHERE id=ANY($1::uuid[])", [ids])).rowCount;
  if (found !== ids.length) throw new ApiError(422, "One or more speakers no longer exist");
  await db.query("DELETE FROM webinar_speakers WHERE webinar_id=$1 AND NOT(instructor_id=ANY($2::uuid[]))", [webinarId, ids]);
  await db.query("INSERT INTO webinar_speakers(webinar_id,instructor_id,sort_order) SELECT $1,x.id,x.ord-1 FROM unnest($2::uuid[]) WITH ORDINALITY AS x(id,ord) ON CONFLICT(webinar_id,instructor_id) DO UPDATE SET sort_order=EXCLUDED.sort_order", [webinarId, ids]);
}
export function categoryIds(body, required) {
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
  const ids = [...new Set(z.array(z.string().uuid()).max(20).parse(raw ?? []))];
  if (required && !ids.length) throw new ApiError(422, "Select at least one category");
  return ids;
}
export const managedConfig = req => {
  admin(req);
  const cfg = managed[req.params.table];
  if (!cfg) throw new ApiError(404, "Unknown collection");
  return cfg;
};
export function checkInstructorImage(file) {
  if (!file) throw new ApiError(422, "Choose an instructor image");
  if (!instructorImageTypes.has(file.mimetype)) throw new ApiError(422, "Use a JPEG, PNG, WebP, or AVIF image");
}
export function instructorLinks(body) {
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
    if (!["http:", "https:"].includes(parsed.protocol)) throw new ApiError(422, `Use an https:// or http:// URL for ${key}`);
    links[key] = parsed.toString();
  }
  return links;
}
export const courseFileUrls = async ids => (await query("SELECT file_url FROM course_materials WHERE course_id=ANY($1::uuid[]) AND file_url IS NOT NULL", [ids])).rows.map(row => row.file_url);
export const contestFileUrls = async ids => (await query("SELECT file_url FROM contest_submissions WHERE contest_id=ANY($1::uuid[]) AND file_url IS NOT NULL", [ids])).rows.map(row => row.file_url);
managed.webinars.fields.push("recording_url");
managed.jobs.fields.push("latitude", "longitude");
managed.jobs.select = managed.jobs.select.replace("j.application_deadline,", "j.application_deadline,j.latitude::float8 latitude,j.longitude::float8 longitude,");
managed.webinars.select = managed.webinars.select.replace("w.meeting_url,", "w.meeting_url,w.recording_url,") + `,${speakersJsonSql("w")} speakers,${speakerNamesSql("w")} speaker_names`;
managed.webinars.search.push(`(${speakerNamesSql("w")})`);
for (const [kind, [,, alias]] of Object.entries(catTables)) {
  const cfg = managed[kind];
  cfg.categories = true;
  cfg.select = cfg.select.replace("i.name category_name", `${catNamesSql(kind, alias)} category_name,${catIdsSql(kind, alias)} category_ids`);
  cfg.search = cfg.search.map(field => field === "i.name" ? `(${catNamesSql(kind, alias)})` : field);
}
