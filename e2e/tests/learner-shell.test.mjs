import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { By, Key, acceptConfirm, apiOk, bodyText, chooseOption, click, clickLink, count, currentPath, exists, find, go, hasText, isShown, signIn, sleep, texts, type, useBrowser, visible, waitGone, waitNoText, waitText, waitUrl, xText } from "../lib/browser.mjs";
import { goSidebar, logout, openProfileMenu, pageTitle, sidebarCaptions, sidebarItems, waitWorkspace } from "../lib/flows.mjs";
import { makeLearner, makePost, notificationsOf } from "../lib/factory.mjs";

const LEARNER_MENU = ["Dashboard", "Showcase", "Courses", "Contests", "Webinars", "Jobs", "AI Assistant", "Communities", "Messages", "Notifications", "Profile"];

describe("Learner · Navigation", () => {
  const b = useBrowser();

  it("the sidebar groups the menu under Overview, Workspace and Social", async () => {
    await signIn(b.driver, "learner");
    await go(b.driver, "/dashboard");
    await waitWorkspace(b.driver);
    assert.deepEqual(await sidebarCaptions(b.driver), ["OVERVIEW", "WORKSPACE", "SOCIAL"]);
  });

  it("a learner's menu has exactly the learner features", async () => {
    await signIn(b.driver, "learner");
    await go(b.driver, "/dashboard");
    assert.deepEqual(await sidebarItems(b.driver), LEARNER_MENU);
  });

  it("the profile card at the bottom shows the learner's name and role", async () => {
    await signIn(b.driver, "learner");
    await go(b.driver, "/dashboard");
    await waitWorkspace(b.driver);
    assert.equal(await (await find(b.driver, By.css(".sidebar .profile .name"))).getText(), "Lena Learner");
    assert.equal((await (await find(b.driver, By.css(".sidebar .profile .role-label"))).getText()).toLowerCase(), "learner");
  });

  for (const [label, route, title] of [
    ["Dashboard", "/dashboard", "Dashboard"],
    ["Showcase", "/showcase", "Showcase"],
    ["Courses", "/courses", "Courses"],
    ["Contests", "/contests", "Contests"],
    ["Webinars", "/webinars", "Webinars"],
    ["Jobs", "/jobs", "Jobs"],
    ["AI Assistant", "/ai", "AI Assistant"],
    ["Communities", "/communities", "Communities"],
    ["Messages", "/messages", "Messages"],
    ["Notifications", "/notifications", "Notifications"],
    ["Profile", "/profile", "Profile"],
  ])
    it(`the "${label}" menu item opens ${route} and the top bar says "${title}"`, async () => {
      await signIn(b.driver, "learner");
      await go(b.driver, label === "Dashboard" ? "/showcase" : "/dashboard");
      await waitWorkspace(b.driver);
      await goSidebar(b.driver, label);
      await waitUrl(b.driver, new RegExp(`^${route}`));
      await b.driver.wait(async () => (await pageTitle(b.driver)) === title, 8000, `title was ${await pageTitle(b.driver)}`);
      const active = await texts(b.driver, By.css(".sidebar nav a.active"));
      assert.ok(active.some((text) => text.startsWith(label)), `active item: ${active}`);
    });

  it("workspace pages meant for other roles show 'Access restricted' with a way back", async () => {
    await signIn(b.driver, "learner");
    for (const route of ["/admin", "/moderation", "/settings", "/job-management"]) {
      await go(b.driver, route);
      await waitText(b.driver, "Access restricted");
      await waitText(b.driver, "This page isn’t available for your role.");
    }
    await clickLink(b.driver, "Back to dashboard");
    await waitUrl(b.driver, /^\/dashboard/);
    await waitText(b.driver, "Courses enrolled");
  });

  it("the profile menu leads to the profile page and offers Sign out", async () => {
    await signIn(b.driver, "learner");
    await go(b.driver, "/dashboard");
    await openProfileMenu(b.driver);
    assert.ok(await isShown(b.driver, xText("Sign out", { tag: "button" })));
    await click(b.driver, By.xpath("//aside//div[contains(@class,'floating-menu')]//a[contains(normalize-space(.),'Profile')]"));
    await waitUrl(b.driver, /^\/profile/);
  });
});

