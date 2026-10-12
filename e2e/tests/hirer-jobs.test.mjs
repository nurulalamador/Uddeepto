import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { By, apiOk, chooseOption, click, clickLink, count, exists, find, go, hasText, hover, isShown, q, setValue, signIn, sleep, texts, type, unique, useBrowser, visible, waitGone, waitText, waitTextCI, waitUrl, xText } from "../lib/browser.mjs";
import { applyTo, makeHirer, makeJob, makeLearner, notificationsOf } from "../lib/factory.mjs";

const jobCard = (title) => `//article[contains(@class,'job-card') or contains(@class,'card')][.//h2[normalize-space(.)=${q(title)}] or .//h3[normalize-space(.)=${q(title)}]]`;
const search = By.css("input[aria-label='Search your job posts…']");
async function openManagement(driver, who) {
  await signIn(driver, who);
  await go(driver, "/job-management");
  await waitText(driver, "Post roles, follow their progress and get to know the people who apply.");
}
async function findPost(driver, who, title) {
  await openManagement(driver, who);
  await type(driver, search, title);
  await visible(driver, By.xpath(jobCard(title)));
}

describe("Hirer · My job posts", () => {
  const b = useBrowser();

  it("a new hirer is invited to post a first job", async () => {
    const hirer = await makeHirer("nojobs");
    await openManagement(b.driver, hirer);
    await waitText(b.driver, "Your next hire starts with a job post");
    assert.ok(await isShown(b.driver, xText("Post a job", { tag: "button" })));
  });

  it("each post shows its status, place, type, salary and applicant count", async () => {
    const hirer = await makeHirer("poster");
    const job = await makeJob({ owner: hirer, title: "Listed post", location: "Rajshahi", type: "contract", min: 20000, max: 30000 });
    await applyTo(job, await makeLearner("who"));
    await findPost(b.driver, hirer, job.title);
    const text = await (await find(b.driver, By.xpath(jobCard(job.title)))).getText();
    assert.match(text, /Open/i);
    assert.match(text, /Rajshahi/);
    assert.match(text, /contract/i);
    assert.match(text, /BDT 20,000\.00 - BDT 30,000\.00/);
    assert.match(text, /1\s+applicant/);
    assert.match(text, /Posted/);
  });

  it("a post without a salary says 'Salary negotiable'", async () => {
    const hirer = await makeHirer("nosalary");
    const job = await makeJob({ owner: hirer, title: "Negotiable post", min: null, max: null });
    await findPost(b.driver, hirer, job.title);
    await waitText(b.driver, "Salary negotiable");
  });

  it("only the hirer's own posts are listed", async () => {
    const mine = await makeJob({ title: unique("Hana post") });
    const theirs = await makeJob({ owner: "hirer2", title: unique("Hugo post") });
    await openManagement(b.driver, "hirer");
    await type(b.driver, search, theirs.title);
    await waitText(b.driver, "No posts match your filters");
    await type(b.driver, search, mine.title);
    await visible(b.driver, By.xpath(jobCard(mine.title)));
  });

  it("the search box finds a post by its title", async () => {
    const hirer = await makeHirer("searchposts");
    const one = await makeJob({ owner: hirer, title: unique("Alpha role") });
    const two = await makeJob({ owner: hirer, title: unique("Beta role") });
    await openManagement(b.driver, hirer);
    await type(b.driver, search, one.title);
    await visible(b.driver, By.xpath(jobCard(one.title)));
    await b.driver.wait(async () => !(await hasText(b.driver, two.title)), 8000);
  });

  it("the status filter keeps only open or only closed posts", async () => {
    const hirer = await makeHirer("filterer");
    const open = await makeJob({ owner: hirer, title: unique("Open one") });
    const closed = await makeJob({ owner: hirer, title: unique("Closed one") });
    await apiOk(hirer, `frontend/jobs/${closed.id}/status`, { method: "PATCH", body: { status: "closed" } });
    await openManagement(b.driver, hirer);
    await waitText(b.driver, open.title);
    await chooseOption(b.driver, "Filter by status", "Closed");
    await visible(b.driver, By.xpath(jobCard(closed.title)));
    await b.driver.wait(async () => !(await hasText(b.driver, open.title)), 8000);
  });

  it("a post can be closed from the list and reopened", async () => {
    const hirer = await makeHirer("toggler");
    const job = await makeJob({ owner: hirer, title: unique("Toggle post") });
    await findPost(b.driver, hirer, job.title);
    await click(b.driver, By.xpath(jobCard(job.title) + "//button[normalize-space(.)='Close']"));
    await waitText(b.driver, "Reopen");
    assert.equal((await apiOk(hirer, `frontend/jobs/${job.id}`)).status, "closed");
    await click(b.driver, By.xpath(jobCard(job.title) + "//button[normalize-space(.)='Reopen']"));
    await waitText(b.driver, "Close");
    assert.equal((await apiOk(hirer, `frontend/jobs/${job.id}`)).status, "open");
  });

  it("a closed post disappears from what learners can browse", async () => {
    const hirer = await makeHirer("hider");
    const job = await makeJob({ owner: hirer, title: unique("Hide me") });
    await apiOk(hirer, `frontend/jobs/${job.id}/status`, { method: "PATCH", body: { status: "closed" } });
    const visibleToLearners = await apiOk("learner", `frontend/jobs?q=${encodeURIComponent(job.title)}`);
    assert.equal(visibleToLearners.length, 0);
  });

  it("View opens the job page", async () => {
    const hirer = await makeHirer("viewer3");
    const job = await makeJob({ owner: hirer, title: unique("View post") });
    await findPost(b.driver, hirer, job.title);
    await click(b.driver, By.xpath(jobCard(job.title) + "//a[normalize-space(.)='View']"));
    await waitUrl(b.driver, `/jobs/${job.id}`);
    await waitText(b.driver, "Manage this job");
  });

  it("the applicant count opens the Applicants tab for that post", async () => {
    const hirer = await makeHirer("counter2");
    const job = await makeJob({ owner: hirer, title: unique("Counted post") });
    const learner = await makeLearner("counted");
    await applyTo(job, learner);
    await findPost(b.driver, hirer, job.title);
    await click(b.driver, By.css(`button[aria-label='1 applicants for ${job.title}'], button[aria-label='1 applicant for ${job.title}']`));
    await waitText(b.driver, learner.name);
  });
});

