import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { By, api, apiOk, chooseOption, click, clickButton, count, dropdownValue, exists, find, go, hasText, isShown, q, signIn, sleep, texts, type, unique, upload, useBrowser, visible, waitGone, waitText, waitTextCI, waitUrl, xText } from "../lib/browser.mjs";
import { fixture } from "../lib/fixtures.mjs";
import { makeJob, makeLearner, notificationsOf } from "../lib/factory.mjs";

const jobCard = (title) => `//article[contains(@class,'job-card')][.//h2[normalize-space(.)=${q(title)}]]`;
const searchBox = By.css("input[aria-label='Search jobs or places…']");
const titles = (driver) => texts(driver, By.css("article.job-card h2"));
async function findJob(driver, who, title) {
  await signIn(driver, who);
  await go(driver, "/jobs");
  await waitText(driver, "Explore Jobs");
  await type(driver, searchBox, title);
  await visible(driver, By.xpath(jobCard(title)));
}
async function openJob(driver, who, job) {
  await signIn(driver, who);
  await go(driver, `/jobs/${job.id}`);
  await waitText(driver, job.title);
}

describe("Learner · Browsing jobs", () => {
  const b = useBrowser();

  it("the page has 'Explore jobs' and 'My applications' tabs and the card/map switch", async () => {
    await signIn(b.driver, "learner");
    await go(b.driver, "/jobs");
    assert.deepEqual(await texts(b.driver, By.css(".courses-sticky .tabs button")), ["Explore Jobs", "My Applications"]);
    assert.ok(await isShown(b.driver, By.css("[aria-label='Job view']")));
  });

  it("a job card shows its title, company, place, type and salary", async () => {
    const job = await makeJob({ title: unique("Card job"), location: "Sylhet", type: "contract", min: 30000, max: 45000 });
    await findJob(b.driver, "learner", job.title);
    const text = await (await find(b.driver, By.xpath(jobCard(job.title)))).getText();
    assert.match(text, /Hana Hirer/);
    assert.match(text, /Sylhet/);
    assert.match(text, /contract/i);
    assert.match(text, /BDT 30,000\.00 - BDT 45,000\.00/);
    assert.ok(await isShown(b.driver, By.xpath(jobCard(job.title) + "//a[contains(normalize-space(.),'View opportunity')]")));
  });

  it("the salary is shown in the accent colour", async () => {
    const job = await makeJob({ title: unique("Orange pay") });
    await findJob(b.driver, "learner", job.title);
    const colour = await (await find(b.driver, By.xpath(jobCard(job.title) + "//strong[contains(@class,'job-salary')]"))).getCssValue("color");
    assert.equal(colour, "rgba(231, 123, 56, 1)");
  });

  it("a remote job says Remote instead of a place", async () => {
    const job = await makeJob({ title: unique("Remote job"), remote: true, location: "Anywhere" });
    await findJob(b.driver, "learner", job.title);
    assert.match(await (await find(b.driver, By.xpath(jobCard(job.title)))).getText(), /Remote/);
  });

  it("closed and unpublished jobs are not listed", async () => {
    const closed = await makeJob({ title: unique("Closed job") });
    await apiOk("hirer", `frontend/jobs/${closed.id}/status`, { method: "PATCH", body: { status: "closed" } });
    const draft = await makeJob({ title: unique("Unpublished job"), open: false });
    await signIn(b.driver, "learner");
    await go(b.driver, "/jobs");
    await waitText(b.driver, "Explore Jobs");
    for (const job of [closed, draft]) {
      await type(b.driver, searchBox, job.title);
      await waitText(b.driver, "No matching opportunities");
    }
  });

  it("searching finds jobs by title or by place", async () => {
    const tag = unique("Place").replace(/ /g, "");
    const job = await makeJob({ title: unique("Findable"), location: tag });
    await signIn(b.driver, "learner");
    await go(b.driver, "/jobs");
    await type(b.driver, searchBox, tag);
    await visible(b.driver, By.xpath(jobCard(job.title)));
    await type(b.driver, searchBox, job.title);
    await visible(b.driver, By.xpath(jobCard(job.title)));
  });

  it("a search nobody matches says so", async () => {
    await signIn(b.driver, "learner");
    await go(b.driver, "/jobs");
    await type(b.driver, searchBox, "zzzz-no-such-job-zzzz");
    await waitText(b.driver, "No matching opportunities");
  });

  it("the job type filter keeps only that type", async () => {
    const tag = unique("Typed").replace(/ /g, "");
    const intern = await makeJob({ title: `${tag} intern`, type: "internship" });
    const perm = await makeJob({ title: `${tag} permanent`, type: "permanent" });
    await signIn(b.driver, "learner");
    await go(b.driver, "/jobs");
    await type(b.driver, searchBox, tag);
    await visible(b.driver, By.xpath(jobCard(perm.title)));
    await chooseOption(b.driver, "Filter by job type", "Internship");
    await visible(b.driver, By.xpath(jobCard(intern.title)));
    await b.driver.wait(async () => !(await titles(b.driver)).includes(perm.title), 8000);
  });

  it("the category filter keeps only that interest", async () => {
    const tag = unique("Cat").replace(/ /g, "");
    const data = await makeJob({ title: `${tag} data`, category: "data" });
    const web = await makeJob({ title: `${tag} web`, category: "web" });
    await signIn(b.driver, "learner");
    await go(b.driver, "/jobs");
    await type(b.driver, searchBox, tag);
    await visible(b.driver, By.xpath(jobCard(web.title)));
    await chooseOption(b.driver, "Filter by category", "Data Science");
    await visible(b.driver, By.xpath(jobCard(data.title)));
    await b.driver.wait(async () => !(await titles(b.driver)).includes(web.title), 8000);
  });

  it("jobs can be sorted by salary in either direction", async () => {
    const tag = unique("Pay").replace(/ /g, "");
    const low = await makeJob({ title: `${tag} low`, min: 10000, max: 12000 });
    const high = await makeJob({ title: `${tag} high`, min: 90000, max: 99000 });
    await signIn(b.driver, "learner");
    await go(b.driver, "/jobs");
    await type(b.driver, searchBox, tag);
    await visible(b.driver, By.xpath(jobCard(high.title)));
    await chooseOption(b.driver, "Sort jobs", "Salary");
    await b.driver.wait(async () => JSON.stringify(await titles(b.driver)) === JSON.stringify([high.title, low.title]), 8000, `got ${await titles(b.driver)}`);
    await click(b.driver, By.css("button.sort-direction"));
    await b.driver.wait(async () => JSON.stringify(await titles(b.driver)) === JSON.stringify([low.title, high.title]), 8000, `got ${await titles(b.driver)}`);
  });

  it("the map view replaces the list with a map, and cards bring the list back", async () => {
    await signIn(b.driver, "learner");
    await go(b.driver, "/jobs");
    await waitText(b.driver, "Explore Jobs");
    await click(b.driver, By.xpath("//div[@aria-label='Job view']//button[contains(normalize-space(.),'Map')]"));
    await visible(b.driver, By.css(".leaflet-container"));
    assert.ok(await isShown(b.driver, By.css("button[aria-label='Use my location']")));
    assert.equal(await isShown(b.driver, By.css("article.job-card")), false, "no list in map view");
    await click(b.driver, By.xpath("//div[@aria-label='Job view']//button[contains(normalize-space(.),'Cards')]"));
    await visible(b.driver, By.css("article.job-card"));
  });

  it("'View opportunity' opens the job page", async () => {
    const job = await makeJob({ title: unique("Open job") });
    await findJob(b.driver, "learner", job.title);
    await click(b.driver, By.xpath(jobCard(job.title) + "//a[contains(normalize-space(.),'View opportunity')]"));
    await waitUrl(b.driver, `/jobs/${job.id}`);
    await waitText(b.driver, "About the role");
  });
});

