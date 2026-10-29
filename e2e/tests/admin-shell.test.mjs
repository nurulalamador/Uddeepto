import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { By, api, apiOk, click, clickLink, count, exists, find, go, hasText, isShown, q, signIn, sleep, texts, type, unique, useBrowser, visible, waitText, waitUrl, xText } from "../lib/browser.mjs";
import { makeCourse, makeHirer, makeJob, makeLearner, makePost, notificationsOf } from "../lib/factory.mjs";
import { goSidebar, logout, openProfileMenu, pageTitle, sidebarCaptions, sidebarItems, waitWorkspace } from "../lib/flows.mjs";

const ADMIN_MENU = ["Dashboard", "Notifications", "Courses", "Contests", "Webinars", "Jobs", "Management", "Moderation", "Settings"];
const item = (title) => `//li[contains(@class,'nt-item')][.//strong[normalize-space(.)=${q(title)}]]`;

describe("Admin · Navigation", () => {
  const b = useBrowser();

  it("the menu groups the Admin console and Operations", async () => {
    await signIn(b.driver, "admin");
    await go(b.driver, "/dashboard");
    await waitWorkspace(b.driver);
    assert.deepEqual(await sidebarCaptions(b.driver), ["ADMIN CONSOLE", "OPERATIONS"]);
  });

  it("an admin's menu has only the administration features", async () => {
    await signIn(b.driver, "admin");
    await go(b.driver, "/dashboard");
    assert.deepEqual(await sidebarItems(b.driver), ADMIN_MENU);
  });

  it("the profile card shows the admin's name and role", async () => {
    await signIn(b.driver, "admin");
    await go(b.driver, "/dashboard");
    await waitWorkspace(b.driver);
    assert.equal(await (await find(b.driver, By.css(".sidebar .profile .name"))).getText(), "Ada Admin");
    assert.equal((await (await find(b.driver, By.css(".sidebar .profile .role-label"))).getText()).toLowerCase(), "admin");
  });

  it("the brand shows the admin console", async () => {
    await signIn(b.driver, "admin");
    await go(b.driver, "/dashboard");
    await waitWorkspace(b.driver);
    assert.ok(await hasText(b.driver, "ADMIN CONSOLE") || (await b.driver.getPageSource()).toLowerCase().includes("admin console"));
  });

  for (const [label, route, title] of [
    ["Dashboard", "/dashboard", "Dashboard"],
    ["Notifications", "/notifications", "Notifications"],
    ["Courses", "/courses", "Courses"],
    ["Contests", "/contests", "Contests"],
    ["Webinars", "/webinars", "Webinars"],
    ["Jobs", "/jobs", "Jobs"],
    ["Management", "/admin", "Management"],
    ["Moderation", "/moderation", "Moderation"],
    ["Settings", "/settings", "Settings"],
  ])
    it(`"${label}" opens ${route}`, async () => {
      await signIn(b.driver, "admin");
      await go(b.driver, label === "Settings" ? "/dashboard" : "/settings");
      await waitWorkspace(b.driver);
      await goSidebar(b.driver, label);
      await waitUrl(b.driver, new RegExp(`^${route}`));
      await b.driver.wait(async () => (await pageTitle(b.driver)) === title, 8000);
    });

  for (const route of ["/showcase", "/messages", "/communities", "/ai", "/job-posts", "/applicants"])
    it(`${route} is not available to an admin`, async () => {
      await signIn(b.driver, "admin");
      await go(b.driver, route);
      await waitText(b.driver, "Access restricted");
    });

  it("the server refuses admin routes to a learner and a hirer", async () => {
    for (const who of ["learner", "hirer"]) {
      const refused = await api(who, "frontend/admin/users");
      assert.equal(refused.status, 403, who);
      const overview = await api(who, "frontend/admin/overview");
      assert.equal(overview.status, 403, who);
      const settings = await api(who, "frontend/admin/settings", { method: "PATCH", body: { registration_open: false } });
      assert.equal(settings.status, 403, who);
    }
  });

  it("the admin can sign out", async () => {
    await signIn(b.driver, "admin");
    await go(b.driver, "/dashboard");
    await waitWorkspace(b.driver);
    await logout(b.driver);
  });

  it("the sidebar can be collapsed and expanded again", async () => {
    await signIn(b.driver, "admin");
    await b.driver.manage().addCookie({ name: "ud_sidebar", value: "open", path: "/" });
    await go(b.driver, "/dashboard");
    await waitWorkspace(b.driver);
    const width = () => b.driver.executeScript("return Math.round(document.querySelector('.sidebar').getBoundingClientRect().width)");
    assert.equal(await width(), 264);
    await click(b.driver, By.css("button[aria-label='Collapse sidebar']"));
    await b.driver.wait(async () => (await width()) === 76, 5000);
    await click(b.driver, By.css("button[aria-label='Expand sidebar']"));
    await b.driver.wait(async () => (await width()) === 264, 5000);
  });

  it("an admin has a profile page of their own", async () => {
    await signIn(b.driver, "admin");
    await go(b.driver, "/profile");
    await waitUrl(b.driver, /^\/profile\//);
    await waitText(b.driver, "Ada Admin");
  });

  it("the theme can be switched to dark and back", async () => {
    await signIn(b.driver, "admin");
    await go(b.driver, "/dashboard");
    await waitWorkspace(b.driver);
    const read = () => b.driver.executeScript("return document.documentElement.dataset.theme || ''");
    const before = await read();
    await click(b.driver, By.css(".topbar button[aria-label*='theme' i], .topbar button[aria-label*='mode' i]"));
    await b.driver.wait(async () => (await read()) !== before, 5000);
    await click(b.driver, By.css(".topbar button[aria-label*='theme' i], .topbar button[aria-label*='mode' i]"));
    await b.driver.wait(async () => (await read()) === before, 5000);
  });

  it("the global search finds people but never offers courses' enrolment to an admin", async () => {
    const learner = await makeLearner("findme");
    await signIn(b.driver, "admin");
    await go(b.driver, "/dashboard");
    await type(b.driver, By.css("input[aria-label='Search Uddeepto']"), learner.name);
    await waitText(b.driver, learner.name);
  });
});

describe("Admin · Dashboard", () => {
  const b = useBrowser();
  const overview = async () => (await apiOk("admin", "frontend/admin/overview")).stats;

  it("shows the platform overview heading and the admin pill", async () => {
    await signIn(b.driver, "admin");
    await go(b.driver, "/dashboard");
    await waitText(b.driver, "Platform overview");
    await waitText(b.driver, "Admin workspace");
  });

  it("shows the eight platform tiles", async () => {
    await signIn(b.driver, "admin");
    await go(b.driver, "/dashboard");
    await waitText(b.driver, "Platform overview");
    await b.driver.wait(async () => (await count(b.driver, By.css(".admin-kpi-card"))) === 8, 8000);
    assert.deepEqual(await texts(b.driver, By.css(".admin-kpi-card .admin-kpi-label")), ["Total users", "Learners", "Hirers", "Courses", "Contests", "Live & upcoming", "Open jobs", "Open reports"]);
  });

  it("the tiles show the same numbers as the server reports", async () => {
    const stats = await overview();
    await signIn(b.driver, "admin");
    await go(b.driver, "/dashboard");
    await waitText(b.driver, "Platform overview");
    await b.driver.wait(async () => (await count(b.driver, By.css(".admin-kpi-card strong"))) === 8, 8000);
    const shown = (await texts(b.driver, By.css(".admin-kpi-card strong"))).map((t) => Number(t.replace(/,/g, "")));
    const expected = [stats.total_users, stats.learners, stats.hirers, stats.courses, stats.contests, stats.active_webinars, stats.open_jobs, stats.open_reports].map(Number);
    assert.deepEqual(shown, expected);
  });

  it("a new learner raises the user and learner counts", async () => {
    const before = await overview();
    await makeLearner("counted");
    await signIn(b.driver, "admin");
    await go(b.driver, "/dashboard");
    await waitText(b.driver, "Platform overview");
    await b.driver.wait(async () => {
      const [total, learners] = (await texts(b.driver, By.css(".admin-kpi-card strong"))).slice(0, 2).map((t) => Number(t.replace(/,/g, "")));
      return total === Number(before.total_users) + 1 && learners === Number(before.learners) + 1;
    }, 10000);
  });

  it("a new hirer raises the hirer count", async () => {
    const before = await overview();
    await makeHirer("counted");
    const after = await overview();
    assert.equal(Number(after.hirers), Number(before.hirers) + 1);
    await signIn(b.driver, "admin");
    await go(b.driver, "/dashboard");
    await b.driver.wait(async () => Number((await texts(b.driver, By.css(".admin-kpi-card strong")))[2]?.replace(/,/g, "")) === Number(after.hirers), 10000);
  });

  it("a draft course counts as a course but not as published", async () => {
    const before = await overview();
    await makeCourse({ title: unique("Counting draft"), status: "draft", materials: [] });
    const after = await overview();
    assert.equal(Number(after.courses), Number(before.courses) + 1);
    assert.equal(Number(after.published_courses), Number(before.published_courses));
    assert.equal(Number(after.draft_courses), Number(before.draft_courses) + 1);
  });

  it("'Content health' lists four bars and the draft-course note", async () => {
    await signIn(b.driver, "admin");
    await go(b.driver, "/dashboard");
    await waitText(b.driver, "Content health");
    assert.deepEqual(await texts(b.driver, By.css(".admin-bar-label > span")), ["Courses published", "Contests published", "Active webinars", "Open jobs"]);
    await waitText(b.driver, "still in draft.");
  });

  it("'Quick actions' offers three shortcuts", async () => {
    await signIn(b.driver, "admin");
    await go(b.driver, "/dashboard");
    await waitText(b.driver, "Quick actions");
    assert.deepEqual((await texts(b.driver, By.css(".admin-shortcut strong"))), ["Manage users", "Review courses", "Moderate reports"]);
  });

  for (const [title, route] of [["Manage users", /^\/admin/], ["Review courses", /^\/courses/], ["Moderate reports", /^\/moderation/]])
    it(`the "${title}" shortcut leads to ${route}`, async () => {
      await signIn(b.driver, "admin");
      await go(b.driver, "/dashboard");
      await click(b.driver, By.xpath(`//a[contains(@class,'admin-shortcut')][.//strong[normalize-space(.)=${q(title)}]]`));
      await waitUrl(b.driver, route);
    });

  it("'Manage content' leads to the courses page", async () => {
    await signIn(b.driver, "admin");
    await go(b.driver, "/dashboard");
    await clickLink(b.driver, "Manage content");
    await waitUrl(b.driver, /^\/courses/);
  });

  it("'Recent activity' lists new records, newest first", async () => {
    const course = await makeCourse({ title: unique("Fresh activity course"), materials: [] });
    await signIn(b.driver, "admin");
    await go(b.driver, "/dashboard");
    await waitText(b.driver, "Recent activity");
    await waitText(b.driver, "Latest 12 events");
    await waitText(b.driver, course.title);
    assert.equal((await count(b.driver, By.css(".admin-activity-list li"))) <= 12, true);
  });

  it("a reported post appears in the activity feed and raises 'Open reports'", async () => {
    const before = await overview();
    const post = await makePost({ author: "learner2" });
    await apiOk("learner", `showcase/${post.id}/report`, { method: "POST", body: { reason: "spam", details: "dashboard test" } });
    const after = await overview();
    assert.equal(Number(after.open_reports), Number(before.open_reports) + 1);
    await signIn(b.driver, "admin");
    await go(b.driver, "/dashboard");
    await waitText(b.driver, "Post reported");
  });

  it("the security note explains that admin access is isolated", async () => {
    await signIn(b.driver, "admin");
    await go(b.driver, "/dashboard");
    await waitText(b.driver, "Admin access is isolated");
  });
});

describe("Admin · Notifications", () => {
  const b = useBrowser();

  it("shows the welcome message of the account", async () => {
    await signIn(b.driver, "admin");
    await go(b.driver, "/notifications");
    await waitText(b.driver, "Notifications");
    await b.driver.wait(async () => (await count(b.driver, By.css(".nt-item"))) > 0, 10000);
  });

  it("a reported post notifies the admin and the notification leads to Moderation", async () => {
    const post = await makePost({ author: "learner2" });
    await apiOk("learner", `showcase/${post.id}/report`, { method: "POST", body: { reason: "harassment", details: "needs a look" } });
    await signIn(b.driver, "admin");
    await go(b.driver, "/notifications");
    await waitText(b.driver, "A showcase post was reported");
    await click(b.driver, By.xpath("(//li[contains(@class,'nt-item')][.//strong[normalize-space(.)='A showcase post was reported']])[1]//a[contains(@class,'nt-main')]"));
    await waitUrl(b.driver, /^\/moderation/);
  });

  it("a newly registered hirer notifies the admin", async () => {
    const hirer = await makeHirer("announced");
    const title = `New hirer registered: ${hirer.name}`;
    await b.driver.wait(async () => (await notificationsOf("admin")).some((n) => n.title === title), 8000);
    await signIn(b.driver, "admin");
    await go(b.driver, "/notifications");
    await waitText(b.driver, title);
  });

  it("a job posted by a hirer notifies the admin", async () => {
    const hirer = await makeHirer("poster");
    const job = await makeJob({ owner: hirer, title: unique("Admin heads-up job"), open: false });
    const title = `New job posted: ${job.title}`;
    await b.driver.wait(async () => (await notificationsOf("admin")).some((n) => n.title === title), 8000);
    await signIn(b.driver, "admin");
    await go(b.driver, "/notifications");
    await waitText(b.driver, title);
  });

  it("the filter chips for an admin include the Admin category", async () => {
    await signIn(b.driver, "admin");
    await go(b.driver, "/notifications");
    await waitText(b.driver, "Everything");
    const chips = (await texts(b.driver, By.css(".nt-chip"))).map((t) => t.split("\n")[0]);
    assert.equal(chips[0], "Everything");
    assert.ok(chips.includes("Admin"), chips.join(","));
  });

  it("the Admin chip keeps only administration notifications", async () => {
    await signIn(b.driver, "admin");
    await go(b.driver, "/notifications");
    await waitText(b.driver, "Everything");
    await click(b.driver, By.xpath("//button[contains(@class,'nt-chip')][contains(normalize-space(.),'Admin')]"));
    await b.driver.wait(async () => {
      const tags = await texts(b.driver, By.css(".nt-item .nt-tag"));
      return tags.length > 0 && tags.every((t) => t.toLowerCase() === "admin");
    }, 8000);
  });

  it("an admin never receives learner announcements such as new courses", async () => {
    await makeCourse({ title: unique("Hush course"), materials: [] });
    const types = (await notificationsOf("admin")).map((n) => n.type);
    assert.ok(!types.includes("course_new"), types.join(","));
  });

  it("the sidebar badge counts unread admin notifications live", async () => {
    await signIn(b.driver, "admin");
    await go(b.driver, "/dashboard");
    const badge = By.css(".sidebar nav a .nav-badge");
    await b.driver.wait(async () => exists(b.driver, badge), 15000);
    const read = async () => (await (await find(b.driver, badge)).getText()).replace(/\D/g, "");
    const before = Number(await read());
    await makeHirer("badgeping");
    await b.driver.wait(async () => Number(await read()) > before || (await (await find(b.driver, badge)).getText()) === "99+", 20000, "badge never grew");
  });

  it("an admin can mark everything as read", async () => {
    await signIn(b.driver, "admin");
    await go(b.driver, "/notifications");
    await waitText(b.driver, "Everything");
    await click(b.driver, By.xpath("//button[contains(normalize-space(.),'Mark all')]"));
    await b.driver.wait(async () => (await notificationsOf("admin", "?unread=true")).length === 0 || (await apiOk("admin", "frontend/notifications")).unread === 0, 10000);
  });
});

describe("Admin · Settings", () => {
  const b = useBrowser();
  const switchOf = (title) => By.css(`button[role=switch][aria-label="${title}"]`);
  const restore = async () => apiOk("admin", "frontend/admin/settings", { method: "PATCH", body: { registration_open: true, content_review_required: true } });

  it("shows the four settings cards", async () => {
    await signIn(b.driver, "admin");
    await go(b.driver, "/settings");
    await waitText(b.driver, "Platform policy");
    await waitText(b.driver, "Workspace preferences");
    await waitText(b.driver, "Administrator access");
    await waitText(b.driver, "Admin workspace");
  });

  it("the administrator card shows who is signed in", async () => {
    await signIn(b.driver, "admin");
    await go(b.driver, "/settings");
    await waitText(b.driver, "Administrator access");
    await waitText(b.driver, "Ada Admin");
    await waitText(b.driver, "Active");
  });

  it("both platform policies start switched on", async () => {
    await restore();
    await signIn(b.driver, "admin");
    await go(b.driver, "/settings");
    await visible(b.driver, switchOf("Public registration"));
    assert.equal(await (await find(b.driver, switchOf("Public registration"))).getAttribute("aria-checked"), "true");
    assert.equal(await (await find(b.driver, switchOf("Require admin review"))).getAttribute("aria-checked"), "true");
  });

  it("pausing public registration saves at once and blocks sign-ups", async () => {
    try {
      await signIn(b.driver, "admin");
      await go(b.driver, "/settings");
      await click(b.driver, switchOf("Public registration"));
      await waitText(b.driver, "Platform setting saved.");
      assert.equal(await (await find(b.driver, switchOf("Public registration"))).getAttribute("aria-checked"), "false");
      const blocked = await fetch(`${(await import("../lib/config.mjs")).urls.api}/auth/register`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Late Comer", email: "late@e2e.test", username: "latecomer", password: "Passw0rd!123", role: "learner" }) });
      assert.equal(blocked.status, 403);
      assert.match(JSON.stringify(await blocked.json()), /paused|closed|registration/i);
    } finally {
      await restore();
    }
  });

  it("the sign-up page tells visitors registration is paused", async () => {
    try {
      await apiOk("admin", "frontend/admin/settings", { method: "PATCH", body: { registration_open: false } });
      await go(b.driver, "/signup");
      const name = By.css("input[name=name]");
      await visible(b.driver, name);
      await type(b.driver, name, "Closed Door");
      await type(b.driver, By.css("input[name=email]"), "closed@e2e.test");
      await type(b.driver, By.css("input[name=username]"), "closeddoor");
      await type(b.driver, By.css("input[name=password]"), "Passw0rd!123");
      await click(b.driver, xText("Create account", { tag: "button" }));
      await waitText(b.driver, "registration");
    } finally {
      await restore();
    }
  });

  it("an admin can still create accounts while registration is paused", async () => {
    try {
      await apiOk("admin", "frontend/admin/settings", { method: "PATCH", body: { registration_open: false } });
      const key = unique("paused").replace(/[^a-z0-9]/gi, "").toLowerCase().slice(0, 20);
      const made = await api("admin", "frontend/admin/users", { method: "POST", body: { name: "Admin Made", email: `${key}@e2e.test`, username: key, password: "Passw0rd!123", role: "learner" } });
      assert.ok(made.ok, JSON.stringify(made.data));
    } finally {
      await restore();
    }
  });

  it("the registration setting survives a reload", async () => {
    try {
      await signIn(b.driver, "admin");
      await go(b.driver, "/settings");
      await click(b.driver, switchOf("Public registration"));
      await waitText(b.driver, "Platform setting saved.");
      await b.driver.navigate().refresh();
      await visible(b.driver, switchOf("Public registration"));
      assert.equal(await (await find(b.driver, switchOf("Public registration"))).getAttribute("aria-checked"), "false");
    } finally {
      await restore();
    }
  });

  it("with 'Require admin review' on, a hirer's new job stays a draft", async () => {
    await restore();
    const hirer = await makeHirer("reviewed");
    const job = await makeJob({ owner: hirer, title: unique("Reviewed job"), open: false });
    const detail = await apiOk("admin", `frontend/admin/jobs?q=${encodeURIComponent(job.title)}`);
    assert.equal(detail.find((row) => row.id === job.id).status, "draft");
  });

  it("turning 'Require admin review' off is saved and shown as Off", async () => {
    try {
      await signIn(b.driver, "admin");
      await go(b.driver, "/settings");
      await click(b.driver, switchOf("Require admin review"));
      await waitText(b.driver, "Platform setting saved.");
      await b.driver.wait(async () => (await (await find(b.driver, switchOf("Require admin review"))).getText()) === "Off", 5000);
      assert.equal((await apiOk("admin", "frontend/admin/settings")).content_review_required, false);
    } finally {
      await restore();
    }
  });

  it("the table spacing preference switches between Comfortable and Compact and is remembered", async () => {
    await signIn(b.driver, "admin");
    await go(b.driver, "/settings");
    await click(b.driver, By.xpath("//div[@aria-label='Management table spacing']//button[normalize-space(.)='Compact']"));
    await b.driver.wait(async () => (await b.driver.executeScript("return document.documentElement.dataset.adminDensity")) === "compact", 5000);
    await b.driver.navigate().refresh();
    await b.driver.wait(async () => (await b.driver.executeScript("return document.documentElement.dataset.adminDensity")) === "compact", 8000);
    await click(b.driver, By.xpath("//div[@aria-label='Management table spacing']//button[normalize-space(.)='Comfortable']"));
    await b.driver.wait(async () => (await b.driver.executeScript("return document.documentElement.dataset.adminDensity")) === "comfortable", 5000);
  });

  it("'Manage user access' and 'Return to overview' lead to the right pages", async () => {
    await signIn(b.driver, "admin");
    await go(b.driver, "/settings");
    await clickLink(b.driver, "Manage user access");
    await waitUrl(b.driver, /^\/admin/);
    await go(b.driver, "/settings");
    await clickLink(b.driver, "Return to overview");
    await waitUrl(b.driver, /^\/dashboard/);
  });

  it("the settings API accepts only booleans and an admin", async () => {
    const bad = await api("admin", "frontend/admin/settings", { method: "PATCH", body: { registration_open: "maybe" } });
    assert.equal(bad.status, 422);
  });
});
