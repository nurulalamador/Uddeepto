import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { once } from "node:events";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { db, query, server } from "./harness.js";

const sqlFile = (name) => readFile(new URL(`../../backend/database/${name}`, import.meta.url), "utf8");

test("notifications: events, API and delivery rules", async (t) => {
  let schema = await sqlFile("001_initial_schema.sql");
  schema = schema.replace(/CREATE EXTENSION IF NOT EXISTS (pgcrypto|citext);/g, "").replace(/\bCITEXT\b/g, "TEXT");
  await db.exec(schema);
  for (const file of [
    "003_platform_settings.sql",
    "004_instructors.sql",
    "005_profile_course_media.sql",
    "006_multiple_categories.sql",
    "007_course_material_files.sql",
    "008_contest_submission_kinds.sql",
    "009_webinar_speakers.sql",
    "010_profile_details.sql",
    "011_job_locations.sql",
    "012_notifications.sql",
  ])
    await db.exec(await sqlFile(file));
  process.env.UPLOAD_DIR = mkdtempSync(join(tmpdir(), "uddeepto-uploads-"));

  let source = await readFile(new URL("../../backend/services/frontend/src/server.js", import.meta.url), "utf8");
  source = source
    .replace(/import bcrypt from ['"]bcryptjs['"];/, () => "const bcrypt={hash:async value=>'test-only:'+value};")
    .replace(/(['"])@uddeepto\/common\1/, () => JSON.stringify(new URL("./harness.js", import.meta.url).href))
    .replace(/(['"])express\1/, () => JSON.stringify(import.meta.resolve("express")))
    .replace(/(['"])zod\1/, () => JSON.stringify(import.meta.resolve("zod")));
  await import("data:text/javascript;base64," + Buffer.from(source).toString("base64"));
  await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}`;

  const ids = {};
  for (const [name, role] of [["Poster", "learner"], ["Fan", "learner"], ["Third", "learner"], ["Hirer", "hirer"], ["Admin", "admin"]])
    ids[name] = (await query("INSERT INTO users(name,email,username,password_hash,role) VALUES($1,$2,$3,'x',$4) RETURNING id", [name, `${name}@example.com`, name, role])).rows[0].id;
  const category = (await query("INSERT INTO interest_categories(name,slug,icon) VALUES('Web','web','code') RETURNING id")).rows[0].id;
  const other = (await query("INSERT INTO interest_categories(name,slug,icon) VALUES('Music','music','music') RETURNING id")).rows[0].id;
  await query("INSERT INTO user_interests(user_id,interest_id) VALUES($1,$2),($3,$2),($4,$5)", [ids.Poster, category, ids.Fan, ids.Third, other]);

  async function request(path, { as = "Poster", method = "GET", body } = {}) {
    const res = await fetch(base + path, { method, headers: { "x-test-user": ids[as], "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, data: await res.json().catch(() => null) };
  }
  async function ok(path, options) {
    const r = await request(path, options);
    assert.equal(r.status, 200, `${path}: ${JSON.stringify(r.data)}`);
    return r.data;
  }
  const notes = async (name, type) =>
    (await query("SELECT * FROM notifications WHERE user_id=$1" + (type ? " AND type=$2" : "") + " ORDER BY created_at, id", type ? [ids[name], type] : [ids[name]])).rows;
  const clear = () => query("DELETE FROM notifications");
  const day = 864e5;

  try {
    let post;
    await t.test("liking a post notifies its author once; unliking withdraws it; own likes are silent", async () => {
      post = (await query("INSERT INTO showcase_posts(creator_id,category_id,content) VALUES($1,$2,'My first project') RETURNING id", [ids.Poster, category])).rows[0].id;
      await ok(`/showcase/${post}/reaction`, { as: "Fan", method: "PUT" });
      let rows = await notes("Poster", "post_like");
      assert.equal(rows.length, 1);
      assert.equal(rows[0].title, "Fan liked your post");
      assert.equal(rows[0].body, "My first project");
      assert.equal(rows[0].link, `/showcase/${post}`);
      assert.equal(rows[0].category, "social");
      assert.equal(rows[0].actor_id, ids.Fan);
      await ok(`/showcase/${post}/reaction`, { as: "Fan", method: "PUT" });
      assert.equal((await notes("Poster", "post_like")).length, 0, "taking the like back removes the unread notice");
      await ok(`/showcase/${post}/reaction`, { as: "Fan", method: "PUT" });
      assert.equal((await notes("Poster", "post_like")).length, 1);
      await ok(`/showcase/${post}/reaction`, { as: "Poster", method: "PUT" });
      assert.equal((await notes("Poster", "post_like")).length, 1, "liking your own post tells nobody");
      await ok(`/showcase/${post}/reaction`, { as: "Poster", method: "PUT" });
    });

    await t.test("comments and comment likes", async () => {
      const comment = await ok(`/showcase/${post}/comments`, { as: "Fan", method: "POST", body: { content: "Nice work, keep going!" } });
      let rows = await notes("Poster", "post_comment");
      assert.equal(rows.length, 1);
      assert.equal(rows[0].title, "Fan commented on your post");
      assert.equal(rows[0].body, "Nice work, keep going!");
      assert.equal(rows[0].link, `/showcase/${post}#comments`);
      await ok(`/showcase/${post}/comments`, { as: "Poster", method: "POST", body: { content: "Thanks" } });
      assert.equal((await notes("Poster", "post_comment")).length, 1, "commenting on your own post tells nobody");
      await ok(`/comments/${comment.id}/reaction`, { as: "Poster", method: "PUT" });
      rows = await notes("Fan", "comment_like");
      assert.equal(rows.length, 1);
      assert.equal(rows[0].title, "Poster liked your comment");
    });

    await t.test("notification API: list, filters, counts, read, read-all, delete, clear, isolation", async () => {
      await clear();
      for (let i = 1; i <= 5; i += 1)
        await query("INSERT INTO notifications(user_id,type,category,title,created_at) VALUES($1,'post_like','social',$2,now()-($3||' minutes')::interval)", [ids.Poster, `Social ${i}`, i]);
      await query("INSERT INTO notifications(user_id,type,category,title) VALUES($1,'job_new','jobs','A job')", [ids.Poster]);
      await query("INSERT INTO notifications(user_id,type,category,title) VALUES($1,'job_new','jobs','Not yours')", [ids.Fan]);

      const first = await ok("/notifications?limit=4");
      assert.equal(first.items.length, 4);
      assert.equal(first.has_more, true);
      assert.equal(first.unread, 6);
      assert.deepEqual(first.unread_by_category, { social: 5, jobs: 1 });
      assert.equal(first.items[0].title, "A job", "newest first");
      assert.equal(first.items[0].read, false);
      const rest = await ok("/notifications?limit=4&offset=4");
      assert.equal(rest.items.length, 2);
      assert.equal(rest.has_more, false);
      assert.ok(!first.items.some((item) => item.title === "Not yours"), "other people's notifications are never listed");

      assert.equal((await ok("/notifications?category=jobs")).items.length, 1);
      assert.equal((await request("/notifications?category=nonsense")).status, 422);
      assert.equal((await ok("/notifications/unread-count")).count, 6);

      const target = first.items[0].id;
      await ok(`/notifications/${target}`, { method: "PATCH", body: { read: true } });
      assert.equal((await ok("/notifications/unread-count")).count, 5);
      assert.equal((await ok("/notifications?filter=unread")).items.length, 5);
      await ok(`/notifications/${target}`, { method: "PATCH", body: { read: false } });
      assert.equal((await ok("/notifications/unread-count")).count, 6);
      assert.equal((await request(`/notifications/${target}`, { as: "Fan", method: "PATCH", body: { read: true } })).status, 404, "cannot touch someone else's notification");
      assert.equal((await request(`/notifications/${target}`, { as: "Fan", method: "DELETE" })).status, 404);

      await ok("/notifications/read-all", { method: "POST", body: { category: "jobs" } });
      assert.equal((await ok("/notifications/unread-count")).count, 5);
      assert.equal((await ok("/notifications/unread-count", { as: "Fan" })).count, 1, "other accounts are unaffected");
      await ok("/notifications/read-all", { method: "POST", body: {} });
      assert.equal((await ok("/notifications/unread-count")).count, 0);

      await ok(`/notifications/${target}`, { method: "DELETE" });
      assert.equal((await ok("/notifications")).items.length, 5);
      assert.equal((await ok("/notifications", { method: "DELETE" })).deleted, 5, "clear removes read items");
      assert.equal((await ok("/notifications")).items.length, 0);
      assert.equal((await ok("/notifications", { as: "Fan" })).items.length, 1);
    });

    await t.test("job applications: hirer decisions notify the applicant once per outcome", async () => {
      await clear();
      const job = (await query("INSERT INTO jobs(creator_id,category_id,title,description,type,status) VALUES($1,$2,'Frontend Developer','Build UIs','permanent','open') RETURNING id", [ids.Hirer, category])).rows[0].id;
      await query("INSERT INTO job_applications(job_id,applicant_id,cover_letter) VALUES($1,$2,'Hi'),($1,$3,'Hello')", [job, ids.Poster, ids.Fan]);
      assert.equal((await request(`/jobs/${job}/applications/${ids.Poster}`, { as: "Fan", method: "PATCH", body: { status: "accepted" } })).status, 403);
      assert.equal((await notes("Poster")).length, 0, "a stranger's attempt tells nobody anything");

      await ok(`/jobs/${job}/applications/${ids.Poster}`, { as: "Hirer", method: "PATCH", body: { status: "shortlisted" } });
      await ok(`/jobs/${job}/applications/${ids.Poster}`, { as: "Hirer", method: "PATCH", body: { status: "accepted" } });
      await ok(`/jobs/${job}/applications/${ids.Poster}`, { as: "Hirer", method: "PATCH", body: { status: "accepted" } });
      const rows = await notes("Poster", "job_application_status");
      assert.deepEqual(rows.map((row) => row.title), ["You were shortlisted for “Frontend Developer”", "Your application for “Frontend Developer” was accepted"]);
      assert.equal(rows[1].link, `/jobs/${job}`);
      await ok(`/jobs/${job}/applications/${ids.Poster}`, { as: "Hirer", method: "PATCH", body: { status: "applied" } });
      assert.equal((await notes("Poster", "job_application_status")).length, 2, "resetting to applied is silent");

      await ok(`/jobs/${job}/status`, { as: "Hirer", method: "PATCH", body: { status: "closed" } });
      const closed = await notes("Fan", "job_closed");
      assert.equal(closed.length, 1, "pending applicants hear that the job closed");
      assert.match(closed[0].title, /Frontend Developer/);
      await ok(`/jobs/${job}/status`, { as: "Hirer", method: "PATCH", body: { status: "closed" } });
      assert.equal((await notes("Fan", "job_closed")).length, 1);
    });

    await t.test("publishing content notifies learners with matching interests only", async () => {
      await clear();
      const course = (await query("INSERT INTO courses(creator_id,title,slug,description,category_id) VALUES($1,'Practical JS','practical-js','Learn',$2) RETURNING id", [ids.Admin, category])).rows[0].id;
      await query("INSERT INTO course_categories(course_id,category_id) VALUES($1,$2) ON CONFLICT DO NOTHING", [course, category]);
      await ok(`/admin/courses/${course}`, { as: "Admin", method: "PATCH", body: { status: "draft" } });
      assert.equal((await notes("Poster", "course_new")).length, 0, "drafts are not announced");
      await ok(`/admin/courses/${course}`, { as: "Admin", method: "PATCH", body: { status: "published" } });
      for (const name of ["Poster", "Fan"]) {
        const rows = await notes(name, "course_new");
        assert.equal(rows.length, 1, `${name} likes this topic`);
        assert.equal(rows[0].title, "New course: Practical JS");
        assert.equal(rows[0].link, `/courses/${course}`);
      }
      assert.equal((await notes("Third", "course_new")).length, 0, "different interest");
      assert.equal((await notes("Hirer", "course_new")).length, 0, "hirers do not get learning announcements");
      await ok(`/admin/courses/${course}`, { as: "Admin", method: "PATCH", body: { status: "published", title: "Practical JS 2" } });
      assert.equal((await notes("Poster", "course_new")).length, 1, "saving again does not repeat the announcement");

      // New lesson: only people enrolled in the course are told.
      await query("INSERT INTO course_enrollments(course_id,user_id) VALUES($1,$2)", [course, ids.Poster]);
      const lesson = await ok(`/manage/courses/${course}/materials`, { as: "Admin", method: "POST", body: { name: "Closures", content_text: "A closure is...", is_preview: false } });
      const added = await notes("Poster", "course_material_added");
      assert.equal(added.length, 1);
      assert.equal(added[0].title, "New lesson in Practical JS 2");
      assert.equal(added[0].link, `/courses/${course}/materials/${lesson.id}`);
      assert.equal((await notes("Fan", "course_material_added")).length, 0);
    });

    await t.test("contests: judging notifies the participant; completing fixes ranks and announces results", async () => {
      await clear();
      const contest = (await query("INSERT INTO contests(creator_id,category_id,name,description,starting_time,ending_time,status) VALUES($1,$2,'Code Sprint','Fast',now()-interval '1 day',now()+interval '1 day','published') RETURNING id", [ids.Admin, category])).rows[0].id;
      for (const name of ["Poster", "Fan", "Third"]) await ok(`/contests/${contest}/join`, { as: name, method: "POST" });
      const submission = (await query("INSERT INTO contest_submissions(contest_id,participant_id,content) VALUES($1,$2,'print(1)') RETURNING id", [contest, ids.Poster])).rows[0].id;

      await ok(`/manage/submissions/${submission}`, { as: "Admin", method: "PATCH", body: { score: 80, status: "judging" } });
      assert.equal((await notes("Poster", "contest_submission_judged")).length, 0, "judging is not a result yet");
      await ok(`/manage/submissions/${submission}`, { as: "Admin", method: "PATCH", body: { score: 80, status: "accepted" } });
      const judged = await notes("Poster", "contest_submission_judged");
      assert.equal(judged.length, 1);
      assert.equal(judged[0].title, "Your submission in Code Sprint was accepted");
      assert.equal(judged[0].body, "Score: 80");

      await ok(`/admin/contests/${contest}`, { as: "Admin", method: "PATCH", body: { status: "completed" } });
      const standings = (await query("SELECT participant_id,rank,points FROM contest_participants WHERE contest_id=$1 ORDER BY rank", [contest])).rows;
      assert.equal(standings[0].participant_id, ids.Poster, "the only scorer is first");
      assert.deepEqual(standings.map((row) => Number(row.rank)), [1, 2, 3]);
      const won = await notes("Poster", "contest_result");
      assert.equal(won.length, 1);
      assert.equal(won[0].title, "You won Code Sprint!");
      assert.equal(won[0].body, "Your final rank is #1 with 80 points.");
      const second = await notes(standings[1].participant_id === ids.Fan ? "Fan" : "Third", "contest_result");
      assert.match(second[0].title, /You finished #2 in Code Sprint/);
      await ok(`/admin/contests/${contest}`, { as: "Admin", method: "PATCH", body: { status: "completed", name: "Code Sprint" } });
      assert.equal((await notes("Poster", "contest_result")).length, 1, "results are announced once");
      assert.equal((await notes("Hirer", "contest_result")).length, 0);

      const open = (await query("INSERT INTO contests(creator_id,category_id,name,description,starting_time,ending_time,status) VALUES($1,$2,'Cancelled Cup','x',now()+interval '1 day',now()+interval '2 days','published') RETURNING id", [ids.Admin, category])).rows[0].id;
      await ok(`/contests/${open}/join`, { as: "Fan", method: "POST" });
      await ok(`/admin/contests/${open}`, { as: "Admin", method: "PATCH", body: { status: "cancelled" } });
      assert.equal((await notes("Fan", "contest_cancelled")).length, 1);
      assert.equal((await notes("Poster", "contest_cancelled")).length, 0, "people who did not join are not told");
    });

    await t.test("communities: approving or declining a join request tells the member", async () => {
      await clear();
      const community = await ok("/communities", { as: "Fan", method: "POST", body: { name: "Builders", slug: "builders", description: "Makers", category_ids: [category], requires_approval: true, is_private: false } });
      await query("INSERT INTO community_members(community_id,member_id,status) VALUES($1,$2,'pending'),($1,$3,'pending')", [community.id, ids.Poster, ids.Third]);
      await ok(`/communities/${community.id}/members/${ids.Poster}`, { as: "Fan", method: "PATCH", body: { status: "approved" } });
      await ok(`/communities/${community.id}/members/${ids.Third}`, { as: "Fan", method: "PATCH", body: { status: "rejected" } });
      const yes = await notes("Poster", "community_membership");
      assert.equal(yes[0].title, "Your request to join Builders was approved");
      assert.equal(yes[0].link, `/communities/${community.id}`);
      assert.equal((await notes("Third", "community_membership"))[0].title, "Your request to join Builders was declined");
    });

    await t.test("moderation: removed posts and reviewed reports", async () => {
      await clear();
      const removed = (await query("INSERT INTO showcase_posts(creator_id,category_id,content) VALUES($1,$2,'Spammy post') RETURNING id", [ids.Poster, category])).rows[0].id;
      const own = (await query("INSERT INTO showcase_posts(creator_id,category_id,content) VALUES($1,$2,'Mine') RETURNING id", [ids.Poster, category])).rows[0].id;
      await ok(`/showcase/${own}`, { as: "Poster", method: "DELETE" });
      assert.equal((await notes("Poster", "post_removed")).length, 0, "deleting your own post is not news");
      await ok(`/showcase/${removed}`, { as: "Admin", method: "DELETE" });
      const rows = await notes("Poster", "post_removed");
      assert.equal(rows.length, 1);
      assert.equal(rows[0].body, "Spammy post");

      const report = (await query("INSERT INTO reported_showcase_posts(post_id,reporter_id,reason) VALUES($1,$2,'spam') RETURNING id", [removed, ids.Fan])).rows[0].id;
      await ok(`/admin/reported_showcase_posts/${report}`, { as: "Admin", method: "PATCH", body: { status: "reviewing" } });
      assert.equal((await notes("Fan", "report_update")).length, 0, "only the final outcome is reported");
      await ok(`/admin/reported_showcase_posts/${report}`, { as: "Admin", method: "PATCH", body: { status: "resolved" } });
      const outcome = await notes("Fan", "report_update");
      assert.equal(outcome.length, 1);
      assert.match(outcome[0].body, /took action/);
    });

    await t.test("reminders for events that start or end within a day are created when the app is opened", async () => {
      await clear();
      const webinar = (await query("INSERT INTO webinars(creator_id,category_id,name,description,starting_time,ending_time,status) VALUES($1,$2,'Intro to APIs','x',now()+interval '5 hours',now()+interval '6 hours','scheduled') RETURNING id", [ids.Admin, category])).rows[0].id;
      const later = (await query("INSERT INTO webinars(creator_id,category_id,name,description,starting_time,ending_time,status) VALUES($1,$2,'Far away','x',now()+interval '3 days',now()+interval '3 days 1 hour','scheduled') RETURNING id", [ids.Admin, category])).rows[0].id;
      await query("INSERT INTO webinar_participants(webinar_id,participant_id,status) VALUES($1,$2,'registered'),($3,$2,'registered')", [webinar, ids.Third, later]);
      const count = await ok("/notifications/unread-count", { as: "Third" });
      assert.equal(count.count, 1);
      const [reminder] = await notes("Third", "webinar_reminder");
      assert.equal(reminder.title, "“Intro to APIs” starts soon");
      assert.match(reminder.body, /about 5 hour/);
      assert.equal(reminder.link, `/webinars/${webinar}`);
      await ok("/notifications/unread-count", { as: "Third" });
      await ok("/notifications", { as: "Third" });
      assert.equal((await notes("Third", "webinar_reminder")).length, 1, "never repeated");
      assert.equal((await ok("/notifications/unread-count", { as: "Hirer" })).count, 0);
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await db.close();
  }
});