describe("Learner · Dashboard", () => {
  const b = useBrowser();

  it("greets the learner by first name", async () => {
    await signIn(b.driver, "learner");
    await go(b.driver, "/dashboard");
    await b.driver.wait(async () => /^Good (morning|afternoon|evening), Lena!/.test(await (await find(b.driver, By.css(".ld-hero h1"))).getText()), 10000);
  });

  it("shows the six activity tiles", async () => {
    await signIn(b.driver, "learner");
    await go(b.driver, "/dashboard");
    await waitText(b.driver, "Courses enrolled");
    assert.deepEqual(await texts(b.driver, By.css(".ld-tile > span:last-child")), ["Courses enrolled", "Courses completed", "Contests joined", "Podium finishes", "Webinars booked", "Communities"]);
  });

  for (const [label, route] of [["Courses enrolled", "/courses"], ["Contests joined", "/contests"], ["Webinars booked", "/webinars"], ["Communities", "/communities"]])
    it(`the "${label}" tile opens ${route}`, async () => {
      await signIn(b.driver, "learner");
      await go(b.driver, "/dashboard");
      await click(b.driver, By.xpath(`//a[contains(@class,'ld-tile')][contains(normalize-space(.), '${label}')]`));
      await waitUrl(b.driver, new RegExp(`^${route}`));
    });

  it("a brand new learner sees zeros and a nudge to start", async () => {
    const fresh = await makeLearner("fresh");
    await signIn(b.driver, fresh);
    await go(b.driver, "/dashboard");
    await waitText(b.driver, "Start your first course, join a contest or ask the AI assistant anything.");
    const numbers = await texts(b.driver, By.css(".ld-tile > strong"));
    assert.deepEqual(numbers, ["0", "0", "0", "0", "0", "0"]);
    await waitText(b.driver, "Your learning journey starts here");
  });

  it("'Explore courses' and 'Ask AI' lead to their pages", async () => {
    const fresh = await makeLearner("nudge");
    await signIn(b.driver, fresh);
    await go(b.driver, "/dashboard");
    await clickLink(b.driver, "Explore courses");
    await waitUrl(b.driver, /^\/courses/);
    await go(b.driver, "/dashboard");
    await clickLink(b.driver, "Ask AI");
    await waitUrl(b.driver, /^\/ai/);
  });

  it("recommends new published courses that match the learner's interests, never drafts", async () => {
    const { makeCourse } = await import("../lib/factory.mjs");
    const shown = await makeCourse({ title: `Recommended ${Date.now().toString(36)}`, category: "web" });
    const hidden = await makeCourse({ title: `Hidden draft ${Date.now().toString(36)}`, category: "web", status: "draft" });
    await signIn(b.driver, "learner");
    await go(b.driver, "/dashboard");
    await waitText(b.driver, "Recommended for you");
    await waitText(b.driver, shown.title);
    assert.equal(await hasText(b.driver, hidden.title), false);
  });

  it("the enrolment count and 'Continue learning' follow the learner's progress", async () => {
    const learner = await makeLearner("progress");
    const { makeCourse } = await import("../lib/factory.mjs");
    const course = await makeCourse({ materials: [{ name: "Part A", text: "A", preview: true }, { name: "Part B", text: "B" }] });
    await apiOk(learner, `courses/${course.id}/enroll`, { method: "POST" });
    await apiOk(learner, `frontend/courses/${course.id}/complete/${course.materials[0].id}`, { method: "PUT" });
    await signIn(b.driver, learner);
    await go(b.driver, "/dashboard");
    await waitText(b.driver, "Courses enrolled");
    assert.equal((await texts(b.driver, By.css(".ld-tile > strong")))[0], "1");
    await waitText(b.driver, "1/2 materials");
    assert.ok(await isShown(b.driver, xText("Continue learning", { tag: "a" })));
  });
});

