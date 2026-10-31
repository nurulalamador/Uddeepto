import { UPLOAD_ROOT } from "../config/storage.config.js";
import { query, ApiError, notify, emitBatch, userRoom, notifyInterested } from "@uddeepto/common";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
export const uuid = v => z.string().uuid().parse(v);
export const text = v => z.string().trim().min(1).max(10000).parse(v);
export const paging = req => [Math.min(100, Math.max(1, parseInt(req.query.limit) || 20)), Math.max(0, parseInt(req.query.offset) || 0)];
export const one = async (sql, args) => {
  const r = await query(sql, args);
  if (!r.rowCount) throw new ApiError(404, "Not found");
  return r.rows[0];
};
export const snippet = (value, max = 90) => {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
};
export async function postRemoved(rows, actor) {
  for (const post of rows) await notify({
    to: post.creator_id,
    actor,
    type: "post_removed",
    title: "A moderator removed your post",
    body: snippet(post.content),
    link: "/showcase",
    entity: ["showcase_post", post.id],
    key: `removed:${post.id}`
  });
}
// Fix the final standings, then tell every participant how they did.
// Fix the final standings, then tell every participant how they did.
export async function finishContest(id, name, actor) {
  await query(`UPDATE contest_participants p SET rank=r.rank FROM(SELECT participant_id,rank() OVER(ORDER BY points DESC,participated_at) AS rank FROM contest_participants WHERE contest_id=$1 AND payment_status='paid') r WHERE p.contest_id=$1 AND p.participant_id=r.participant_id`, [id]);
  const announced = await query(`INSERT INTO notifications(user_id,actor_id,type,category,title,body,link,entity_type,entity_id,dedupe_key)
     SELECT participant_id,$2::uuid,'contest_result','contests',
       CASE WHEN rank=1 THEN 'You won '||$3::text||'!' WHEN rank<=3 THEN 'You finished #'||rank||' in '||$3::text||' (podium)' ELSE 'Results are out for '||$3::text END,
       'Your final rank is #'||rank||' with '||trim(trailing '.' FROM trim(trailing '0' FROM points::text))||' points.',
       '/contests/'||$4::text,'contest',$1::uuid,'result:'||$4::text
     FROM contest_participants WHERE contest_id=$1 AND payment_status='paid' AND rank IS NOT NULL AND participant_id IS DISTINCT FROM $2::uuid
     ON CONFLICT (user_id,dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING
     RETURNING user_id`, [id, actor, name, id]);
  emitBatch(announced.rows.map(row => ({
    rooms: [userRoom(row.user_id)],
    event: "notification:changed",
    payload: {}
  })));
}
export async function notifyRows(sql, id, input) {
  const people = (await query(sql, [id])).rows.map(row => row.id);
  await notify({
    ...input,
    to: people
  });
}
// What should happen when an admin (or a hirer) moves a record to a new status.
export const statusEffects = {
  courses: async (id, status, actor) => {
    if (status !== "published") return;
    const c = await one("SELECT title FROM courses WHERE id=$1", [id]);
    await notifyInterested("course", id, {
      actor,
      type: "course_new",
      title: `New course: ${c.title}`,
      body: "A new course that matches your interests is now available.",
      link: `/courses/${id}`
    });
  },
  contests: async (id, status, actor) => {
    const c = await one("SELECT name FROM contests WHERE id=$1", [id]);
    if (status === "published") await notifyInterested("contest", id, {
      actor,
      type: "contest_new",
      title: `New contest: ${c.name}`,
      body: "A contest that matches your interests is open for entries.",
      link: `/contests/${id}`
    });
    if (status === "completed") await finishContest(id, c.name, actor);
    if (status === "cancelled") await notifyRows("SELECT participant_id id FROM contest_participants WHERE contest_id=$1", id, {
      actor,
      type: "contest_cancelled",
      title: `${c.name} was cancelled`,
      body: "The organizers cancelled this contest.",
      link: `/contests/${id}`,
      entity: ["contest", id],
      key: `cancelled:${id}`
    });
  },
  webinars: async (id, status, actor) => {
    const w = await one("SELECT name FROM webinars WHERE id=$1", [id]);
    if (status === "scheduled") await notifyInterested("webinar", id, {
      actor,
      type: "webinar_new",
      title: `New webinar: ${w.name}`,
      body: "A webinar that matches your interests has been scheduled.",
      link: `/webinars/${id}`
    });
    if (status === "cancelled") await notifyRows("SELECT participant_id id FROM webinar_participants WHERE webinar_id=$1 AND status='registered'", id, {
      actor,
      type: "webinar_cancelled",
      title: `${w.name} was cancelled`,
      body: "The organizers cancelled this webinar.",
      link: `/webinars/${id}`,
      entity: ["webinar", id],
      key: `cancelled:${id}`
    });
  },
  jobs: async (id, status, actor) => {
    const j = await one("SELECT title FROM jobs WHERE id=$1", [id]);
    if (status === "open") await notifyInterested("job", id, {
      actor,
      type: "job_new",
      title: `New job: ${j.title}`,
      body: "A job that matches your interests is open for applications.",
      link: `/jobs/${id}`
    });
    if (["closed", "filled", "cancelled"].includes(status)) await notifyRows("SELECT applicant_id id FROM job_applications WHERE job_id=$1 AND status IN('applied','shortlisted')", id, {
      actor,
      type: "job_closed",
      title: `“${j.title}” ${status === "filled" ? "has been filled" : "is no longer open"}`,
      body: "The hirer stopped accepting applications for this job.",
      link: `/jobs/${id}`,
      entity: ["job", id],
      key: `closed:${id}`
    });
  },
  reported_showcase_posts: async (id, status, actor) => {
    if (!["resolved", "dismissed"].includes(status)) return;
    const report = await one("SELECT reporter_id FROM reported_showcase_posts WHERE id=$1", [id]);
    await notify({
      to: report.reporter_id,
      actor,
      type: "report_update",
      title: "Your report was reviewed",
      body: status === "resolved" ? "Thanks for reporting. We reviewed the post and took action." : "Thanks for reporting. We reviewed the post and found no violation.",
      link: "/showcase",
      entity: ["report", id],
      key: `report:${id}:${status}`
    });
  }
};
export async function afterStatusChange(table, ids, status, actor) {
  for (const id of ids) try {
    await statusEffects[table]?.(id, status, actor);
  } catch (error) {
    console.error("notification failed:", error.message);
  }
}
export const CONTEST_SCORE = `CASE cp.rank WHEN 1 THEN 100 WHEN 2 THEN 70 WHEN 3 THEN 50 WHEN 4 THEN 40 WHEN 5 THEN 35 WHEN 6 THEN 30 WHEN 7 THEN 25 WHEN 8 THEN 20 WHEN 9 THEN 15 WHEN 10 THEN 10 ELSE -10 END`;
export const catTables = {
  courses: ["course_categories", "course_id", "c"],
  contests: ["contest_categories", "contest_id", "c"],
  webinars: ["webinar_categories", "webinar_id", "w"],
  jobs: ["job_categories", "job_id", "j"],
  communities: ["community_categories", "community_id", "c"]
};
export const catNamesSql = (kind, alias) => {
  const [jt, fk] = catTables[kind];
  return `coalesce((SELECT string_agg(ic.name,', ' ORDER BY ic.name) FROM ${jt} cc JOIN interest_categories ic ON ic.id=cc.category_id WHERE cc.${fk}=${alias}.id),(SELECT name FROM interest_categories WHERE id=${alias}.category_id))`;
};
export const catDetailsSql = (kind, alias) => {
  const [jt, fk] = catTables[kind];
  return `coalesce((SELECT json_agg(json_build_object('id',ic.id,'name',ic.name,'icon',ic.icon) ORDER BY ic.name) FROM ${jt} cc JOIN interest_categories ic ON ic.id=cc.category_id WHERE cc.${fk}=${alias}.id),(SELECT json_build_array(json_build_object('id',ic.id,'name',ic.name,'icon',ic.icon)) FROM interest_categories ic WHERE ic.id=${alias}.category_id),'[]'::json)`;
};
export const speakersJsonSql = alias => `coalesce((SELECT json_agg(json_build_object('id',ins.id,'name',ins.name,'designation',ins.designation,'has_image',ins.image_blob IS NOT NULL) ORDER BY ws.sort_order) FROM webinar_speakers ws JOIN instructors ins ON ins.id=ws.instructor_id WHERE ws.webinar_id=${alias}.id),'[]'::json)`;
export const speakerNamesSql = alias => `(SELECT string_agg(ins.name,', ' ORDER BY ws.sort_order) FROM webinar_speakers ws JOIN instructors ins ON ins.id=ws.instructor_id WHERE ws.webinar_id=${alias}.id)`;
export const catIdsSql = (kind, alias) => {
  const [jt, fk] = catTables[kind];
  return `coalesce(nullif((SELECT array_agg(cc.category_id::text ORDER BY ic.name) FROM ${jt} cc JOIN interest_categories ic ON ic.id=cc.category_id WHERE cc.${fk}=${alias}.id),'{}'),CASE WHEN ${alias}.category_id IS NULL THEN '{}'::text[] ELSE ARRAY[${alias}.category_id::text] END)`;
};
export async function saveCategories(db, kind, id, ids) {
  const [jt, fk] = catTables[kind];
  if (ids.length) {
    const found = (await db.query("SELECT id FROM interest_categories WHERE id=ANY($1::uuid[])", [ids])).rowCount;
    if (found !== ids.length) throw new ApiError(422, "One or more categories no longer exist");
  }
  await db.query(`DELETE FROM ${jt} WHERE ${fk}=$1 AND NOT(category_id=ANY($2::uuid[]))`, [id, ids]);
  if (ids.length) await db.query(`INSERT INTO ${jt}(${fk},category_id) SELECT $1,unnest($2::uuid[]) ON CONFLICT DO NOTHING`, [id, ids]);
}
export const instructorImageTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
export const storedPath = url => {
  const full = path.resolve(UPLOAD_ROOT, url.replace(/^\/uploads\//, ""));
  if (!full.startsWith(UPLOAD_ROOT + path.sep)) throw new ApiError(404, "File not found");
  return full;
};
export const removeStored = async urls => {
  for (const url of urls) {
    if (!url || /^https?:/i.test(url)) continue;
    try {
      await fs.promises.unlink(storedPath(url));
    } catch {
      /* already gone */
    }
  }
};
export const decodeName = name => Buffer.from(name || "file", "latin1").toString("utf8").replace(/[\\/\0]/g, "_").slice(0, 255);
export const aiSystemPrompt = `You are Uddeepto AI, a friendly and knowledgeable learning assistant inside Uddeepto, a skill development platform with courses, contests, webinars, communities and jobs.
- Reply in the same language the learner writes in (Bangla, English or a mix).
- Be accurate, clear and encouraging. Explain step by step when it helps; keep simple answers short.
- Format answers in GitHub-flavoured Markdown: use headings sparingly, numbered lists for steps, bullet lists for options, tables when comparing, and **bold** for key terms.
- Put every piece of code in fenced code blocks with a language tag (for example \`\`\`python).
- Write mathematics in LaTeX: inline as $...$ and display equations as $$...$$.
- If you are not sure about something, say so instead of guessing. Do not claim to browse the web or to know the learner's private data.`;