describe("Hirer · Posting a job", () => {
  const b = useBrowser();
  const form = By.xpath("//*[contains(@class,'modal')]//form");
  async function openForm(hirer) {
    await openManagement(b.driver, hirer);
    await click(b.driver, xText("Post a job", { tag: "button" }));
    await waitText(b.driver, "Post an opportunity");
  }
  const submit = () => click(b.driver, By.xpath("//*[contains(@class,'modal')]//form//button[contains(@class,'button') and not(@type='button')][last()]"));
  async function fillBasics(title) {
    await type(b.driver, By.css(".modal [name=title]"), title);
    await type(b.driver, By.css(".modal [name=description]"), "We need someone great.");
  }
  async function pinOnMap() {
    const map = By.css("[aria-label='Pick the job location on the map']");
    await visible(b.driver, map);
    await b.driver.executeScript("arguments[0].scrollIntoView({block:'center'})", await find(b.driver, map));
    await b.driver.actions().move({ origin: await find(b.driver, map) }).click().perform();
    await visible(b.driver, By.xpath("//*[contains(@class,'location-status')]//button[contains(normalize-space(.),'Clear')]"));
  }

  it("the form asks for title, description, interest, type, workplace, salary, deadline and a map pin", async () => {
    await openForm(await makeHirer("former"));
    for (const label of ["Job title", "Description and requirements", "Interest category", "Type", "Workplace", "Minimum salary (BDT)", "Maximum salary (BDT)", "Application deadline", "Address / area"]) await waitText(b.driver, label);
    assert.ok(await isShown(b.driver, By.css("[aria-label='Pick the job location on the map']")));
    assert.ok(await isShown(b.driver, By.css("input[aria-label='Search for a place']")));
  });

  it("title and description are required", async () => {
    await openForm(await makeHirer("blankform"));
    await submit();
    assert.equal(await b.driver.executeScript("return document.querySelector('.modal [name=title]').validity.valueMissing"), true);
  });

  it("an interest category must be chosen", async () => {
    await openForm(await makeHirer("nocat"));
    await fillBasics(unique("No category"));
    await submit();
    await waitText(b.driver, "Choose the interest category this job belongs to.");
  });

  it("an on-site job needs a pin on the map", async () => {
    await openForm(await makeHirer("nopin"));
    await fillBasics(unique("No pin"));
    await chooseOption(b.driver, "Interest category of this job", "Web Development");
    await submit();
    await waitText(b.driver, "Pick the job location on the map.");
  });

  it("a job with a pin on the map is created and listed", async () => {
    const hirer = await makeHirer("pinned");
    const title = unique("Pinned role");
    await openForm(hirer);
    await fillBasics(title);
    await chooseOption(b.driver, "Interest category of this job", "Web Development");
    await type(b.driver, By.css(".modal [name=salary_min]"), "40000");
    await type(b.driver, By.css(".modal [name=salary_max]"), "70000");
    await pinOnMap();
    await submit();
    await waitText(b.driver, title);
    const [created] = await apiOk(hirer, "frontend/jobs?tab=mine");
    assert.equal(created.title, title);
    assert.ok(created.latitude != null && created.longitude != null, "the pin was saved");
    assert.equal(Number(created.salary_min), 40000);
  });

  it("a remote job needs no pin", async () => {
    const hirer = await makeHirer("remote");
    const title = unique("Remote role");
    await openForm(hirer);
    await fillBasics(title);
    await chooseOption(b.driver, "Interest category of this job", "Data Science");
    await setValue(b.driver, By.xpath("//*[contains(@class,'modal')]//label[contains(normalize-space(.),'Workplace')]//select"), "remote");
    await submit();
    await waitText(b.driver, title);
    const [created] = await apiOk(hirer, "frontend/jobs?tab=mine");
    assert.equal(created.is_remote, true);
  });

  it("the type can be chosen from the list of job types", async () => {
    const hirer = await makeHirer("typed");
    const title = unique("Internship role");
    await openForm(hirer);
    await fillBasics(title);
    await chooseOption(b.driver, "Interest category of this job", "Web Development");
    await setValue(b.driver, By.css(".modal select[name=type]"), "internship");
    await setValue(b.driver, By.xpath("//*[contains(@class,'modal')]//label[contains(normalize-space(.),'Workplace')]//select"), "remote");
    await submit();
    await waitText(b.driver, title);
    const [created] = await apiOk(hirer, "frontend/jobs?tab=mine");
    assert.equal(created.type, "internship");
  });

  it("a deadline can be set and is shown on the job page", async () => {
    const hirer = await makeHirer("deadline");
    const title = unique("Deadline role");
    await openForm(hirer);
    await fillBasics(title);
    await chooseOption(b.driver, "Interest category of this job", "Web Development");
    await setValue(b.driver, By.xpath("//*[contains(@class,'modal')]//label[contains(normalize-space(.),'Workplace')]//select"), "remote");
    const day = new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 16);
    await setValue(b.driver, By.css(".modal [name=application_deadline]"), day);
    await submit();
    await waitText(b.driver, title);
    const [created] = await apiOk(hirer, "frontend/jobs?tab=mine");
    await go(b.driver, `/jobs/${created.id}`);
    await waitText(b.driver, "Apply by");
  });

  it("the dialog can be closed without posting", async () => {
    await openForm(await makeHirer("closer2"));
    await click(b.driver, By.css("button[aria-label='Close dialog']"));
    await waitGone(b.driver, By.css(".modal"));
  });

  it("a search for a place proposes results the hirer can pick", async () => {
    await openForm(await makeHirer("placer"));
    await type(b.driver, By.css("input[aria-label='Search for a place']"), "ab");
    assert.equal(await (await find(b.driver, By.xpath("//*[contains(@class,'location-search')]//button[contains(normalize-space(.),'Search')]"))).isEnabled(), false, "needs three letters");
  });
});

