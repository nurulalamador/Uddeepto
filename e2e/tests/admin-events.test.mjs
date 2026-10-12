import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { By, acceptConfirm, api, apiOk, click, count, dismissConfirm, exists, find, go, hasText, isShown, setValue, sleep, texts, type, unique, useBrowser, visible, waitGone, waitText, xText } from "../lib/browser.mjs";
import { applyTo, makeCommunity, makeContest, makeHirer, makeJob, makeLearner, makeWebinar, notificationsOf, seed, slugOf } from "../lib/factory.mjs";
import { addInterest, addSpeaker, cells, choose, filter, findRow, localDateTime, modalField, openList, row, rowAction, rowCheck, saveButton, search, tabButton } from "../lib/admin.mjs";

const bulkStatus = By.css("select[aria-label='New status for selected records']");
const sortSelect = By.xpath("//label[./span[normalize-space(.)='Sort']]//select");

describe("Admin · Contests", () => {
  const b = useBrowser();
  const open = async () => {
    await openList(b.driver, "/contests");
    await waitText(b.driver, "Contests management");
  };
  const fillContest = async ({ name, interest = "Web Development", kind = "competitive_programming", fee = "0", status = "draft", start = localDateTime(1), end = localDateTime(2) }) => {
    await click(b.driver, xText("Add contest", { tag: "button" }));
    await visible(b.driver, modalField("name"));
    await type(b.driver, modalField("name"), name);
    await type(b.driver, modalField("description"), "A contest made in the admin console.");
    if (interest) await addInterest(b.driver, interest);
    await choose(b.driver, "type", kind);
    await type(b.driver, modalField("entry_fee"), fee);
    await choose(b.driver, "status", status);
    await setValue(b.driver, modalField("starting_time"), start);
    await setValue(b.driver, modalField("ending_time"), end);
  };

  it("lists contests with host, interest, type, fee, participants, dates and status", async () => {
    const contest = await makeContest({ name: unique("Listed contest") });
    await open();
    assert.deepEqual(await texts(b.driver, By.css(".admin-table thead th")), ["", "NAME", "OWNER / HOST", "INTERESTS", "TYPE", "ENTRY FEE", "PARTICIPANTS", "STARTS", "ENDS", "STATUS", "ACTIONS"]);
    await findRow(b.driver, contest.name);
    const text = await (await find(b.driver, row(contest.name))).getText();
    assert.match(text, /Ada Admin/);
    assert.match(text, /Web Development/);
    assert.match(text.toLowerCase(), /published/);
  });

  it("the status filter has Draft, Published, Cancelled and Completed", async () => {
    await open();
    assert.deepEqual(await texts(b.driver, By.xpath("//label[./span[normalize-space(.)='Status']]//option")), ["All statuses", "Draft", "Published", "Cancelled", "Completed"]);
  });

  it("filtering by Completed shows completed contests only", async () => {
    const contest = await makeContest({ name: unique("Done contest"), phase: "past", status: "completed" });
    await open();
    await setValue(b.driver, filter("Status"), "completed");
    await visible(b.driver, row(contest.name));
    await b.driver.wait(async () => (await cells(b.driver, 10)).every((t) => /completed/i.test(t)), 8000);
  });

  it("sorting by 'Start date' is available", async () => {
    await open();
    assert.deepEqual(await texts(b.driver, By.xpath("//label[./span[normalize-space(.)='Sort']]//option")), ["Newest first", "Name A to Z", "Start date"]);
  });

  it("the form has name, description, interests, type, fee, currency, status, capacity and times", async () => {
    await open();
    await click(b.driver, xText("Add contest", { tag: "button" }));
    for (const name of ["name", "description", "type", "entry_fee", "currency", "status", "max_participants", "starting_time", "ending_time"]) await find(b.driver, modalField(name));
    assert.deepEqual(await texts(b.driver, By.css(".modal select[name=type] option")), ["General", "Competitive programming", "Drawing", "Singing"]);
  });

  it("an admin can create a draft contest that learners cannot see", async () => {
    const name = unique("Drafted contest");
    await open();
    await fillContest({ name });
    await click(b.driver, saveButton("Create record"));
    await waitText(b.driver, "Contest saved.");
    await findRow(b.driver, name);
    assert.match((await (await find(b.driver, row(name))).getText()).toLowerCase(), /draft/);
    const list = await apiOk("learner", `frontend/catalog/contests?q=${encodeURIComponent(name)}`);
    assert.ok(!JSON.stringify(list).includes(name));
  });

  it("an interest is required", async () => {
    await open();
    await fillContest({ name: unique("No interest contest"), interest: "" });
    await click(b.driver, saveButton("Create record"));
    await waitText(b.driver, "Select at least one interest.");
  });

  it("the contest cannot end before it starts", async () => {
    await open();
    await fillContest({ name: unique("Backwards contest"), start: localDateTime(3), end: localDateTime(2) });
    await click(b.driver, saveButton("Create record"));
    await b.driver.wait(async () => exists(b.driver, By.css(".modal [role=alert]")), 8000);
  });

  it("a draft contest gets 'Publish contest' that publishes it and announces it", async () => {
    const learner = await makeLearner("contestheard", "web");
    const contest = await makeContest({ name: unique("Awaiting review"), status: "draft", phase: "upcoming" });
    await open();
    await findRow(b.driver, contest.name);
    await click(b.driver, xText("Publish contest", { tag: "button" }));
    await waitText(b.driver, "Contest approved.");
    await b.driver.wait(async () => (await notificationsOf(learner)).some((n) => n.title === `New contest: ${contest.name}`), 10000);
  });

  it("an admin can edit a contest's name and fee", async () => {
    const contest = await makeContest({ name: unique("Editable contest") });
    const renamed = unique("Edited contest");
    await open();
    await findRow(b.driver, contest.name);
    await click(b.driver, rowAction(contest.name, "Edit contest"));
    await waitText(b.driver, "Edit contest");
    await type(b.driver, modalField("name"), renamed);
    await type(b.driver, modalField("entry_fee"), "50");
    await click(b.driver, saveButton("Save changes"));
    await waitText(b.driver, "Contest saved.");
    await findRow(b.driver, renamed);
    assert.match(await (await find(b.driver, row(renamed))).getText(), /BDT 50/);
  });

  it("cancelling a contest tells everyone who joined", async () => {
    const contest = await makeContest({ name: unique("Called off"), phase: "upcoming" });
    const learner = await makeLearner("calledoff");
    await apiOk(learner, `frontend/contests/${contest.id}/join`, { method: "POST" });
    await open();
    await findRow(b.driver, contest.name);
    await click(b.driver, rowAction(contest.name, "Edit contest"));
    await choose(b.driver, "status", "cancelled");
    await click(b.driver, saveButton("Save changes"));
    await waitText(b.driver, "Contest saved.");
    await b.driver.wait(async () => (await notificationsOf(learner)).some((n) => n.title === `${contest.name} was cancelled`), 10000);
  });

  it("completing a contest announces the results: the winner is told they won", async () => {
    const contest = await makeContest({ name: unique("Finished contest"), phase: "live", problems: [{ name: "Task", points: 100 }] });
    const [winner, other] = [await makeLearner("winner"), await makeLearner("runnerup")];
    for (const person of [winner, other]) {
      await apiOk(person, `frontend/contests/${contest.id}/join`, { method: "POST" });
      await apiOk(person, `frontend/contests/${contest.id}/submit`, { method: "POST", body: { problem_id: contest.problems[0].id, content: "answer", language: "Python" } });
    }
    const subs = await apiOk("admin", `frontend/manage/contests/${contest.id}/submissions`);
    for (const sub of subs) await apiOk("admin", `frontend/manage/submissions/${sub.id}`, { method: "PATCH", body: { score: sub.name.includes(winner.name) ? 95 : 40, status: "accepted" } });
    await open();
    await findRow(b.driver, contest.name);
    await click(b.driver, rowAction(contest.name, "Edit contest"));
    await choose(b.driver, "status", "completed");
    await click(b.driver, saveButton("Save changes"));
    await waitText(b.driver, "Contest saved.");
    await b.driver.wait(async () => (await notificationsOf(winner)).some((n) => n.title === `You won ${contest.name}!`), 10000);
    await b.driver.wait(async () => (await notificationsOf(other)).some((n) => n.type === "contest_result" && n.title.includes("#2")), 10000);
  });

  it("an admin can delete a contest after confirming", async () => {
    const contest = await makeContest({ name: unique("Doomed contest") });
    await open();
    await findRow(b.driver, contest.name);
    const message = await acceptConfirm(b.driver, () => click(b.driver, rowAction(contest.name, "Delete contest")));
    assert.match(message, /Delete this contest\?/);
    await waitText(b.driver, "Contest deleted.");
  });

  it("two contests can be cancelled together from the bulk bar", async () => {
    const [one, two] = [await makeContest({ name: unique("Bulk contest"), phase: "upcoming" }), await makeContest({ name: unique("Bulk contest"), phase: "upcoming" })];
    await open();
    await findRow(b.driver, "Bulk contest");
    await click(b.driver, rowCheck(one.name));
    await click(b.driver, rowCheck(two.name));
    await setValue(b.driver, bulkStatus, "cancelled");
    await click(b.driver, xText("Apply status", { tag: "button" }));
    await waitText(b.driver, "2 record(s) updated.");
  });

  it("a learner cannot change contests through the API", async () => {
    const contest = await makeContest({ name: unique("Guarded contest") });
    assert.equal((await api("learner", `frontend/admin/contests/${contest.id}`, { method: "PATCH", body: { status: "cancelled" } })).status, 403);
  });
});

