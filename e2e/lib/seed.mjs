import bcrypt from "bcryptjs";
import { PASSWORD, accounts } from "./config.mjs";

/**
 * The baseline data every test starts from. Tests add their own records (with unique names) on top
 * of it and never depend on another test having run first.
 *
 *   learner   Lena Learner   interests: Web Development, Design     (the main learner)
 *   learner2  Liam Learner   interests: Web Development             (a second person to interact with)
 *   newbie    Nora Newbie    no interests yet                       (sees the first-run interest gate)
 *   hirer     Hana Hirer     owns "Frontend Engineer" and "Closed Role"
 *   hirer2    Hugo Hirer     owns "Data Analyst"
 *   admin     Ada Admin
 *   banned    Bob Banned     suspended account
 */
export async function seed(db) {
  const hash = await bcrypt.hash(PASSWORD, 4);
  const one = async (sql, params = []) => (await db.query(sql, params)).rows[0];
  const ids = {};

  for (const [key, role] of [
    ["learner", "learner"], ["learner2", "learner"], ["newbie", "learner"],
    ["hirer", "hirer"], ["hirer2", "hirer"], ["admin", "admin"], ["banned", "learner"],
  ]) {
    const a = accounts[key];
    ids[key] = (await one(
      "INSERT INTO users(name,email,username,password_hash,role,account_status,bio) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id",
      [a.name, a.email, a.username, hash, role, key === "banned" ? "suspended" : "active", `${a.name} lives in the E2E test data.`],
    )).id;
  }

  const category = {};
  for (const [key, name, slug, icon, kind] of [
    ["web", "Web Development", "web-development", "code", "code"],
    ["design", "Graphic Design", "graphic-design", "palette", "image"],
    ["music", "Music", "music", "spline-pointer", "audio"],
    ["data", "Data Science", "data-science", "star", "text"],
  ]) {
    category[key] = (await one(
      "INSERT INTO interest_categories(name,slug,icon,submission_kind,description) VALUES($1,$2,$3,$4,$5) RETURNING id",
      [name, slug, icon, kind, `${name} topics`],
    )).id;
  }
  ids.category = category;
  await db.query("INSERT INTO user_interests(user_id,interest_id) VALUES($1,$2),($1,$3),($4,$2)", [ids.learner, category.web, category.design, ids.learner2]);

  ids.instructor = (await one(
    "INSERT INTO instructors(name,designation,details) VALUES('Dr. Iris Instructor','Senior Instructor','Twenty years of teaching web development and design.') RETURNING id",
  )).id;

  // ---- courses
  const course = {};
  const addCourse = async (key, title, slug, cat, price, status) => {
    course[key] = (await one(
      "INSERT INTO courses(creator_id,instructor_id,title,slug,description,category_id,price,currency,status,published_at) VALUES($1,$2,$3,$4,$5,$6,$7,'BDT',$8,$9) RETURNING id",
      [ids.admin, ids.instructor, title, slug, `${title}: a hands-on course for the E2E suite.`, category[cat], price, status, status === "published" ? new Date().toISOString() : null],
    )).id;
    await db.query("INSERT INTO course_categories(course_id,category_id) VALUES($1,$2)", [course[key], category[cat]]);
  };
  await addCourse("react", "React Basics", "react-basics", "web", 0, "published");
  await addCourse("css", "Advanced CSS", "advanced-css", "design", 0, "published");
  await addCourse("premium", "Premium Masterclass", "premium-masterclass", "web", 500, "published");
  await addCourse("draft", "Draft Course", "draft-course", "web", 0, "draft");
  ids.course = course;
  ids.material = {};
  let order = 0;
  for (const [key, courseKey, name, text, preview] of [
    ["welcome", "react", "Welcome to React", "# Welcome\n\nReact lets you build UIs from **components**.", true],
    ["props", "react", "Components and Props", "Components accept inputs called props.", false],
    ["jsx", "react", "JSX in depth", "JSX is syntax sugar for `React.createElement`.", false],
    ["flex", "css", "Flexbox layouts", "Use `display: flex` to lay items out in a row.", true],
    ["grid", "css", "CSS Grid layouts", "Use `display: grid` for two-dimensional layouts.", false],
  ]) {
    ids.material[key] = (await one(
      "INSERT INTO course_materials(course_id,name,type,content_text,is_preview,sort_order) VALUES($1,$2,'text',$3,$4,$5) RETURNING id",
      [course[courseKey], name, text, preview, order++],
    )).id;
  }
  await db.query("INSERT INTO course_enrollments(course_id,user_id) VALUES($1,$2)", [course.css, ids.learner2]);

  // ---- contests
  const contest = {};
  const addContest = async (key, name, cat, type, start, end, status) => {
    contest[key] = (await one(
      `INSERT INTO contests(creator_id,name,description,category_id,type,entry_fee,currency,status,starting_time,ending_time) VALUES($1,$2,$3,$4,$5,0,'BDT',$6,now()+interval '${start}',now()+interval '${end}') RETURNING id`,
      [ids.admin, name, `${name} is a contest in the E2E data.`, category[cat], type, status],
    )).id;
    await db.query("INSERT INTO contest_categories(contest_id,category_id) VALUES($1,$2)", [contest[key], category[cat]]);
  };
  await addContest("live", "Live Code Sprint", "web", "competitive_programming", "-1 day", "2 days", "published");
  await addContest("upcoming", "Upcoming Design Jam", "design", "drawing", "2 days", "3 days", "published");
  await addContest("past", "Past Music Showdown", "music", "singing", "-10 days", "-8 days", "completed");
  await addContest("draft", "Draft Contest", "web", "general", "5 days", "6 days", "draft");
  ids.contest = contest;
  ids.problem = {};
  for (const [key, name, text, points, i] of [
    ["sum", "Sum of Two Numbers", "Read two integers and print their sum.", 100, 0],
    ["reverse", "Reverse a String", "Print the input string reversed.", 50, 1],
  ])
    ids.problem[key] = (await one(
      "INSERT INTO contest_problems(creator_id,contest_id,name,description,points,sort_order,sample_input,sample_output) VALUES($1,$2,$3,$4,$5,$6,'1 2','3') RETURNING id",
      [ids.admin, contest.live, name, text, points, i],
    )).id;
  await db.query("INSERT INTO contest_participants(contest_id,participant_id,payment_status) VALUES($1,$2,'paid')", [contest.live, ids.learner2]);
  await db.query("INSERT INTO contest_participants(contest_id,participant_id,payment_status,points,rank) VALUES($1,$2,'paid',90,1)", [contest.past, ids.learner2]);

  // ---- webinars
  const webinar = {};
  const addWebinar = async (key, name, cat, start, end, status, extra = {}) => {
    webinar[key] = (await one(
      `INSERT INTO webinars(creator_id,name,description,category_id,starting_time,ending_time,status,capacity,meeting_url,recording_url) VALUES($1,$2,$3,$4,now()+interval '${start}',now()+interval '${end}',$5,$6,$7,$8) RETURNING id`,
      [ids.admin, name, `${name} is a webinar in the E2E data.`, category[cat], status, extra.capacity ?? 50, extra.meeting ?? null, extra.recording ?? null],
    )).id;
    await db.query("INSERT INTO webinar_categories(webinar_id,category_id) VALUES($1,$2)", [webinar[key], category[cat]]);
    await db.query("INSERT INTO webinar_speakers(webinar_id,instructor_id) VALUES($1,$2)", [webinar[key], ids.instructor]);
  };
  await addWebinar("upcoming", "Upcoming API Webinar", "web", "3 days", "3 days 1 hour", "scheduled", { meeting: "https://meet.example.com/api-webinar" });
  await addWebinar("past", "Past Design Webinar", "design", "-5 days", "-5 days +1 hour", "completed", { recording: "https://example.com/recording" });
  await addWebinar("full", "Full House Webinar", "web", "4 days", "4 days 1 hour", "scheduled", { capacity: 1 });
  await db.query("INSERT INTO webinar_participants(webinar_id,participant_id) VALUES($1,$2)", [webinar.full, ids.learner2]);
  ids.webinar = webinar;

  // ---- communities (both owned by learner2)
  const community = {};
  for (const [key, name, slug, approval] of [
    ["open", "Open Builders", "open-builders", false],
    ["private", "Private Circle", "private-circle", true],
  ]) {
    community[key] = (await one(
      "INSERT INTO communities(creator_id,name,slug,description,category_id,requires_approval,is_private) VALUES($1,$2,$3,$4,$5,$6,$6) RETURNING id",
      [ids.learner2, name, slug, `${name} is a community in the E2E data.`, category.web, approval],
    )).id;
    await db.query("INSERT INTO community_categories(community_id,category_id) VALUES($1,$2)", [community[key], category.web]);
    await db.query("INSERT INTO community_members(community_id,member_id,status,is_moderator,approved_at) VALUES($1,$2,'approved',true,now())", [community[key], ids.learner2]);
    const chat = (await one("INSERT INTO community_chats(community_id,name,description) VALUES($1,'general','General chat') RETURNING id", [community[key]])).id;
    await db.query("INSERT INTO community_chat_messages(community_id,chat_id,sender_id,content) VALUES($1,$2,$3,$4)", [community[key], chat, ids.learner2, `Welcome to ${name}!`]);
  }
  ids.community = community;

  // ---- jobs
  const job = {};
  const addJob = async (key, owner, title, cat, type, min, max, status, extra = {}) => {
    job[key] = (await one(
      "INSERT INTO jobs(creator_id,category_id,title,description,salary_min,salary_max,currency,salary_period,location,latitude,longitude,type,is_remote,status) VALUES($1,$2,$3,$4,$5,$6,'BDT','monthly',$7,$8,$9,$10,$11,$12) RETURNING id",
      [ids[owner], category[cat], title, `${title}: join the E2E test company.`, min, max, extra.location ?? null, extra.lat ?? null, extra.lng ?? null, type, extra.remote ?? false, status],
    )).id;
    await db.query("INSERT INTO job_categories(job_id,category_id) VALUES($1,$2)", [job[key], category[cat]]);
  };
  await addJob("frontend", "hirer", "Frontend Engineer", "web", "permanent", 50000, 80000, "open", { location: "Dhaka", lat: 23.8103, lng: 90.4125 });
  await addJob("analyst", "hirer2", "Data Analyst", "data", "contract", 30000, 45000, "open", { remote: true });
  await addJob("closed", "hirer", "Closed Role", "web", "internship", null, null, "closed", { location: "Chattogram" });
  await db.query("INSERT INTO job_applications(job_id,applicant_id,cover_letter) VALUES($1,$2,'I would love to analyse your data.')", [job.analyst, ids.learner2]);
  ids.job = job;

  // ---- showcase
  ids.post = {};
  for (const [key, text, cat] of [
    ["hello", "Hello world, my first showcase post!", "web"],
    ["gradient", "A design experiment with gradients", "design"],
  ])
    ids.post[key] = (await one("INSERT INTO showcase_posts(creator_id,category_id,content) VALUES($1,$2,$3) RETURNING id", [ids.learner2, category[cat], text])).id;

  return ids;
}
