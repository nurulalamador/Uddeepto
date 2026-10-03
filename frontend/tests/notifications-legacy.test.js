import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { once } from "node:events";
import { db, query, servers } from "./harness.js";

const sqlFile = (name) => readFile(new URL(`../../backend/database/${name}`, import.meta.url), "utf8");

// Loads one backend service file against the in-memory database and returns its base URL.
async function load(service, patch = (text) => text) {
  const before = servers.length;
  let source = await readFile(new URL(`../../backend/services/${service}/src/server.js`, import.meta.url), "utf8");
  source = source
    .replace(/import bcrypt from ['"]bcryptjs['"];/, () => "const bcrypt={hash:async value=>'test-only:'+value,compare:async()=>true};")
    .replace(/(['"])@uddeepto\/common\1/, () => JSON.stringify(new URL("./harness.js", import.meta.url).href))
    .replace(/(['"])express\1/, () => JSON.stringify(import.meta.resolve("express")))
    .replace(/(['"])zod\1/, () => JSON.stringify(import.meta.resolve("zod")));
  source = patch(source);
  await import("data:text/javascript;base64," + Buffer.from(source).toString("base64"));
  await once(servers[before], "listening");
  return `http://127.0.0.1:${servers[before].address().port}`;
}

test("notifications from the auth, community and jobs services", async (t) => {
  let schema = await sqlFile("001_initial_schema.sql");
  schema = schema.replace(/CREATE EXTENSION IF NOT EXISTS (pgcrypto|citext);/g, "").replace(/\bCITEXT\b/g, "TEXT");
  await db.exec(schema);
  for (const file of ["002_auth_sessions.sql", "003_platform_settings.sql", "004_instructors.sql", "005_profile_course_media.sql", "006_multiple_categories.sql", "007_course_material_files.sql", "008_contest_submission_kinds.sql", "009_webinar_speakers.sql", "010_profile_details.sql", "011_job_locations.sql", "012_notifications.sql"])
    await db.exec(await sqlFile(file));

  const urls = { auth: await load("auth"), community: await load("community"), // The real resourceRouter needs a database pool; a tiny stand-in creates the job row so the
  // service's own "job posted" notification code is what gets tested.
  jobs: await load("jobs", (text) => text.replace("resourceRouter({", () => `((_config)=>{const r=express.Router();r.post("/",auth(),async(q,s)=>{q.user.role=(await query("SELECT role FROM users WHERE id=$1",[q.user.sub])).rows[0].role;const x=(await query("INSERT INTO jobs(creator_id,category_id,title,description,type,status) VALUES($1,$2,$3,$4,$5,$6) RETURNING *",[q.user.sub,q.body.category_id,q.body.title,q.body.description,q.body.type,q.body.status||"draft"])).rows[0];s.status(201).json(x);});return r;})({`)) };
  const ids = {};
  for (const [name, role] of [["Owner", "learner"], ["Mod", "learner"], ["Joiner", "learner"], ["Applicant", "learner"], ["Hirer", "hirer"], ["Admin", "admin"], ["Admin2", "admin"]])
    ids[name] = (await query("INSERT INTO users(name,email,username,password_hash,role) VALUES($1,$2,$3,'x',$4) RETURNING id", [name, `${name}@example.com`, name, role])).rows[0].id;
  const category = (await query("INSERT INTO interest_categories(name,slug,icon) VALUES('Web','web','code') RETURNING id")).rows[0].id;
  const call = async (service, path, as, body, method = "POST") => {
    const res = await fetch(urls[service] + path, { method, headers: { "x-test-user": ids[as], "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, data: await res.json().catch(() => null) };
  };
  const notes = async (name, type) => (await query("SELECT * FROM notifications WHERE user_id=$1 AND type=$2 ORDER BY created_at", [ids[name], type])).rows;

  await t.test("registration welcomes everyone and alerts admins about new hirers", async () => {
    const learner = await call("auth", "/register", null, { name: "Rahim Uddin", email: "rahim@example.com", username: "rahim", password: "long-enough-pass" });
    assert.equal(learner.status, 201, JSON.stringify(learner.data));
    const welcome = await query("SELECT * FROM notifications WHERE user_id=$1", [learner.data.user.id]);
    assert.equal(welcome.rows.length, 1);
    assert.equal(welcome.rows[0].title, "Welcome to Uddeepto, Rahim!");
    assert.equal(welcome.rows[0].type, "welcome");
    assert.equal((await query("SELECT count(*)::int c FROM notifications WHERE type='hirer_registered'")).rows[0].c, 0, "learners do not alert admins");

    const hirer = await call("auth", "/register", null, { name: "Acme Hiring", email: "acme@example.com", username: "acme", password: "long-enough-pass", role: "hirer" });
    assert.equal(hirer.status, 201);
    for (const admin of ["Admin", "Admin2"]) {
      const rows = await notes(admin, "hirer_registered");
      assert.equal(rows.length, 1, `${admin} is told`);
      assert.equal(rows[0].title, "New hirer registered: Acme Hiring");
      assert.equal(rows[0].category, "admin");
    }
    assert.equal((await notes("Owner", "hirer_registered")).length, 0);
  });

  await t.test("community: reports alert every admin; joins alert the owner and moderators", async () => {
    const post = (await query("INSERT INTO showcase_posts(creator_id,category_id,content) VALUES($1,$2,'A post') RETURNING id", [ids.Owner, category])).rows[0].id;
    const report = await call("community", `/showcase/${post}/report`, "Joiner", { reason: "spam", details: "Copied" });
    assert.equal(report.status, 201, JSON.stringify(report.data));
    for (const admin of ["Admin", "Admin2"]) {
      const rows = await notes(admin, "report_received");
      assert.equal(rows.length, 1);
      assert.equal(rows[0].link, "/moderation");
    }
    assert.equal((await call("community", `/showcase/${post}/report`, "Joiner", { reason: "spam" })).status, 409);
    assert.equal((await notes("Admin", "report_received")).length, 1, "a rejected duplicate report does not notify again");

    const open = (await query("INSERT INTO communities(creator_id,category_id,name,slug,description,requires_approval) VALUES($1,$2,'Open house','open-house','x',false) RETURNING id", [ids.Owner, category])).rows[0].id;
    const gated = (await query("INSERT INTO communities(creator_id,category_id,name,slug,description,requires_approval) VALUES($1,$2,'Gated','gated','x',true) RETURNING id", [ids.Owner, category])).rows[0].id;
    await query("INSERT INTO community_members(community_id,member_id,status,is_moderator,approved_at) VALUES($1,$2,'approved',true,now())", [gated, ids.Mod]);

    assert.equal((await call("community", `/${open}/join`, "Joiner")).status, 201);
    const joined = await notes("Owner", "community_member_joined");
    assert.equal(joined.length, 1);
    assert.equal(joined[0].title, "Joiner joined Open house");
    await call("community", `/${open}/join`, "Joiner");
    assert.equal((await notes("Owner", "community_member_joined")).length, 1, "joining twice is not news");

    await call("community", `/${gated}/join`, "Joiner");
    for (const manager of ["Owner", "Mod"]) {
      const rows = await notes(manager, "community_join_request");
      assert.equal(rows.length, 1, `${manager} manages Gated`);
      assert.equal(rows[0].title, "Joiner asked to join Gated");
      assert.equal(rows[0].link, `/communities/${gated}`);
    }
    assert.equal((await notes("Joiner", "community_join_request")).length, 0);
  });

  await t.test("jobs: an application tells the hirer who applied", async () => {
    const job = (await query("INSERT INTO jobs(creator_id,category_id,title,description,type,status) VALUES($1,$2,'Backend Engineer','x','permanent','open') RETURNING id", [ids.Hirer, category])).rows[0].id;
    const closed = (await query("INSERT INTO jobs(creator_id,category_id,title,description,type,status) VALUES($1,$2,'Closed role','x','permanent','closed') RETURNING id", [ids.Hirer, category])).rows[0].id;
    const applied = await call("jobs", `/${job}/apply`, "Applicant", { cover_letter: "I love building APIs and have four years of experience." });
    assert.equal(applied.status, 201, JSON.stringify(applied.data));
    const rows = await notes("Hirer", "job_application_received");
    assert.equal(rows.length, 1);
    assert.equal(rows[0].title, "Applicant applied for “Backend Engineer”");
    assert.match(rows[0].body, /four years/);
    assert.equal(rows[0].link, "/job-management");
    assert.equal(rows[0].actor_id, ids.Applicant);
    assert.equal((await call("jobs", `/${closed}/apply`, "Applicant", { cover_letter: "Hi" })).status, 409);
    assert.equal((await notes("Hirer", "job_application_received")).length, 1, "closed jobs do not notify");
  });

  await t.test("jobs: a posted job alerts admins (hirers only) and, once open, interested learners", async () => {
    await query("INSERT INTO user_interests(user_id,interest_id) VALUES($1,$2)", [ids.Joiner, category]);
    const eventually = async (check) => {
      for (let i = 0; i < 40; i += 1) {
        if (await check()) return true;
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      return false;
    };
    const draft = await call("jobs", "/", "Hirer", { category_id: category, title: "Draft role", description: "x", type: "permanent" });
    assert.equal(draft.status, 201, JSON.stringify(draft.data));
    assert.ok(await eventually(async () => (await notes("Admin", "job_posted")).length === 1));
    assert.equal((await notes("Admin2", "job_posted")).length, 1);
    assert.equal((await notes("Joiner", "job_new")).length, 0, "a draft is not announced to learners");

    const open = await call("jobs", "/", "Hirer", { category_id: category, title: "Open role", description: "x", type: "permanent", status: "open" });
    assert.ok(await eventually(async () => (await notes("Joiner", "job_new")).length === 1));
    const announced = (await notes("Joiner", "job_new"))[0];
    assert.equal(announced.title, "New job: Open role");
    assert.equal(announced.link, `/jobs/${open.data.id}`);
    assert.equal((await notes("Applicant", "job_new")).length, 0, "no matching interest");

    await call("jobs", "/", "Admin", { category_id: category, title: "Admin role", description: "x", type: "permanent", status: "open" });
    assert.ok(await eventually(async () => (await notes("Joiner", "job_new")).length === 2));
    assert.equal((await notes("Admin", "job_posted")).length, 2, "admin-created jobs do not alert admins");
  });

  await new Promise((resolve) => setTimeout(resolve, 50));
  for (const server of servers) await new Promise((resolve) => server.close(resolve));
  await db.close();
});