describe("Admin · Contest problems and judging", () => {
  const b = useBrowser();
  async function openContest(name) {
    await openList(b.driver, "/contests");
    await findRow(b.driver, name);
    await click(b.driver, rowAction(name, "Edit contest"));
    await waitText(b.driver, "Contest problems & judging");
  }
  const field = (name) => By.css(`.modal form [name=${name}]`);

  it("a contest with no submissions says so", async () => {
    const contest = await makeContest({ name: unique("Quiet contest") });
    await openContest(contest.name);
    await waitText(b.driver, "No submissions yet");
  });

  it("an admin can add a problem and it is listed", async () => {
    const contest = await makeContest({ name: unique("Problem contest") });
    await openContest(contest.name);
    await type(b.driver, By.xpath("//form[.//h3[normalize-space(.)='Add a problem']]//input[@name='name']"), "Two Sum");
    await type(b.driver, By.xpath("//form[.//h3[normalize-space(.)='Add a problem']]//textarea[@name='description']"), "Find two numbers that add to the target.");
    await click(b.driver, xText("Add problem", { tag: "button" }));
    await visible(b.driver, By.xpath("//details[contains(@class,'card')]/summary[normalize-space(.)='Two Sum']"));
  });

  it("points default to 100 and cannot be negative", async () => {
    const contest = await makeContest({ name: unique("Points contest") });
    await openContest(contest.name);
    const points = By.css(".modal form input[name=points]");
    assert.equal(await (await find(b.driver, points)).getAttribute("value"), "100");
    await type(b.driver, points, "-5");
    await type(b.driver, By.xpath("//form[.//h3[normalize-space(.)='Add a problem']]//input[@name='name']"), "Negative");
    await type(b.driver, By.xpath("//form[.//h3[normalize-space(.)='Add a problem']]//textarea[@name='description']"), "x");
    await click(b.driver, xText("Add problem", { tag: "button" }));
    assert.equal(await b.driver.executeScript("return document.querySelector('.modal form input[name=points]').validity.rangeUnderflow"), true);
  });

  it("an entered solution appears under Submissions", async () => {
    const contest = await makeContest({ name: unique("Entry contest"), problems: [{ name: "Task A" }] });
    const learner = await makeLearner("entrant");
    await apiOk(learner, `frontend/contests/${contest.id}/join`, { method: "POST" });
    await apiOk(learner, `frontend/contests/${contest.id}/submit`, { method: "POST", body: { problem_id: contest.problems[0].id, content: "print('hi')", language: "Python" } });
    await openContest(contest.name);
    await waitText(b.driver, "print('hi')");
    await visible(b.driver, By.xpath("//article[contains(@class,'card')]//select"));
  });

  it("scoring a submission and saving the judgment tells the participant", async () => {
    const contest = await makeContest({ name: unique("Judging contest"), problems: [{ name: "Task B" }] });
    const learner = await makeLearner("judgedui");
    await apiOk(learner, `frontend/contests/${contest.id}/join`, { method: "POST" });
    await apiOk(learner, `frontend/contests/${contest.id}/submit`, { method: "POST", body: { problem_id: contest.problems[0].id, content: "solution", language: "Python" } });
    await openContest(contest.name);
    const card = "//article[contains(@class,'card')][.//pre]";
    await setValue(b.driver, By.xpath(`${card}//select`), "accepted");
    await type(b.driver, By.xpath(`${card}//input[@type='number']`), "77");
    await click(b.driver, xText("Save judgment", { tag: "button" }));
    await b.driver.wait(async () => (await notificationsOf(learner)).some((n) => n.title === `Your submission in ${contest.name} was accepted`), 10000);
    const [saved] = await apiOk("admin", `frontend/manage/contests/${contest.id}/submissions`);
    assert.equal(Number(saved.score), 77);
  });

  it("a submission can be rejected", async () => {
    const contest = await makeContest({ name: unique("Reject contest"), problems: [{ name: "Task C" }] });
    const learner = await makeLearner("rejectedui");
    await apiOk(learner, `frontend/contests/${contest.id}/join`, { method: "POST" });
    await apiOk(learner, `frontend/contests/${contest.id}/submit`, { method: "POST", body: { problem_id: contest.problems[0].id, content: "wrong", language: "Python" } });
    await openContest(contest.name);
    await setValue(b.driver, By.xpath("//article[contains(@class,'card')][.//pre]//select"), "rejected");
    await click(b.driver, xText("Save judgment", { tag: "button" }));
    await b.driver.wait(async () => (await notificationsOf(learner)).some((n) => n.title === `Your submission in ${contest.name} was not accepted`), 10000);
  });

  it("the status choices are judging, accepted, rejected and disqualified", async () => {
    const contest = await makeContest({ name: unique("Choices contest"), problems: [{ name: "Task D" }] });
    const learner = await makeLearner("choices");
    await apiOk(learner, `frontend/contests/${contest.id}/join`, { method: "POST" });
    await apiOk(learner, `frontend/contests/${contest.id}/submit`, { method: "POST", body: { problem_id: contest.problems[0].id, content: "x", language: "Python" } });
    await openContest(contest.name);
    assert.deepEqual(await texts(b.driver, By.xpath("//article[contains(@class,'card')][.//pre]//select/option")), ["judging", "accepted", "rejected", "disqualified"]);
  });

  it("a learner cannot judge", async () => {
    const refused = await api("learner", "frontend/manage/submissions/00000000-0000-4000-8000-000000000000", { method: "PATCH", body: { score: 1, status: "accepted" } });
    assert.equal(refused.status, 403);
  });
});