describe("Learner · Applying for a job", () => {
  const b = useBrowser();
  const apply = async (letter) => {
    await type(b.driver, By.css("textarea[name=cover_letter]"), letter);
    await upload(b.driver, By.css(".dropzone input[type=file]"), fixture("resume.pdf"));
    await click(b.driver, xText("Send application", { tag: "button" }));
  };

  it("the job page shows the role, company, place and an application form", async () => {
    const job = await makeJob({ title: unique("Detail job"), location: "Khulna" });
    await openJob(b.driver, "learner", job);
    await waitText(b.driver, "Open");
    await waitText(b.driver, "Hana Hirer");
    await waitText(b.driver, "Khulna");
    await waitText(b.driver, "About the role");
    await waitText(b.driver, "Apply for this job");
    assert.equal(await exists(b.driver, xText("Manage this job")), false, "learners get no management panel");
  });

  it("the page names the company with a link to its profile", async () => {
    const job = await makeJob({ title: unique("Company link") });
    await openJob(b.driver, "learner", job);
    await click(b.driver, By.xpath("//a[contains(@href,'/profile/') and contains(normalize-space(.),'Hana Hirer')]"));
    await waitUrl(b.driver, /^\/profile\//);
    await waitText(b.driver, "Hana Hirer");
  });

  it("the send button stays disabled until a PDF resume is attached", async () => {
    const job = await makeJob({ title: unique("Resume needed") });
    await openJob(b.driver, "learner", job);
    await type(b.driver, By.css("textarea[name=cover_letter]"), "I am keen");
    assert.equal(await (await find(b.driver, xText("Send application", { tag: "button" }))).isEnabled(), false);
    await upload(b.driver, By.css(".dropzone input[type=file]"), fixture("resume.pdf"));
    await b.driver.wait(async () => (await find(b.driver, xText("Send application", { tag: "button" }))).isEnabled(), 5000);
  });

  it("the cover letter is required", async () => {
    const job = await makeJob({ title: unique("Letter needed") });
    await openJob(b.driver, "learner", job);
    await upload(b.driver, By.css(".dropzone input[type=file]"), fixture("resume.pdf"));
    await click(b.driver, xText("Send application", { tag: "button" }));
    assert.equal(await b.driver.executeScript("return document.querySelector('textarea[name=cover_letter]').validity.valueMissing"), true);
  });

  it("sending an application confirms it and replaces the form with its status", async () => {
    const job = await makeJob({ title: unique("Apply here") });
    const learner = await makeLearner("jobseeker");
    await openJob(b.driver, learner, job);
    await apply("I would be a great addition to your team.");
    await waitText(b.driver, "Your application");
    await waitTextCI(b.driver, "applied");
    assert.equal(await exists(b.driver, By.css("textarea[name=cover_letter]")), false);
  });

  it("the hirer is told about the new application and sees it with its resume", async () => {
    const job = await makeJob({ title: unique("Hirer informed") });
    const learner = await makeLearner("applicant2");
    await openJob(b.driver, learner, job);
    await apply("Please consider me for this role.");
    await waitText(b.driver, "Your application");
    const note = (await notificationsOf("hirer")).find((n) => n.type === "job_application_received" && n.title.includes(job.title));
    assert.equal(note?.title, `${learner.name} applied for “${job.title}”`);
    assert.match(note.body, /Please consider me/);
    const applicants = await apiOk("hirer", `frontend/jobs/${job.id}/applications`);
    assert.equal(applicants.length, 1);
    assert.equal(applicants[0].has_resume, true);
  });

  it("a learner who already applied sees their status instead of the form", async () => {
    const job = await makeJob({ title: unique("Already applied") });
    const learner = await makeLearner("repeat");
    await openJob(b.driver, learner, job);
    await apply("First and only application.");
    await waitText(b.driver, "Your application");
    await b.driver.navigate().refresh();
    await waitText(b.driver, "Your application");
    await waitText(b.driver, "The hirer will update your status here.");
  });

  it("applied jobs are listed under 'My applications' with their status", async () => {
    const job = await makeJob({ title: unique("Tracked") });
    const learner = await makeLearner("tracker");
    await openJob(b.driver, learner, job);
    await apply("Track me.");
    await waitText(b.driver, "Your application");
    await go(b.driver, "/jobs");
    await click(b.driver, xText("My applications", { tag: "button" }));
    await type(b.driver, searchBox, job.title);
    await visible(b.driver, By.xpath(jobCard(job.title)));
    await waitTextCI(b.driver, "applied");
  });

  it("'My applications' invites a new learner to start applying", async () => {
    const learner = await makeLearner("nothing-yet");
    await signIn(b.driver, learner);
    await go(b.driver, "/jobs");
    await click(b.driver, xText("My applications", { tag: "button" }));
    await waitText(b.driver, "No matching opportunities");
  });

  it("a job that was closed says it no longer accepts applications", async () => {
    const job = await makeJob({ title: unique("Closed to new") });
    await apiOk("hirer", `frontend/jobs/${job.id}/status`, { method: "PATCH", body: { status: "closed" } });
    await openJob(b.driver, "learner", job);
    await waitText(b.driver, "This job is no longer accepting applications.");
    assert.equal(await exists(b.driver, By.css("textarea[name=cover_letter]")), false);
  });

  it("the learner sees the hirer's decision and is notified", async () => {
    const job = await makeJob({ title: unique("Decision") });
    const learner = await makeLearner("decided");
    await apiOk(learner, `jobs/${job.id}/apply`, { method: "POST", form: (() => { const f = new FormData(); f.set("cover_letter", "Hello"); f.set("resume", new Blob(["%PDF-1.1"], { type: "application/pdf" }), "cv.pdf"); return f; })() });
    await apiOk("hirer", `frontend/jobs/${job.id}/applications/${learner.id}`, { method: "PATCH", body: { status: "shortlisted" } });
    await apiOk("hirer", `frontend/jobs/${job.id}/applications/${learner.id}`, { method: "PATCH", body: { status: "accepted" } });
    await openJob(b.driver, learner, job);
    await waitTextCI(b.driver, "accepted");
    const titlesSeen = (await notificationsOf(learner)).filter((n) => n.type === "job_application_status").map((n) => n.title);
    assert.ok(titlesSeen.includes(`Your application for “${job.title}” was accepted`), titlesSeen.join(" | "));
    assert.ok(titlesSeen.includes(`You were shortlisted for “${job.title}”`));
  });

  it("applicants are told when the hirer closes the job", async () => {
    const job = await makeJob({ title: unique("Will close") });
    const learner = await makeLearner("waiting");
    await apiOk(learner, `jobs/${job.id}/apply`, { method: "POST", form: (() => { const f = new FormData(); f.set("cover_letter", "Hello"); f.set("resume", new Blob(["%PDF-1.1"], { type: "application/pdf" }), "cv.pdf"); return f; })() });
    await apiOk("hirer", `frontend/jobs/${job.id}/status`, { method: "PATCH", body: { status: "closed" } });
    const note = (await notificationsOf(learner)).find((n) => n.type === "job_closed");
    assert.match(note.title, new RegExp(`“${job.title}” is no longer open`));
  });

  it("learners with a matching interest hear about newly opened jobs", async () => {
    const watcher = await makeLearner("watcher", "data");
    const other = await makeLearner("elsewhere2", "music");
    const job = await makeJob({ title: unique("Fresh opening"), category: "data" });
    const mine = (await notificationsOf(watcher)).find((n) => n.type === "job_new" && n.title.includes(job.title));
    assert.equal(mine?.title, `New job: ${job.title}`);
    assert.ok(!(await notificationsOf(other)).some((n) => n.title.includes(job.title)));
  });

  it("the back arrow returns to the job list", async () => {
    const job = await makeJob({ title: unique("Go back") });
    await openJob(b.driver, "learner", job);
    await click(b.driver, By.css(".post-detail-back"));
    await waitUrl(b.driver, /^\/jobs$/);
  });
});