describe("Learner · Sidebar, theme and layout", () => {
  const b = useBrowser();
  const shell = () => b.driver.executeScript("return document.querySelector('.app-shell').className");
  const sidebarWidth = () => b.driver.executeScript("return Math.round(document.querySelector('.sidebar').getBoundingClientRect().width)");

  it("the sidebar can be collapsed to icons only and opened again", async () => {
    await signIn(b.driver, "learner");
    await b.driver.manage().addCookie({ name: "ud_sidebar", value: "open", path: "/" });
    await go(b.driver, "/dashboard");
    await waitWorkspace(b.driver);
    assert.equal(await sidebarWidth(), 264);
    assert.ok(await isShown(b.driver, By.css(".sidebar .brand-text")));
    await click(b.driver, By.css("button[aria-label='Collapse sidebar']"));
    await b.driver.wait(async () => (await sidebarWidth()) === 76, 5000);
    assert.match(await shell(), /sidebar-collapsed/);
    assert.equal(await isShown(b.driver, By.css(".sidebar .brand-text")), false, "logo text is hidden");
    assert.equal(await isShown(b.driver, By.css(".sidebar .nav-label")), false, "menu labels are hidden");
    assert.ok(await isShown(b.driver, By.css(".sidebar .brand-symbol")), "the logo icon stays");
    assert.ok(await isShown(b.driver, By.css(".sidebar nav a svg")), "menu icons stay");
    assert.ok(await isShown(b.driver, By.css(".sidebar .profile .avatar")), "the profile picture stays");
    assert.equal(await isShown(b.driver, By.css(".sidebar .profile .details")), false);
    await click(b.driver, By.css("button[aria-label='Expand sidebar']"));
    await b.driver.wait(async () => (await sidebarWidth()) === 264, 5000);
    assert.ok(await isShown(b.driver, By.css(".sidebar .nav-label")));
  });

  it("the collapsed sidebar is remembered after a reload", async () => {
    await signIn(b.driver, "learner");
    await go(b.driver, "/dashboard");
    await waitWorkspace(b.driver);
    if (!/sidebar-collapsed/.test(await shell())) await click(b.driver, By.css("button[aria-label='Collapse sidebar']"));
    await b.driver.wait(async () => /sidebar-collapsed/.test(await shell()), 5000);
    await b.driver.navigate().refresh();
    await waitWorkspace(b.driver);
    assert.match(await shell(), /sidebar-collapsed/);
    await go(b.driver, "/courses");
    assert.match(await shell(), /sidebar-collapsed/, "also on other pages");
    await click(b.driver, By.css("button[aria-label='Expand sidebar']"));
    await b.driver.wait(async () => !/sidebar-collapsed/.test(await shell()), 5000);
  });

  it("in the collapsed sidebar every icon still has its name as a tooltip", async () => {
    await signIn(b.driver, "learner");
    await go(b.driver, "/dashboard");
    await waitWorkspace(b.driver);
    if (!/sidebar-collapsed/.test(await shell())) await click(b.driver, By.css("button[aria-label='Collapse sidebar']"));
    const titles = await b.driver.executeScript("return [...document.querySelectorAll('.sidebar nav a')].map(a => a.title)");
    assert.deepEqual(titles, LEARNER_MENU);
    await click(b.driver, By.css("button[aria-label='Expand sidebar']"));
  });

  it("the profile picture opens the profile menu while the sidebar is collapsed", async () => {
    await signIn(b.driver, "learner");
    await go(b.driver, "/dashboard");
    await waitWorkspace(b.driver);
    if (!/sidebar-collapsed/.test(await shell())) await click(b.driver, By.css("button[aria-label='Collapse sidebar']"));
    await b.driver.wait(async () => (await sidebarWidth()) === 76, 5000);
    await click(b.driver, By.css(".sidebar .profile .user"));
    await visible(b.driver, By.css(".sidebar .floating-menu"));
    assert.ok(await isShown(b.driver, xText("Sign out", { tag: "button" })));
    await click(b.driver, By.css("button[aria-label='Expand sidebar']"));
  });

  it("the theme switch changes the look and is remembered after a reload", async () => {
    await signIn(b.driver, "learner");
    await go(b.driver, "/dashboard");
    await b.driver.executeScript("localStorage.setItem('ud-theme','light')");
    await b.driver.navigate().refresh();
    await waitWorkspace(b.driver);
    const mode = () => b.driver.executeScript("return document.documentElement.dataset.theme");
    assert.equal(await mode(), "light");
    await click(b.driver, By.css("button[aria-label='Switch to dark mode']"));
    await b.driver.wait(async () => (await mode()) === "dark", 5000);
    await b.driver.navigate().refresh();
    await waitWorkspace(b.driver);
    await b.driver.wait(async () => (await mode()) === "dark", 5000);
    await click(b.driver, By.css("button[aria-label='Switch to light mode']"));
    await b.driver.wait(async () => (await mode()) === "light", 5000);
  });

  it("on a phone the menu is a drawer opened by the menu button and closed by the overlay", async () => {
    await signIn(b.driver, "learner");
    await go(b.driver, "/dashboard");
    await waitWorkspace(b.driver);
    const original = await b.driver.manage().window().getRect();
    await b.driver.manage().window().setRect({ width: 390, height: 844 });
    try {
      await sleep(400);
      assert.equal(await isShown(b.driver, By.css(".sidebar.open")), false);
      await click(b.driver, By.css("button[aria-label='Open navigation']"));
      await visible(b.driver, By.css(".sidebar.open"));
      await click(b.driver, By.css("button.sidebar-overlay"));
      await waitGone(b.driver, By.css(".sidebar.open"));
      await click(b.driver, By.css("button[aria-label='Open navigation']"));
      await click(b.driver, By.xpath("//aside//nav//a[contains(normalize-space(.),'Courses')]"));
      await waitUrl(b.driver, /^\/courses/);
      await waitGone(b.driver, By.css(".sidebar.open"));
    } finally {
      await b.driver.manage().window().setRect(original);
    }
  });
});