describe("Admin · Webinars", () => {
  const b = useBrowser();
  const open = async () => {
    await openList(b.driver, "/webinars");
    await waitText(b.driver, "Webinars management");
  };

  it("lists webinars with speakers, interest, participants, capacity, times and status", async () => {
    const webinar = await makeWebinar({ name: unique("Listed webinar") });
    await open();
    assert.deepEqual(await texts(b.driver, By.css(".admin-table thead th")), ["", "NAME", "SPEAKERS", "INTERESTS", "PARTICIPANTS", "CAPACITY", "STARTS", "ENDS", "STATUS", "ACTIONS"]);
    await findRow(b.driver, webinar.name);
    const text = await (await find(b.driver, row(webinar.name))).getText();
    assert.match(text, /Dr\. Iris Instructor/);
    assert.match(text.toLowerCase(), /scheduled/);
  });

  it("the status filter has Draft, Scheduled, Live, Completed and Cancelled", async () => {
    await open();
    assert.deepEqual(await texts(b.driver, By.xpath("//label[./span[normalize-space(.)='Status']]//option")), ["All statuses", "Draft", "Scheduled", "Live", "Completed", "Cancelled"]);
  });

  it("a webinar without a capacity shows 'Unlimited'", async () => {
    const webinar = await makeWebinar({ name: unique("Open seats webinar"), capacity: null });
    await open();
    await findRow(b.driver, webinar.name);
    assert.match(await (await find(b.driver, row(webinar.name))).getText(), /Unlimited/);
  });

  it("the form has name, description, interests, speakers, links, capacity, status and times", async () => {
    await open();
    await click(b.driver, xText("Add webinar", { tag: "button" }));
    for (const name of ["name", "description", "meeting_url", "recording_url", "capacity", "status", "starting_time", "ending_time"]) await find(b.driver, modalField(name));
    await visible(b.driver, By.css("#webinar-speaker-search"));
  });

  it("an admin can create a webinar with a speaker", async () => {
    const name = unique("Brand new webinar");
    await open();
    await click(b.driver, xText("Add webinar", { tag: "button" }));
    await type(b.driver, modalField("name"), name);
    await type(b.driver, modalField("description"), "An online session.");
    await addInterest(b.driver, "Web Development");
    await addSpeaker(b.driver, "Dr. Iris Instructor");
    await visible(b.driver, By.xpath("//span[contains(@class,'speaker-chip')][.//strong[normalize-space(.)='Dr. Iris Instructor']]"));
    await type(b.driver, modalField("meeting_url"), "https://meet.example.com/new");
    await type(b.driver, modalField("capacity"), "30");
    await setValue(b.driver, modalField("starting_time"), localDateTime(2));
    await setValue(b.driver, modalField("ending_time"), localDateTime(2, 1));
    await click(b.driver, saveButton("Create record"));
    await waitText(b.driver, "Webinar saved.");
    await findRow(b.driver, name);
  });

  it("at least one speaker is required", async () => {
    await open();
    await click(b.driver, xText("Add webinar", { tag: "button" }));
    await type(b.driver, modalField("name"), unique("Speakerless"));
    await type(b.driver, modalField("description"), "No speakers.");
    await addInterest(b.driver, "Music");
    await setValue(b.driver, modalField("starting_time"), localDateTime(2));
    await setValue(b.driver, modalField("ending_time"), localDateTime(2, 1));
    await click(b.driver, saveButton("Create record"));
    await waitText(b.driver, "Add at least one speaker.");
  });

  it("a speaker can be removed again", async () => {
    await open();
    await click(b.driver, xText("Add webinar", { tag: "button" }));
    await addSpeaker(b.driver, "Dr. Iris Instructor");
    await click(b.driver, By.css("button[aria-label='Remove Dr. Iris Instructor']"));
    await waitText(b.driver, "No speakers yet.");
  });

  it("a draft webinar gets 'Approve & schedule' that announces it", async () => {
    const learner = await makeLearner("webinarheard", "web");
    const webinar = await makeWebinar({ name: unique("Draft webinar"), status: "draft" });
    await open();
    await findRow(b.driver, webinar.name);
    await click(b.driver, xText("Approve & schedule", { tag: "button" }));
    await waitText(b.driver, "Webinar approved.");
    await b.driver.wait(async () => (await notificationsOf(learner)).some((n) => n.title === `New webinar: ${webinar.name}`), 10000);
  });

  it("an admin can edit a webinar and add the recording after it ends", async () => {
    const webinar = await makeWebinar({ name: unique("Recorded webinar"), when: "past", status: "completed" });
    await open();
    await findRow(b.driver, webinar.name);
    await click(b.driver, rowAction(webinar.name, "Edit webinar"));
    await waitText(b.driver, "Edit webinar");
    await type(b.driver, modalField("recording_url"), "https://example.com/rec/abc");
    await click(b.driver, saveButton("Save changes"));
    await waitText(b.driver, "Webinar saved.");
  });

  it("cancelling a webinar tells everyone who registered", async () => {
    const webinar = await makeWebinar({ name: unique("Cancelled webinar") });
    const learner = await makeLearner("registered");
    await apiOk(learner, `frontend/webinars/${webinar.id}/join`, { method: "POST" });
    await open();
    await findRow(b.driver, webinar.name);
    await click(b.driver, rowAction(webinar.name, "Edit webinar"));
    await choose(b.driver, "status", "cancelled");
    await click(b.driver, saveButton("Save changes"));
    await waitText(b.driver, "Webinar saved.");
    await b.driver.wait(async () => (await notificationsOf(learner)).some((n) => n.title === `${webinar.name} was cancelled`), 10000);
  });

  it("an admin can delete a webinar after confirming", async () => {
    const webinar = await makeWebinar({ name: unique("Doomed webinar") });
    await open();
    await findRow(b.driver, webinar.name);
    await acceptConfirm(b.driver, () => click(b.driver, rowAction(webinar.name, "Delete webinar")));
    await waitText(b.driver, "Webinar deleted.");
  });

  it("selected webinars can be deleted together", async () => {
    const [one, two] = [await makeWebinar({ name: unique("Bulk webinar") }), await makeWebinar({ name: unique("Bulk webinar") })];
    await open();
    await findRow(b.driver, "Bulk webinar");
    await click(b.driver, rowCheck(one.name));
    await click(b.driver, rowCheck(two.name));
    await acceptConfirm(b.driver, () => click(b.driver, xText("Delete selected", { tag: "button" })));
    await waitText(b.driver, "2 record(s) deleted.");
  });

  it("a learner cannot change webinars through the API", async () => {
    const webinar = await makeWebinar({ name: unique("Guarded webinar") });
    assert.equal((await api("learner", `frontend/admin/webinars/${webinar.id}`, { method: "PATCH", body: { status: "cancelled" } })).status, 403);
  });
});

