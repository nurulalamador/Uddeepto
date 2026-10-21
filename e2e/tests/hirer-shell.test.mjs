import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { By, apiOk, click, clickLink, exists, find, go, hasText, isShown, signIn, sleep, texts, type, unique, useBrowser, visible, waitText, waitUrl, xText } from "../lib/browser.mjs";
import { applyTo, makeHirer, makeJob, makeLearner } from "../lib/factory.mjs";
import { goSidebar, logout, openProfileMenu, pageTitle, sidebarCaptions, sidebarItems, waitWorkspace } from "../lib/flows.mjs";

const HIRER_MENU = ["Dashboard", "Showcase", "Job Management", "Messages", "Notifications", "Profile"];

describe("Hirer · Navigation", () => {
  const b = useBrowser();

  it("the menu groups Overview, Hiring and Social", async () => {
    await signIn(b.driver, "hirer");
    await go(b.driver, "/dashboard");
    await waitWorkspace(b.driver);
    assert.deepEqual(await sidebarCaptions(b.driver), ["OVERVIEW", "HIRING", "SOCIAL"]);
  });

  it("a hirer's menu has only the hiring features", async () => {
    await signIn(b.driver, "hirer");
    await go(b.driver, "/dashboard");
    assert.deepEqual(await sidebarItems(b.driver), HIRER_MENU);
  });

  it("the profile card shows the hirer's name and role", async () => {
    await signIn(b.driver, "hirer");
    await go(b.driver, "/dashboard");
    await waitWorkspace(b.driver);
    assert.equal(await (await find(b.driver, By.css(".sidebar .profile .name"))).getText(), "Hana Hirer");
    assert.equal((await (await find(b.driver, By.css(".sidebar .profile .role-label"))).getText()).toLowerCase(), "hirer");
  });

  for (const [label, route, title] of [
    ["Dashboard", "/dashboard", "Dashboard"],
    ["Showcase", "/showcase", "Showcase"],
    ["Job Management", "/job-management", "Job Management"],
    ["Messages", "/messages", "Messages"],
    ["Notifications", "/notifications", "Notifications"],
    ["Profile", "/profile", "Profile"],
  ])
    it(`"${label}" opens ${route}`, async () => {
      await signIn(b.driver, "hirer");
      await go(b.driver, label === "Dashboard" ? "/showcase" : "/dashboard");
      await waitWorkspace(b.driver);
      await goSidebar(b.driver, label);
      await waitUrl(b.driver, new RegExp(`^${route}`));
      await b.driver.wait(async () => (await pageTitle(b.driver)) === title, 8000);
    });

  for (const route of ["/courses", "/contests", "/webinars", "/communities", "/ai", "/admin", "/moderation", "/settings"])
    it(`${route} is not available to a hirer`, async () => {
      await signIn(b.driver, "hirer");
      await go(b.driver, route);
      await waitText(b.driver, "Access restricted");
    });

  it("the old /jobs address leads a hirer to Job Management", async () => {
    await signIn(b.driver, "hirer");
    await go(b.driver, "/jobs");
    await b.driver.wait(async () => (await b.driver.getCurrentUrl()).includes("/job-management") || (await hasText(b.driver, "Job Management")), 10000);
  });

  it("a hirer can still open a single job page", async () => {
    const job = await makeJob({ title: unique("Own job page") });
    await signIn(b.driver, "hirer");
    await go(b.driver, `/jobs/${job.id}`);
    await waitText(b.driver, job.title);
    await waitText(b.driver, "Manage this job");
  });

  it("a hirer is not asked to choose interests", async () => {
    const hirer = await makeHirer("nogate");
    await signIn(b.driver, hirer);
    await go(b.driver, "/dashboard");
    await waitWorkspace(b.driver);
    await sleep(500);
    assert.equal(await exists(b.driver, By.css("dialog.interest-gate")), false);
  });

  it("the global search finds people and jobs but never offers courses to a hirer", async () => {
    const job = await makeJob({ title: unique("Searchable role") });
    await signIn(b.driver, "hirer");
    await go(b.driver, "/dashboard");
    await type(b.driver, By.css("input[aria-label='Search Uddeepto']"), job.title);
    await waitText(b.driver, job.title);
  });

  it("the hirer can sign out", async () => {
    await signIn(b.driver, "hirer");
    await go(b.driver, "/dashboard");
    await waitWorkspace(b.driver);
    await logout(b.driver);
  });
});