describe("Hirer · Reviewing applicants", () => {
  const b = useBrowser();
  async function jobWithApplicants(...names) {
    const hirer = await makeHirer("reviewer");
    const job = await makeJob({ owner: hirer, title: unique("Review role") });
    const learners = [];
    for (const name of names) {
      const learner = await makeLearner(name);
      await applyTo(job, learner, `Cover letter of ${name}`);
      learners.push(learner);
    }
    return { hirer, job, learners };
  }

  it("the job page lists candidates with their cover letter and a resume download", async () => {
    const { hirer, job, learners } = await jobWithApplicants("candidate");
    await signIn(b.driver, hirer);
    await go(b.driver, `/jobs/${job.id}`);
    await waitText(b.driver, "Candidate applications");
    await waitText(b.driver, learners[0].name);
    await waitText(b.driver, "Cover letter of candidate");
    const link = await visible(b.driver, By.xpath("//a[contains(normalize-space(.),'Download resume')]"));
    assert.ok((await link.getAttribute("href")).includes(`/jobs/${job.id}/applications/${learners[0].id}/resume`));
  });

  it("the resume downloads as the file the applicant uploaded", async () => {
    const { hirer, job, learners } = await jobWithApplicants("cvowner");
    const response = await fetch(`${process.env.E2E_API_URL || "http://127.0.0.1:4400/api/v1"}/frontend/jobs/${job.id}/applications/${learners[0].id}/resume`, { headers: { Authorization: `Bearer ${await (async () => (await (await fetch(`${process.env.E2E_API_URL || "http://127.0.0.1:4400/api/v1"}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ identifier: hirer.username, password: "Passw0rd!123" }) })).json()).accessToken)()}` } });
    assert.equal(response.status, 200);
    assert.match(await response.text(), /%PDF/);
  });

  it("the status of a candidate is changed from the job page and saved", async () => {
    const { hirer, job, learners } = await jobWithApplicants("promoted");
    await signIn(b.driver, hirer);
    await go(b.driver, `/jobs/${job.id}`);
    await waitText(b.driver, learners[0].name);
    await setValue(b.driver, By.xpath("//label[contains(normalize-space(.),'Application status')]//select"), "shortlisted");
    await b.driver.wait(async () => (await apiOk(hirer, `frontend/jobs/${job.id}/applications`))[0].status === "shortlisted", 8000);
  });

  it("the candidate is told about each decision", async () => {
    const { hirer, job, learners } = await jobWithApplicants("informed");
    await signIn(b.driver, hirer);
    await go(b.driver, `/jobs/${job.id}`);
    await waitText(b.driver, learners[0].name);
    await setValue(b.driver, By.xpath("//label[contains(normalize-space(.),'Application status')]//select"), "accepted");
    await b.driver.wait(async () => (await notificationsOf(learners[0])).some((n) => n.type === "job_application_status"), 8000);
    const note = (await notificationsOf(learners[0])).find((n) => n.type === "job_application_status");
    assert.equal(note.title, `Your application for “${job.title}” was accepted`);
  });

  it("the page can close and reopen applications", async () => {
    const { hirer, job } = await jobWithApplicants("pending");
    await signIn(b.driver, hirer);
    await go(b.driver, `/jobs/${job.id}`);
    await waitText(b.driver, "1 application received.");
    await click(b.driver, xText("Close applications", { tag: "button" }));
    await waitText(b.driver, "Reopen applications");
    assert.equal((await apiOk(hirer, `frontend/jobs/${job.id}`)).status, "closed");
    await click(b.driver, xText("Reopen applications", { tag: "button" }));
    await waitText(b.driver, "Close applications");
  });

  it("a job without applicants says so", async () => {
    const hirer = await makeHirer("lonelyjob");
    const job = await makeJob({ owner: hirer, title: unique("Empty role") });
    await signIn(b.driver, hirer);
    await go(b.driver, `/jobs/${job.id}`);
    await waitText(b.driver, "No applicants yet");
  });

  it("the Applicants tab gathers candidates from every post with the post they applied to", async () => {
    const hirer = await makeHirer("allapps");
    const first = await makeJob({ owner: hirer, title: unique("First post") });
    const second = await makeJob({ owner: hirer, title: unique("Second post") });
    const a = await makeLearner("ann");
    const c = await makeLearner("cat");
    await applyTo(first, a);
    await applyTo(second, c);
    await openManagement(b.driver, hirer);
    await click(b.driver, xText("Applicants", { tag: "button" }));
    await waitText(b.driver, a.name);
    await waitText(b.driver, c.name);
    await waitText(b.driver, first.title);
    await waitText(b.driver, second.title);
  });

  it("applicants can be filtered by post, by status and by name", async () => {
    const hirer = await makeHirer("filtering");
    const first = await makeJob({ owner: hirer, title: unique("Filter one") });
    const second = await makeJob({ owner: hirer, title: unique("Filter two") });
    const a = await makeLearner("alpha");
    const c = await makeLearner("gamma");
    await applyTo(first, a);
    await applyTo(second, c);
    await apiOk(hirer, `frontend/jobs/${second.id}/applications/${c.id}`, { method: "PATCH", body: { status: "shortlisted" } });
    await openManagement(b.driver, hirer);
    await click(b.driver, xText("Applicants", { tag: "button" }));
    await waitText(b.driver, a.name);
    await chooseOption(b.driver, "Filter by job post", `${first.title} (1)`);
    await b.driver.wait(async () => !(await hasText(b.driver, c.name)), 8000);
    await chooseOption(b.driver, "Filter by job post", "All job posts");
    await chooseOption(b.driver, "Filter by application status", "Shortlisted");
    await waitText(b.driver, c.name);
    await b.driver.wait(async () => !(await hasText(b.driver, a.name)), 8000);
    await chooseOption(b.driver, "Filter by application status", "All statuses");
    await type(b.driver, By.css("input[aria-label='Search applicants by name…']"), a.name);
    await waitText(b.driver, a.name);
    await b.driver.wait(async () => !(await hasText(b.driver, c.name)), 8000);
  });

  it("an applicant's status can be changed from the Applicants tab", async () => {
    const { hirer, job, learners } = await jobWithApplicants("rowchange");
    await openManagement(b.driver, hirer);
    await click(b.driver, xText("Applicants", { tag: "button" }));
    await waitText(b.driver, learners[0].name);
    await click(b.driver, By.xpath(`//button[contains(@class,'text-link')][ancestor::*[contains(normalize-space(.),${q(learners[0].name)})]][1]`));
    await setValue(b.driver, By.css(`select[aria-label='Status of ${learners[0].name}']`), "rejected");
    await b.driver.wait(async () => (await apiOk(hirer, `frontend/jobs/${job.id}/applications`))[0].status === "rejected", 8000);
  });

  it("the applicants list is empty for someone who has no applications", async () => {
    const hirer = await makeHirer("noapps");
    await openManagement(b.driver, hirer);
    await click(b.driver, xText("Applicants", { tag: "button" }));
    await waitText(b.driver, "No applicants found");
  });

  it("a hirer cannot change applications of another hirer's job", async () => {
    const hugo = await makeHirer("owner3");
    const job = await makeJob({ owner: hugo, title: unique("Not yours") });
    const learner = await makeLearner("stranger");
    await applyTo(job, learner);
    const refused = await import("../lib/browser.mjs").then((m) => m.api("hirer", `frontend/jobs/${job.id}/applications/${learner.id}`, { method: "PATCH", body: { status: "accepted" } }));
    assert.equal(refused.status, 403);
  });
});