describe("Admin · Jobs", () => {
  const b = useBrowser();
  const open = async () => {
    await openList(b.driver, "/jobs");
    await waitText(b.driver, "Jobs management");
  };

  it("lists jobs with owner, interest, type, location, salary, applications, deadline and status", async () => {
    const hirer = await makeHirer("jobowner");
    const job = await makeJob({ owner: hirer, title: unique("Listed job") });
    await open();
    assert.deepEqual(await texts(b.driver, By.css(".admin-table thead th")), ["", "TITLE", "OWNER / HOST", "INTERESTS", "TYPE", "LOCATION", "SALARY RANGE", "APPLICATIONS", "DEADLINE", "STATUS", "ACTIONS"]);
    await findRow(b.driver, job.title);
    const text = await (await find(b.driver, row(job.title))).getText();
    assert.match(text, new RegExp(hirer.name));
    assert.match(text, /Dhaka/);
    assert.match(text, /BDT 40,000-60,000/);
    assert.match(text.toLowerCase(), /open/);
  });

  it("the status filter has Draft, Open, Closed, Filled and Cancelled", async () => {
    await open();
    assert.deepEqual(await texts(b.driver, By.xpath("//label[./span[normalize-space(.)='Status']]//option")), ["All statuses", "Draft", "Open", "Closed", "Filled", "Cancelled"]);
  });

  it("a hirer's new job waits as a draft and the admin approves it", async () => {
    const learner = await makeLearner("jobheard", "web");
    const hirer = await makeHirer("jobreview");
    const job = await makeJob({ owner: hirer, title: unique("Needs approval"), open: false });
    await open();
    await findRow(b.driver, job.title);
    assert.match((await (await find(b.driver, row(job.title))).getText()).toLowerCase(), /draft/);
    await click(b.driver, xText("Approve & open", { tag: "button" }));
    await waitText(b.driver, "Job approved.");
    await b.driver.wait(async () => /open/i.test(await (await find(b.driver, row(job.title))).getText()), 8000);
    await b.driver.wait(async () => (await notificationsOf(learner)).some((n) => n.title === `New job: ${job.title}`), 10000);
  });

  it("the form has title, description, interests, type, status, location, criteria, salary and deadline", async () => {
    await open();
    await click(b.driver, xText("Add job", { tag: "button" }));
    for (const name of ["title", "description", "type", "status", "location", "criteria", "salary_min", "salary_max", "currency", "salary_period", "application_deadline", "is_remote"]) await find(b.driver, modalField(name));
    assert.deepEqual(await texts(b.driver, By.css(".modal select[name=type] option")), ["Permanent", "Contract", "Internship", "Part time", "Freelance", "One time"]);
  });

  it("an admin can post a job of their own", async () => {
    const title = unique("Admin posted job");
    await open();
    await click(b.driver, xText("Add job", { tag: "button" }));
    await type(b.driver, modalField("title"), title);
    await type(b.driver, modalField("description"), "Posted straight from the console.");
    await addInterest(b.driver, "Data Science");
    await type(b.driver, modalField("location"), "Chattogram");
    await type(b.driver, modalField("salary_min"), "30000");
    await type(b.driver, modalField("salary_max"), "45000");
    await choose(b.driver, "status", "open");
    await click(b.driver, saveButton("Create record"));
    await waitText(b.driver, "Job saved.");
    await findRow(b.driver, title);
    assert.match(await (await find(b.driver, row(title))).getText(), /Chattogram/);
  });

  it("the title and description are required", async () => {
    await open();
    await click(b.driver, xText("Add job", { tag: "button" }));
    await click(b.driver, saveButton("Create record"));
    assert.equal(await b.driver.executeScript("return document.querySelector('.modal input[name=title]').validity.valueMissing"), true);
  });

  it("an admin can edit a job's salary", async () => {
    const hirer = await makeHirer("jobedit");
    const job = await makeJob({ owner: hirer, title: unique("Raise job") });
    await open();
    await findRow(b.driver, job.title);
    await click(b.driver, rowAction(job.title, "Edit job"));
    await waitText(b.driver, "Edit job");
    await type(b.driver, modalField("salary_max"), "90000");
    await click(b.driver, saveButton("Save changes"));
    await waitText(b.driver, "Job saved.");
    await b.driver.wait(async () => /90,000/.test(await (await find(b.driver, row(job.title))).getText()), 8000);
  });

  it("closing a job tells the people whose applications were still pending", async () => {
    const hirer = await makeHirer("jobcloser");
    const job = await makeJob({ owner: hirer, title: unique("Closing job") });
    const applicant = await makeLearner("pending");
    await applyTo(job, applicant);
    await open();
    await findRow(b.driver, job.title);
    await click(b.driver, rowAction(job.title, "Edit job"));
    await choose(b.driver, "status", "closed");
    await click(b.driver, saveButton("Save changes"));
    await waitText(b.driver, "Job saved.");
    await b.driver.wait(async () => (await notificationsOf(applicant)).some((n) => n.title === `“${job.title}” is no longer open`), 10000);
  });

  it("marking a job as filled says it has been filled", async () => {
    const hirer = await makeHirer("jobfiller");
    const job = await makeJob({ owner: hirer, title: unique("Filled job") });
    const applicant = await makeLearner("hopeful");
    await applyTo(job, applicant);
    await open();
    await findRow(b.driver, job.title);
    await click(b.driver, rowAction(job.title, "Edit job"));
    await choose(b.driver, "status", "filled");
    await click(b.driver, saveButton("Save changes"));
    await waitText(b.driver, "Job saved.");
    await b.driver.wait(async () => (await notificationsOf(applicant)).some((n) => n.title === `“${job.title}” has been filled`), 10000);
  });

  it("the applications column counts applicants", async () => {
    const hirer = await makeHirer("jobcount");
    const job = await makeJob({ owner: hirer, title: unique("Counted job") });
    await applyTo(job, await makeLearner("c1"));
    await applyTo(job, await makeLearner("c2"));
    await open();
    await findRow(b.driver, job.title);
    assert.equal((await cells(b.driver, 8))[0], "2");
  });

  it("an admin can delete a job after confirming", async () => {
    const hirer = await makeHirer("jobdel");
    const job = await makeJob({ owner: hirer, title: unique("Doomed job") });
    await open();
    await findRow(b.driver, job.title);
    await acceptConfirm(b.driver, () => click(b.driver, rowAction(job.title, "Delete job")));
    await waitText(b.driver, "Job deleted.");
  });

  it("jobs can be closed in bulk", async () => {
    const hirer = await makeHirer("jobbulk");
    const [one, two] = [await makeJob({ owner: hirer, title: unique("Bulk job") }), await makeJob({ owner: hirer, title: unique("Bulk job") })];
    await open();
    await findRow(b.driver, "Bulk job");
    await click(b.driver, rowCheck(one.title));
    await click(b.driver, rowCheck(two.title));
    await setValue(b.driver, bulkStatus, "closed");
    await click(b.driver, xText("Apply status", { tag: "button" }));
    await waitText(b.driver, "2 record(s) updated.");
  });

  it("a hirer cannot use the admin API to open their own draft", async () => {
    const hirer = await makeHirer("sneakyjob");
    const job = await makeJob({ owner: hirer, title: unique("Sneaky job"), open: false });
    assert.equal((await api(hirer, `frontend/admin/jobs/${job.id}`, { method: "PATCH", body: { status: "open" } })).status, 403);
  });
});

