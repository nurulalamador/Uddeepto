/* global API_URL, PASSWORD, RUN_ID, CATEGORY_ID, INSTRUCTOR_ID, RECEIVER_USERNAME, ADMIN_USERNAME, APPLY_USERNAME, COURSE_ID, VIDEO_COURSE_ID, VIDEO_MATERIAL_ID, CONTEST_ID, COMMUNITY_ID, SCENARIO, ACTOR_ROLE, output, http */
// Runtime fixture preparation for expanded cases. Static validation never executes this file.
// Every call creates a fresh account and does not depend on another UI scenario.
if (API_URL !== "http://127.0.0.1:4400/api/v1") throw new Error("Case preparation requires the isolated local fixture server.");

function request(method, route, body, token) {
  const response = http.request(API_URL + "/" + route, {
    method: method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!response.ok) throw new Error("Fixture " + method + " " + route + " failed: " + response.status + " " + response.body);
  return response.body ? JSON.parse(response.body) : null;
}
function login(username) { return request("POST", "auth/login", { identifier: username, password: PASSWORD }).accessToken; }
const nonce = (RUN_ID + Date.now().toString(36) + Math.random().toString(36).slice(2, 7)).slice(-25);
function makeUser(role, suffix) {
  const username = "mq_" + suffix + "_" + nonce;
  const result = request("POST", "auth/register", { name: "Maestro QA " + suffix, email: username + "@e2e.test", username: username, password: PASSWORD, role: role });
  if (role === "learner") request("PUT", "frontend/profile/interests", { interest_ids: [CATEGORY_ID] }, result.accessToken);
  return { id: result.user.id, username: username, name: result.user.name, token: result.accessToken };
}
const role = typeof ACTOR_ROLE === "string" ? ACTOR_ROLE : "learner";
const actor = makeUser(role, "actor");
output.actorUsername = actor.username;
output.actorId = actor.id;
output.actorName = actor.name;
output.unique = nonce;
output.categoryId = CATEGORY_ID;
output.batchPrefix = "Maestro batch " + nonce;
output.entryName = "Maestro entry " + nonce;

if (SCENARIO === "education-existing") {
  const entry = request("POST", "frontend/profile/education", { institution: output.entryName, degree: "BSc", field_of_study: "Computing", start_date: "2020-01", end_date: "2022-01", grade: "3.8" }, actor.token);
  output.entryId = entry.id;
}
if (SCENARIO === "experience-existing") {
  const entry = request("POST", "frontend/profile/experience", { title: output.entryName, workplace: "Maestro Labs", category_id: CATEGORY_ID, start_date: "2020-01", end_date: "2022-01", description: "Existing fixture experience" }, actor.token);
  output.entryId = entry.id;
}
if (SCENARIO.indexOf("post-") === 0) {
  const author = SCENARIO === "post-own" ? actor.token : login(RECEIVER_USERNAME);
  const post = request("POST", "frontend/showcase", { category_id: CATEGORY_ID, content: "Maestro isolated post " + nonce }, author);
  output.postId = post.id;
  output.postText = "Maestro isolated post " + nonce;
  if (SCENARIO === "post-comment") {
    const comment = request("POST", "frontend/showcase/" + post.id + "/comments", { content: "Maestro isolated comment " + nonce }, author);
    output.commentId = comment.id;
  }
}
if (SCENARIO === "community-member") request("POST", "communities/" + COMMUNITY_ID + "/join", {}, actor.token);
if (SCENARIO === "course-enrolled") request("POST", "courses/" + COURSE_ID + "/enroll", {}, actor.token);
if (SCENARIO.indexOf("video-") === 0) {
  request("POST", "courses/" + VIDEO_COURSE_ID + "/enroll", {}, actor.token);
  const through = SCENARIO === "video-completed" ? 3 : SCENARIO === "video-second" ? 1 : SCENARIO === "video-final" ? 2 : 0;
  for (let step = 1; step <= through; step++) request("POST", "frontend/courses/" + VIDEO_COURSE_ID + "/materials/" + VIDEO_MATERIAL_ID + "/quiz/" + step, { answers: [0, 0, 0] }, actor.token);
}
if (SCENARIO === "contest-joined") request("POST", "frontend/contests/" + CONTEST_ID + "/join", {}, actor.token);

// Precondition CV: copy the ASCII fixture PDF through the real API, without opening a picker.
if (SCENARIO === "cv-existing" || SCENARIO === "application-saved" || SCENARIO === "application-applied") {
  const pdf = http.get(API_URL + "/frontend/cv/file", { headers: { Authorization: "Bearer " + login(APPLY_USERNAME) } });
  if (!pdf.ok) throw new Error("Saved fixture PDF could not be read.");
  const boundary = "MaestroFixtureBoundary" + nonce;
  const body = "--" + boundary + "\r\nContent-Disposition: form-data; name=\"file\"; filename=\"maestro-cv.pdf\"\r\nContent-Type: application/pdf\r\n\r\n" + pdf.body + "\r\n--" + boundary + "\r\nContent-Disposition: form-data; name=\"source\"\r\n\r\nuploaded\r\n--" + boundary + "--\r\n";
  const response = http.put(API_URL + "/frontend/cv", { headers: { Authorization: "Bearer " + actor.token, "Content-Type": "multipart/form-data; boundary=" + boundary }, body: body });
  if (!response.ok) throw new Error("CV fixture could not be saved: " + response.status);
}
function job(owner, title) {
  const made = request("POST", "jobs", { title: title, description: "Isolated Maestro role", type: "permanent", category_id: CATEGORY_ID, is_remote: true }, owner.token);
  request("PATCH", "frontend/jobs/" + made.id + "/status", { status: "open" }, owner.token);
  return made;
}
if (SCENARIO.indexOf("application-") === 0 || SCENARIO === "job-owned" || SCENARIO === "applicant-owner") {
  const owner = role === "hirer" ? actor : makeUser("hirer", "owner");
  const made = job(owner, "Maestro isolated role " + nonce);
  output.jobId = made.id;
  output.jobTitle = made.title;
  if (SCENARIO === "application-applied") request("POST", "jobs/" + made.id + "/apply", { cover_letter: "Maestro prior application", use_current_cv: "true" }, actor.token);
  if (SCENARIO === "applicant-owner") {
    request("POST", "jobs/" + made.id + "/apply", { cover_letter: "Maestro applicant cover letter", use_current_cv: "true" }, login(APPLY_USERNAME));
    output.applicantName = "Maestro APPLY";
  }
}
if (SCENARIO === "notifications") {
  const author = login(RECEIVER_USERNAME);
  const post = request("POST", "frontend/showcase", { category_id: CATEGORY_ID, content: "Maestro notification post " + nonce }, actor.token);
  request("POST", "frontend/showcase/" + post.id + "/comments", { content: "Maestro notification comment" }, author);
  request("PUT", "frontend/showcase/" + post.id + "/reaction", {}, author);
  output.postId = post.id;
}
if (SCENARIO === "pagination-posts") {
  const made = [];
  for (let index = 0; index < 20; index++) made.push(request("POST", "frontend/showcase", { category_id: CATEGORY_ID, content: output.batchPrefix + " " + index }, actor.token));
  output.pageFirstId = made[made.length - 1].id;
  output.pageLastId = made[0].id;
}
if (SCENARIO === "pagination-jobs") {
  const owner = makeUser("hirer", "owner");
  const made = [];
  for (let index = 0; index < 20; index++) made.push(job(owner, output.batchPrefix + " " + index));
  output.pageFirstId = made[made.length - 1].id;
  output.pageLastId = made[0].id;
}
if (SCENARIO === "pagination-courses") {
  const admin = login(ADMIN_USERNAME);
  const made = [];
  for (let index = 0; index < 20; index++) made.push(request("POST", "frontend/admin/courses", { title: output.batchPrefix + " " + index, slug: "mc-" + nonce + "-" + index, description: "Pagination fixture course", category_ids: [CATEGORY_ID], instructor_id: INSTRUCTOR_ID, price: 0, currency: "BDT", status: "published" }, admin));
  output.pageFirstId = made[made.length - 1].id;
  output.pageLastId = made[0].id;
}