describe("Learner · Search", () => {
  const b = useBrowser();
  const box = By.css("input[aria-label='Search Uddeepto']");

  it("typing in the top bar lists matching results grouped by kind", async () => {
    await signIn(b.driver, "learner");
    await go(b.driver, "/dashboard");
    await type(b.driver, box, "React");
    await visible(b.driver, By.css(".gs-panel"));
    await waitText(b.driver, "React Basics");
    assert.ok(await isShown(b.driver, By.css(".gs-group[aria-label='Courses']")));
  });

  it("clicking a result opens it", async () => {
    await signIn(b.driver, "learner");
    await go(b.driver, "/dashboard");
    await type(b.driver, box, "React Basics");
    await click(b.driver, By.xpath("//div[contains(@class,'gs-panel')]//a[contains(normalize-space(.),'React Basics')]"));
    await waitUrl(b.driver, /^\/courses\//);
    await waitText(b.driver, "React Basics");
  });

  it("people can be found by name", async () => {
    await signIn(b.driver, "learner");
    await go(b.driver, "/dashboard");
    await type(b.driver, box, "Liam");
    await waitText(b.driver, "Liam Learner");
    assert.ok(await isShown(b.driver, By.css(".gs-group[aria-label='People']")));
  });

  it("one character asks for more", async () => {
    await signIn(b.driver, "learner");
    await go(b.driver, "/dashboard");
    await type(b.driver, box, "R");
    await waitText(b.driver, "Keep typing - at least 2 characters.");
  });

  it("pressing Enter opens the full search page", async () => {
    await signIn(b.driver, "learner");
    await go(b.driver, "/dashboard");
    await type(b.driver, box, "Sprint", { enter: true });
    await waitUrl(b.driver, "/search?q=Sprint");
    await waitText(b.driver, "Live Code Sprint");
  });

  it("the slash key jumps to the search box from anywhere", async () => {
    await signIn(b.driver, "learner");
    await go(b.driver, "/courses");
    await waitWorkspace(b.driver);
    await b.driver.findElement(By.css("body")).sendKeys("/");
    await b.driver.wait(async () => (await b.driver.switchTo().activeElement().getAttribute("aria-label")) === "Search Uddeepto", 5000);
  });

  it("Escape closes the results", async () => {
    await signIn(b.driver, "learner");
    await go(b.driver, "/dashboard");
    await type(b.driver, box, "React");
    await visible(b.driver, By.css(".gs-panel"));
    await (await find(b.driver, box)).sendKeys(Key.ESCAPE);
    await waitGone(b.driver, By.css(".gs-panel"));
  });

  it("the search page has a tab per kind with counts, and a tab narrows the list", async () => {
    await signIn(b.driver, "learner");
    await go(b.driver, "/search?q=Liam");
    await waitText(b.driver, "Liam Learner");
    const tabs = await texts(b.driver, By.css("[role=tab]"));
    assert.ok(tabs.some((t) => /^All \d+/.test(t)) && tabs.some((t) => /^People \d+/.test(t)) && tabs.some((t) => /^Courses 0/.test(t)), tabs.join(" | "));
    await click(b.driver, By.xpath("//button[@role='tab'][contains(normalize-space(.),'People')]"));
    await waitUrl(b.driver, "tab=users");
    await waitText(b.driver, "Liam Learner");
  });

  it("a search nobody can answer says so", async () => {
    await signIn(b.driver, "learner");
    await go(b.driver, "/search?q=qqqqzzzzxxxx");
    await waitText(b.driver, "No results for “qqqqzzzzxxxx”");
  });

  it("the search page button needs at least two characters", async () => {
    await signIn(b.driver, "learner");
    await go(b.driver, "/search");
    await waitText(b.driver, "Search everything on Uddeepto");
    const button = By.xpath("//form[contains(@class,'search-hero')]//button");
    assert.equal(await (await find(b.driver, button)).isEnabled(), false);
    await type(b.driver, By.css("form.search-hero input"), "ab");
    assert.equal(await (await find(b.driver, button)).isEnabled(), true);
  });

  it("jobs, contests and webinars appear in the results too", async () => {
    await signIn(b.driver, "learner");
    await go(b.driver, "/search?q=Engineer");
    await waitText(b.driver, "Frontend Engineer");
    await go(b.driver, "/search?q=Upcoming");
    await waitText(b.driver, "Upcoming API Webinar");
  });
});

describe("Learner · Notification badge", () => {
  const b = useBrowser();

  it("the Notifications menu item shows how many are unread and updates by itself", async () => {
    const fresh = await makeLearner("badge");
    const mine = await makePost({ author: fresh });
    await signIn(b.driver, fresh);
    await go(b.driver, "/dashboard");
    await waitWorkspace(b.driver);
    const badge = By.css(".sidebar nav a .nav-badge");
    // Every new account starts with one unread notification: the welcome message.
    await b.driver.wait(async () => (await exists(b.driver, badge)) && (await (await find(b.driver, badge)).getText()) === "1", 15000, "badge never showed the welcome notification");
    await apiOk("learner2", `frontend/showcase/${mine.id}/reaction`, { method: "PUT", body: { reaction: "love" } });
    await b.driver.wait(async () => (await exists(b.driver, badge)) && (await (await find(b.driver, badge)).getText()) === "2", 20000, "badge never reached 2");
  });
});