describe("Admin · Communities", () => {
  const b = useBrowser();
  const open = async () => {
    await openList(b.driver, "/admin?tab=communities");
    await click(b.driver, tabButton("Communities"));
    await waitText(b.driver, "Communities management");
  };

  it("lists communities with owner, interest, members and access settings", async () => {
    const community = await makeCommunity({ name: unique("Listed community") });
    await open();
    assert.deepEqual(await texts(b.driver, By.css(".admin-table thead th")), ["", "NAME", "OWNER / HOST", "INTERESTS", "MEMBERS", "JOIN APPROVAL", "PRIVATE", "CREATED", "ACTIONS"]);
    await findRow(b.driver, community.name);
    assert.match(await (await find(b.driver, row(community.name))).getText(), /Liam Learner/);
  });

  it("search finds a community by name", async () => {
    await open();
    await findRow(b.driver, "Open Builders");
  });

  it("the form has name, slug, description, interests, join approval and private", async () => {
    await open();
    await click(b.driver, xText("Add community", { tag: "button" }));
    for (const name of ["name", "slug", "description", "requires_approval", "is_private"]) await find(b.driver, modalField(name));
  });

  it("an admin can create a community that learners can find", async () => {
    const name = unique("Console community");
    await open();
    await click(b.driver, xText("Add community", { tag: "button" }));
    await type(b.driver, modalField("name"), name);
    await type(b.driver, modalField("slug"), slugOf(name));
    await type(b.driver, modalField("description"), "Created in the admin console.");
    await addInterest(b.driver, "Web Development");
    await click(b.driver, saveButton("Create record"));
    await waitText(b.driver, "Community saved.");
    await findRow(b.driver, name);
    const found = await apiOk("learner", `frontend/catalog/communities?q=${encodeURIComponent(name)}`);
    assert.ok(JSON.stringify(found).includes(name));
  });

  it("an admin can rename a community and make it private", async () => {
    const community = await makeCommunity({ name: unique("Renameable community") });
    const renamed = unique("Renamed community");
    await open();
    await findRow(b.driver, community.name);
    await click(b.driver, rowAction(community.name, "Edit community"));
    await waitText(b.driver, "Edit community");
    await type(b.driver, modalField("name"), renamed);
    await choose(b.driver, "is_private", "true");
    await click(b.driver, saveButton("Save changes"));
    await waitText(b.driver, "Community saved.");
    await findRow(b.driver, renamed);
  });

  it("an admin can delete a community after confirming", async () => {
    const community = await makeCommunity({ name: unique("Doomed community") });
    await open();
    await findRow(b.driver, community.name);
    await acceptConfirm(b.driver, () => click(b.driver, rowAction(community.name, "Delete community")));
    await waitText(b.driver, "Community deleted.");
  });

  it("communities can be deleted in bulk", async () => {
    const [one, two] = [await makeCommunity({ name: unique("Bulk community") }), await makeCommunity({ name: unique("Bulk community") })];
    await open();
    await findRow(b.driver, "Bulk community");
    await click(b.driver, rowCheck(one.name));
    await click(b.driver, rowCheck(two.name));
    await acceptConfirm(b.driver, () => click(b.driver, xText("Delete selected", { tag: "button" })));
    await waitText(b.driver, "2 record(s) deleted.");
  });
});