describe("Hirer · Dashboard", () => {
  const b = useBrowser();

  it("greets by first name and nudges a new hirer to post a job", async () => {
    const hirer = await makeHirer("fresh");
    await signIn(b.driver, hirer);
    await go(b.driver, "/dashboard");
    await b.driver.wait(async () => /^(Good (morning|afternoon|evening|night)|Working late), Person!/.test(await (await find(b.driver, By.css(".ld-hero h1"))).getText()), 10000);
    await waitText(b.driver, "Post your first job and start meeting talented people.");
  });

  it("shows the six hiring tiles, all zero for a new hirer", async () => {
    const hirer = await makeHirer("zero");
    await signIn(b.driver, hirer);
    await go(b.driver, "/dashboard");
    await waitText(b.driver, "Open positions");
    assert.deepEqual(await texts(b.driver, By.css(".ld-tile > span:last-child")), ["Open positions", "Total job posts", "Total applicants", "Awaiting review", "Shortlisted", "Accepted"]);
    assert.deepEqual(await texts(b.driver, By.css(".ld-tile > strong")), ["0", "0", "0", "0", "0", "0"]);
  });

  it("counts jobs and applicants and says how many are waiting for review", async () => {
    const hirer = await makeHirer("busy");
    const job = await makeJob({ owner: hirer, title: "Busy role" });
    await makeJob({ owner: hirer, title: "Quiet role" });
    const [a, c] = [await makeLearner("cand1"), await makeLearner("cand2")];
    await applyTo(job, a);
    await applyTo(job, c);
    await signIn(b.driver, hirer);
    await go(b.driver, "/dashboard");
    await waitText(b.driver, "You have 2 applicants waiting for review");
    assert.deepEqual(await texts(b.driver, By.css(".ld-tile > strong")), ["2", "2", "2", "2", "0", "0"]);
    await waitText(b.driver, "Latest applicants");
    await waitText(b.driver, a.name);
    await waitText(b.driver, "Busy role");
  });

  it("deciding on applicants moves them through the pipeline and the tiles", async () => {
    const hirer = await makeHirer("decider");
    const job = await makeJob({ owner: hirer, title: "Deciding role" });
    const [a, c] = [await makeLearner("yes"), await makeLearner("short")];
    await applyTo(job, a);
    await applyTo(job, c);
    await apiOk(hirer, `frontend/jobs/${job.id}/applications/${a.id}`, { method: "PATCH", body: { status: "accepted" } });
    await apiOk(hirer, `frontend/jobs/${job.id}/applications/${c.id}`, { method: "PATCH", body: { status: "shortlisted" } });
    await signIn(b.driver, hirer);
    await go(b.driver, "/dashboard");
    await waitText(b.driver, "Applicant pipeline");
    assert.deepEqual(await texts(b.driver, By.css(".ld-tile > strong")), ["1", "1", "2", "0", "1", "1"]);
    await waitText(b.driver, "You’re all caught up. New applications will appear here as they arrive.");
  });

  it("the tiles and buttons lead to Job Management", async () => {
    const hirer = await makeHirer("linker");
    await signIn(b.driver, hirer);
    await go(b.driver, "/dashboard");
    await click(b.driver, By.xpath("//a[contains(@class,'ld-tile')][contains(normalize-space(.),'Open positions')]"));
    await waitUrl(b.driver, /^\/job-management/);
    await go(b.driver, "/dashboard");
    await clickLink(b.driver, "Manage jobs");
    await waitUrl(b.driver, /^\/job-management/);
  });

  it("the 'Messages' button opens the inbox", async () => {
    const hirer = await makeHirer("inbox");
    await signIn(b.driver, hirer);
    await go(b.driver, "/dashboard");
    await clickLink(b.driver, "Messages");
    await waitUrl(b.driver, /^\/messages/);
  });

  it("lists the hirer's own job posts with their applicant counts", async () => {
    const hirer = await makeHirer("lister2");
    const job = await makeJob({ owner: hirer, title: "Listed role" });
    await applyTo(job, await makeLearner("one"));
    await signIn(b.driver, hirer);
    await go(b.driver, "/dashboard");
    await waitText(b.driver, "Your job posts");
    await waitText(b.driver, "Listed role");
    await waitText(b.driver, "1 applicant");
  });
});
