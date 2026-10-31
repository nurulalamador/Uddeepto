// Explicit, opt-in local fixture server. This does not launch or test any device.
import { spawn } from "node:child_process";
import { Buffer } from "node:buffer";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startDatabase } from "../../../e2e/lib/database.mjs";
import { seed } from "../../../e2e/lib/seed.mjs";
import { startFixtureProxy } from "./fixture-proxy.mjs";

const workspace = fileURLToPath(new URL("../", import.meta.url));
const root = fileURLToPath(new URL("../../../", import.meta.url));
const local = path.join(workspace, "local");
const database = await startDatabase();
let backend;
let proxy;
let stopping = false;
async function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  backend?.kill();
  await proxy?.close();
  await database.stop().catch(() => {});
  process.exitCode = code;
}
process.on("SIGINT", () => { void stop(); });
process.on("SIGTERM", () => { void stop(); });

try {
  await mkdir(path.join(local, "uploads"), { recursive: true });
  const ids = await seed(database.db);
  const query = (sql, params = []) => database.db.query(sql, params);
  const one = async (sql, params = []) => (await query(sql, params)).rows[0];
  const hash = (await one("SELECT password_hash FROM users WHERE id=$1", [ids.admin])).password_hash;
  const env = {
    RUN_ID: Date.now().toString(36), PASSWORD: "Passw0rd!123", API_URL: "http://127.0.0.1:4400/api/v1", CONTROL_TOKEN: randomUUID(),
    LEARNER_USERNAME: "learner1", LEARNER_EMAIL: "learner1@e2e.test",
    LEARNER_ID: ids.learner, HIRER_USERNAME: "hirer1", HIRER_ID: ids.hirer,
    HIRER_NAME: "Hana Hirer", RECEIVER_USERNAME: "learner2", RECEIVER_NAME: "Liam Learner", RECEIVER_ID: ids.learner2,
    ADMIN_USERNAME: "admin1", BANNED_USERNAME: "banned1", NEWBIE_USERNAME: "newbie1",
    CATEGORY_ID: ids.category.web, CATEGORY_NAME: "Web Development", DESIGN_ID: ids.category.design,
    COURSE_ID: ids.course.react, COURSE_TITLE: "React Basics", MATERIAL_ID: ids.material.welcome,
    SECOND_MATERIAL_ID: ids.material.props, PREMIUM_COURSE_ID: ids.course.premium,
    CONTEST_ID: ids.contest.live, WEBINAR_ID: ids.webinar.upcoming,
    FULL_WEBINAR_ID: ids.webinar.full, PAST_WEBINAR_ID: ids.webinar.past,
    COMMUNITY_ID: ids.community.open, PRIVATE_COMMUNITY_ID: ids.community.private,
    JOB_ID: ids.job.frontend, CLOSED_JOB_ID: ids.job.closed, JOB_TITLE: "Frontend Engineer",
    POST_ID: ids.post.hello, POST_TEXT: "Hello world, my first showcase post!",
    INSTRUCTOR_ID: ids.instructor, CSS_COURSE_ID: ids.course.css,
    UPCOMING_CONTEST_ID: ids.contest.upcoming, PAST_CONTEST_ID: ids.contest.past,
    CURRENT_YEAR: String(new Date().getFullYear()), PAST_YEAR: String(new Date().getFullYear() - 2),
    EARLIER_YEAR: String(new Date().getFullYear() - 3), NEXT_YEAR: String(new Date().getFullYear() + 1),
  };

  // Independent actors for workflows that change server state.
  const actors = {};
  for (const key of ["PROFILE", "STUDY", "EVENT", "ENTRY", "SHOWCASE", "CHAT", "COMMUNITY", "APPLY", "SETTINGS", "PASSWORD", "NOTIFY", "DELETE", "CV", "CVSAVE", "CLOSED_HIRER", "EXPIRED_HIRER", "DRAFT_HIRER", "EMPTY_HIRER", "PUBLISH_HIRER", "STATUS_HIRER"]) {
    const role = key.endsWith("HIRER") ? "hirer" : "learner";
    const username = `maestro_${key.toLowerCase()}`;
    const user = await one("INSERT INTO users(name,email,username,password_hash,role,account_status) VALUES($1,$2,$3,$4,$5,'active') RETURNING id", [`Maestro ${key}`, `${username}@e2e.test`, username, hash, role]);
    actors[key] = user.id;
    env[`${key}_USERNAME`] = username;
    env[`${key}_ID`] = user.id;
    if (role === "learner") await query("INSERT INTO user_interests(user_id,interest_id) VALUES($1,$2)", [user.id, ids.category.web]);
  }
  env.REGISTER_LEARNER_USERNAME = `ml_${env.RUN_ID}`;
  env.REGISTER_HIRER_USERNAME = `mh_${env.RUN_ID}`;
  env.CHANNEL_ID = (await one("SELECT id FROM community_chats WHERE community_id=$1 ORDER BY created_at LIMIT 1", [ids.community.open])).id;
  await query("INSERT INTO contest_participants(contest_id,participant_id,payment_status) VALUES($1,$2,'paid')", [ids.contest.live, actors.ENTRY]);

  const addJob = async (title, owner, status = "open", deadline = null) => {
    const job = await one("INSERT INTO jobs(creator_id,category_id,title,description,type,status,location,salary_min,salary_max,currency,salary_period,application_deadline) VALUES($1,$2,$3,$4,'permanent',$5,'Dhaka',40000,60000,'BDT','monthly',$6) RETURNING id", [owner, ids.category.web, title, `${title} fixture description.`, status, deadline]);
    await query("INSERT INTO job_categories(job_id,category_id) VALUES($1,$2)", [job.id, ids.category.web]);
    return job.id;
  };
  env.EXPIRED_JOB_ID = await addJob("Expired Maestro Role", ids.hirer, "open", new Date(Date.now() - 86400000).toISOString());
  env.DRAFT_JOB_ID = await addJob("Draft Maestro Role", ids.hirer, "draft");
  env.FUTURE_JOB_ID = await addJob("Future Maestro Role", ids.hirer, "open", new Date(Date.now() + 30 * 86400000).toISOString());
  env.STATUS_JOB_ID = await addJob("Toggle Maestro Role", actors.STATUS_HIRER);
  await addJob("Only Closed Role", actors.CLOSED_HIRER, "closed");
  await addJob("Only Draft Role", actors.DRAFT_HIRER, "draft");
  await addJob("Only Expired Role", actors.EXPIRED_HIRER, "open", new Date(Date.now() - 86400000).toISOString());

  // A valid, minimal one-page PDF used as the applicant's saved CV.
  const objects = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>", "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] >>"];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const [index, object] of objects.entries()) { offsets.push(Buffer.byteLength(pdf)); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; }
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 4\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  const bytes = Buffer.from(pdf);
  // Native document-picker fixtures. The opt-in physical runner copies these to Downloads.
  await writeFile(path.join(workspace, "assets", "maestro-cv.pdf"), bytes);
  await writeFile(path.join(workspace, "assets", "invalid-cv.pdf"), "This is not a PDF document.\n");
  await query("INSERT INTO user_cvs(user_id,file_name,file_size,file_data,source) VALUES($1,'maestro-cv.pdf',$2,$3,'uploaded')", [actors.APPLY, bytes.length, bytes]);
  await query("INSERT INTO job_applications(job_id,applicant_id,cover_letter,resume_blob,resume_mime_type) VALUES($1,$2,'Maestro applicant fixture',$3,'application/pdf')", [ids.job.frontend, ids.learner2, bytes]);

  const ownPost = await one("INSERT INTO showcase_posts(creator_id,category_id,content) VALUES($1,$2,'Maestro delete fixture') RETURNING id", [actors.SHOWCASE, ids.category.web]);
  env.OWN_POST_ID = ownPost.id;
  const conversation = await one("INSERT INTO conversations DEFAULT VALUES RETURNING id");
  await query("INSERT INTO conversation_members(conversation_id,user_id) VALUES($1,$2),($1,$3)", [conversation.id, actors.CHAT, ids.learner2]);
  await query("INSERT INTO messages(conversation_id,sender_id,content) VALUES($1,$2,'Maestro hello from Liam')", [conversation.id, ids.learner2]);
  env.CONVERSATION_ID = conversation.id;

  const course = await one("INSERT INTO courses(creator_id,instructor_id,title,slug,description,category_id,price,currency,status,published_at) VALUES($1,$2,'Maestro Video Course','maestro-video-course','Short local video quiz fixtures',$3,0,'BDT','published',now()) RETURNING id", [ids.admin, ids.instructor, ids.category.web]);
  env.VIDEO_COURSE_ID = course.id;
  await query("INSERT INTO course_categories(course_id,category_id) VALUES($1,$2)", [course.id, ids.category.web]);
  const videoBytes = await readFile(path.join(workspace, "assets", "lecture.mp4"));
  const videoDir = path.join(local, "uploads", "course-materials", course.id);
  await mkdir(videoDir, { recursive: true });
  await writeFile(path.join(videoDir, "lecture.mp4"), videoBytes);
  const material = await one("INSERT INTO course_materials(course_id,name,type,mime_type,file_url,file_name,file_size,is_preview) VALUES($1,'Maestro Video Lesson','video','video/mp4',$2,'lecture.mp4',$3,false) RETURNING id", [course.id, `/uploads/course-materials/${course.id}/lecture.mp4`, videoBytes.length]);
  env.VIDEO_MATERIAL_ID = material.id;
  const sourceKey = createHash("sha256").update("Maestro Video Course\nMaestro Video Lesson").digest("hex").slice(0, 32);
  for (const checkpoint of [1, 2, 3]) {
    for (let position = 0; position < 3; position++) {
      await query("INSERT INTO material_quiz_questions(material_id,checkpoint,position,question,options,correct_index,explanation,source_key) VALUES($1,$2,$3,$4,$5::jsonb,0,'The first option is correct.',$6)", [material.id, checkpoint, position, `Fixture question ${position + 1}?`, JSON.stringify(["Correct option", "Wrong option", "Another wrong option", "Last wrong option"]), sourceKey]);
    }
  }
  // The chat actor is a member; the separate COMMUNITY actor starts outside both groups.
  await query("INSERT INTO community_members(community_id,member_id,status,approved_at) VALUES($1,$2,'approved',now())", [ids.community.open, actors.CHAT]);
  for (const [category, title] of [["jobs", "Maestro job notification"], ["social", "Maestro social notification"]]) {
    await query("INSERT INTO notifications(user_id,type,category,title,body,link) VALUES($1,'system',$2,$3,'Maestro fixture',$4)", [actors.NOTIFY, category, title, category === "jobs" ? `/jobs/${ids.job.frontend}` : `/showcase/${ids.post.hello}`]);
  }
  await writeFile(path.join(local, "env.json"), JSON.stringify(env, null, 2) + "\n");

  backend = spawn(process.execPath, ["src/server.js"], {
    cwd: path.join(root, "backendSimple"), windowsHide: true, stdio: "inherit",
    env: { ...process.env, NODE_ENV: "development", PORT: "4401", GATEWAY_PORT: "4401",
      DATABASE_URL: "postgres://postgres:postgres@127.0.0.1:54329/postgres", DATABASE_SSL: "false", DB_POOL_MAX: "1",
      JWT_ACCESS_SECRET: "maestro-local-access", JWT_REFRESH_SECRET: "maestro-local-refresh",
      ACCESS_TOKEN_TTL: "15m", REFRESH_TOKEN_TTL: "30d", CORS_ORIGINS: "http://127.0.0.1:3200",
      UPLOAD_DIR: path.join(local, "uploads"), RATE_LIMIT_PER_MINUTE: "1000000", MAX_UPLOAD_MB: "10",
      GEMINI_API_KEY: "", GEMINI_API_BASE: "", GEMINI_MODEL: "" },
  });
  backend.on("error", error => { console.error(error.message); void stop(1); });
  backend.on("exit", code => { if (!stopping) void stop(code || 1); });
  proxy = await startFixtureProxy(env.CONTROL_TOKEN);
  console.log("Local Maestro fixtures created. API: http://127.0.0.1:4400/api/v1");
  console.log("No Supabase connection, browser, emulator or test has been started. Ctrl+C stops the server.");
} catch (error) {
  console.error(error.message);
  await stop(1);
}
