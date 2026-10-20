// Creates fresh records through the real API so every test can set up its own data
// (and can be run again without depending on what an earlier run left behind).
import { PASSWORD, accounts, urls } from "./config.mjs";
import { api, apiOk, seedIds, unique } from "./browser.mjs";

const slugOf = (text) => text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const inDays = (days, hours = 0) => new Date(Date.now() + days * 864e5 + hours * 36e5).toISOString();
export { inDays, slugOf };

let cache;
/** Ids of the baseline records (categories, courses, jobs ...) written by lib/seed.mjs. */
export const seed = async () => (cache ??= await seedIds());

export async function makeUser({ role = "learner", tag = "user" } = {}) {
  const key = unique(tag).replace(/[^a-z0-9]/gi, "").toLowerCase().slice(0, 20);
  const account = { username: key, email: `${key}@e2e.test`, name: `Person ${key.slice(-6)}`, role };
  const response = await fetch(`${urls.api}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: account.name, email: account.email, username: account.username, password: PASSWORD, role }),
  });
  if (!response.ok) throw new Error(`register failed: ${response.status} ${await response.text()}`);
  const data = await response.json();
  return { ...account, id: data.user.id };
}
/** Gives a learner interests so the first-run question does not block the page. */
export async function setInterests(who, ...keys) {
  const s = await seed();
  await apiOk(who, "frontend/profile/interests", { method: "PUT", body: { interest_ids: keys.map((key) => s.category[key]) } });
}
export async function makeLearner(tag = "learner", ...interests) {
  const user = await makeUser({ role: "learner", tag });
  await setInterests(user, ...(interests.length ? interests : ["web"]));
  return user;
}

export async function makeCourse({ title = unique("Course"), price = 0, status = "published", category = "web", materials = [{ name: "Lesson one", text: "First lesson text.", preview: true }, { name: "Lesson two", text: "Second lesson text." }] } = {}) {
  const s = await seed();
  const course = await apiOk("admin", "frontend/admin/courses", {
    method: "POST",
    body: { title, slug: slugOf(title), description: `${title} description`, category_ids: [s.category[category]], instructor_id: s.instructor, price, currency: "BDT", status },
  });
  const made = [];
  for (const m of materials) {
    const row = await apiOk("admin", `frontend/manage/courses/${course.id}/materials`, { method: "POST", body: { name: m.name, type: "text", content_text: m.text, is_preview: Boolean(m.preview) } });
    made.push({ id: row.id, name: m.name });
  }
  return { id: course.id, title, materials: made };
}

export async function makeContest({ name = unique("Contest"), phase = "live", category = "web", type = "competitive_programming", status = "published", problems = [], fee = 0, max } = {}) {
  const s = await seed();
  const [from, to] = { live: [-1, 2], upcoming: [2, 3], past: [-6, -4] }[phase];
  const contest = await apiOk("admin", "frontend/admin/contests", {
    method: "POST",
    body: { name, description: `${name} description`, category_ids: [s.category[category]], type, entry_fee: fee, currency: "BDT", status, starting_time: inDays(from), ending_time: inDays(to), ...(max ? { max_participants: max } : {}) },
  });
  const made = [];
  for (const [index, p] of problems.entries()) {
    const row = await apiOk("admin", `frontend/manage/contests/${contest.id}/problems`, { method: "POST", body: { name: p.name ?? `Problem ${index + 1}`, description: p.description ?? "Solve it.", points: p.points ?? 100 } });
    made.push({ id: row.id, name: p.name ?? `Problem ${index + 1}` });
  }
  return { id: contest.id, name, problems: made };
}

export async function makeWebinar({ name = unique("Webinar"), when = "upcoming", status = "scheduled", capacity = 50, category = "web", meeting = "https://meet.example.com/e2e" } = {}) {
  const s = await seed();
  // Days from now. "opening" starts in 10 minutes (the meeting link is open), "live" started 10 minutes ago.
  const minute = 1 / 1440;
  const [from, to] = { upcoming: [3, 3.04], soon: [0.5, 0.54], opening: [10 * minute, 70 * minute], live: [-10 * minute, 50 * minute], past: [-5, -4.96] }[when];
  const webinar = await apiOk("admin", "frontend/admin/webinars", {
    method: "POST",
    body: { name, description: `${name} description`, category_ids: [s.category[category]], speaker_ids: [s.instructor], status, capacity, meeting_url: meeting, starting_time: inDays(from * 1), ending_time: inDays(to * 1) },
  });
  return { id: webinar.id, name };
}

/** A hirer's job. Hirers cannot publish it themselves until they open it, which this does. */
export async function makeJob({ owner = "hirer", title = unique("Job"), category = "web", type = "permanent", min = 40000, max = 60000, open = true, location = "Dhaka", remote = false, lat = 23.78, lng = 90.4 } = {}) {
  const s = await seed();
  const job = await apiOk(owner, "jobs", {
    method: "POST",
    body: { title, description: `${title} description`, type, category_id: s.category[category], salary_min: min, salary_max: max, currency: "BDT", salary_period: "monthly", location, is_remote: remote, latitude: lat, longitude: lng },
  });
  if (open) await apiOk(owner, `frontend/jobs/${job.id}/status`, { method: "PATCH", body: { status: "open" } });
  return { id: job.id, title };
}

export async function makeCommunity({ owner = "learner2", name = unique("Community"), approval = false, category = "web" } = {}) {
  const s = await seed();
  const community = await apiOk(owner, "frontend/communities", {
    method: "POST",
    body: { name, slug: slugOf(name), description: `${name} description`, category_ids: [s.category[category]], requires_approval: approval, is_private: false },
  });
  const detail = await apiOk(owner, `frontend/communities/${community.id}`);
  return { id: community.id, name, chat: detail.chats[0].id };
}

export async function makePost({ author = "learner2", content = unique("Post"), category = "web" } = {}) {
  const s = await seed();
  const post = await apiOk(author, "frontend/showcase", { method: "POST", body: { category_id: s.category[category], content } });
  return { id: post.id, content };
}

/** Notifications of an account, newest first. */
export const notificationsOf = async (who, query = "") => (await apiOk(who, `frontend/notifications${query}`)).items;
export { accounts, api };

/** A learner applies to a job (cover letter + a small PDF) through the real API. */
export async function applyTo(job, learner, letter = "I would like to join your team.") {
  const form = new FormData();
  form.set("cover_letter", letter);
  form.set("resume", new Blob(["%PDF-1.1\n%%EOF\n"], { type: "application/pdf" }), "resume.pdf");
  return apiOk(learner, `jobs/${job.id}/apply`, { method: "POST", form });
}
export async function makeHirer(tag = "hirer") {
  return makeUser({ role: "hirer", tag });
}

/** Adds a 9-second video lesson (assets/lecture.webm) to a course through the real upload API. */
export async function addVideo(course, name = unique("Video lesson")) {
  const { readFile } = await import("node:fs/promises");
  const { paths } = await import("./config.mjs");
  const form = new FormData();
  form.set("type", "video");
  form.set("name", name);
  form.set("is_preview", "false");
  form.set("file", new Blob([await readFile(`${paths.e2e}/assets/lecture.webm`)], { type: "video/webm" }), "lecture.webm");
  const row = await apiOk("admin", `frontend/manage/courses/${course.id}/materials`, { method: "POST", form });
  return { id: row.id, name };
}

/** A brand-new administrator account, created by the seeded admin. */
export async function makeAdmin(tag = "admin") {
  const key = unique(tag).replace(/[^a-z0-9]/gi, "").toLowerCase().slice(0, 20);
  const account = { username: key, email: `${key}@e2e.test`, name: `Admin ${key.slice(-6)}`, role: "admin" };
  const made = await apiOk("admin", "frontend/admin/users", { method: "POST", body: { ...account, password: PASSWORD } });
  return { ...account, id: made.id };
}
