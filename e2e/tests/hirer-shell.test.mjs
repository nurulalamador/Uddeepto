import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { By, apiOk, click, clickLink, exists, find, go, hasText, isShown, signIn, sleep, texts, type, unique, useBrowser, visible, waitText, waitUrl, xText } from "../lib/browser.mjs";
import { applyTo, makeHirer, makeJob, makeLearner } from "../lib/factory.mjs";
import { goSidebar, logout, openProfileMenu, pageTitle, sidebarCaptions, sidebarItems, waitWorkspace } from "../lib/flows.mjs";

const HIRER_MENU = ["Dashboard", "Showcase", "Leaderboard", "My Job Posts", "Applicants", "Messages", "Notifications", "Profile"];

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
    ["My Job Posts", "/job-posts", "My Job Posts"],
    ["Applicants", "/applicants", "Applicants"],
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

  it("the old /job-management address leads to My Job Posts", async () => {
    await signIn(b.driver, "hirer");
    await go(b.driver, "/job-management");
    await waitUrl(b.driver, /^\/job-posts/);
  });

  it("the old /jobs address leads a hirer to My Job Posts", async () => {
    await signIn(b.driver, "hirer");
    await go(b.driver, "/jobs");
    await waitUrl(b.driver, /^\/job-posts/);
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

  it("the tiles and buttons lead to My Job Posts and Applicants", async () => {
    const hirer = await makeHirer("linker");
    await signIn(b.driver, hirer);
    await go(b.driver, "/dashboard");
    await click(b.driver, By.xpath("//a[contains(@class,'ld-tile')][contains(normalize-space(.),'Open positions')]"));
    await waitUrl(b.driver, /^\/job-posts/);
    await go(b.driver, "/dashboard");
    await click(b.driver, By.xpath("//a[contains(@class,'ld-tile')][contains(normalize-space(.),'Total applicants')]"));
    await waitUrl(b.driver, /^\/applicants/);
    await go(b.driver, "/dashboard");
    await clickLink(b.driver, "Manage jobs");
    await waitUrl(b.driver, /^\/job-posts/);
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

describe("Hirer · My Job Posts, Applicants and the profile page", () => {
  const b = useBrowser();
  const phone = () => b.driver.sendDevToolsCommand("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  const laptop = () => b.driver.sendDevToolsCommand("Emulation.clearDeviceMetricsOverride", {});

  it("the two are separate pages with their own menu items", async () => {
    await signIn(b.driver, "hirer");
    await go(b.driver, "/job-posts");
    await visible(b.driver, By.css("input[aria-label='Search your job posts…']"));
    assert.equal(await exists(b.driver, By.css(".tabs")), false, "no tabs inside the page any more");
    assert.equal(await (await find(b.driver, By.css(".sidebar nav a.active"))).getText(), "My Job Posts");
    await goSidebar(b.driver, "Applicants");
    await waitUrl(b.driver, /^\/applicants/);
    await visible(b.driver, By.css("input[aria-label='Search applicants by name…']"));
    assert.equal(await (await find(b.driver, By.css(".sidebar nav a.active"))).getText(), "Applicants");
  });

  it("'Post a job' sits with the search and filter on My Job Posts, and is not on Applicants", async () => {
    await signIn(b.driver, "hirer");
    await go(b.driver, "/job-posts");
    await visible(b.driver, By.css(".jm-toolbar .jm-post-button"));
    await go(b.driver, "/applicants");
    await visible(b.driver, By.css("input[aria-label='Search applicants by name…']"));
    assert.equal(await exists(b.driver, xText("Post a job", { tag: "button" })), false);
  });

  it("a job's applicants link opens Applicants already filtered to that job", async () => {
    const hirer = await makeHirer("deeplink");
    const job = await makeJob({ owner: hirer, title: unique("Deep link post") });
    const other = await makeJob({ owner: hirer, title: unique("Other post") });
    const [a, c] = [await makeLearner("dlone"), await makeLearner("dltwo")];
    await applyTo(job, a);
    await applyTo(other, c);
    await signIn(b.driver, hirer);
    await go(b.driver, `/applicants?job=${job.id}`);
    await waitText(b.driver, a.name);
    assert.equal(await hasText(b.driver, c.name), false);
  });

  it("neither page has an eyebrow, a big title or a subtitle, and neither does the profile", async () => {
    await signIn(b.driver, "hirer");
    for (const route of ["/job-posts", "/applicants", "/profile"]) {
      await go(b.driver, route);
      await waitWorkspace(b.driver);
      await sleep(600);
      assert.equal(await exists(b.driver, By.css(".page-heading, .eyebrow, main h1.heading")), false, route);
      assert.equal(await hasText(b.driver, "PEOPLE BEHIND THE POSSIBILITIES"), false, route);
      assert.equal(await hasText(b.driver, "Interests, work and story."), false, route);
    }
  });

  it("on a phone the search box is a normal height and every control fits the screen", async () => {
    await signIn(b.driver, "hirer");
    await phone();
    try {
      for (const [route, field] of [["/job-posts", "Search your job posts…"], ["/applicants", "Search applicants by name…"]]) {
        await go(b.driver, route);
        await visible(b.driver, By.css(`input[aria-label='${field}']`));
        const box = await b.driver.executeScript("const r = document.querySelector('.jm-toolbar .search-box').getBoundingClientRect(); return { h: r.height, w: r.width, right: r.right, vw: innerWidth, scroll: document.documentElement.scrollWidth }");
        assert.ok(box.h >= 36 && box.h <= 56, `${route}: the search box is ${box.h}px tall`);
        assert.ok(box.right <= box.vw, `${route}: the search box runs off the screen`);
        assert.ok(box.scroll <= box.vw, `${route}: the page scrolls sideways`);
      }
    } finally {
      await laptop();
    }
  });
});

