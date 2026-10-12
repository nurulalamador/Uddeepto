import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { By, apiOk, click, clickButton, count, exists, find, go, hasText, hover, isShown, q, signIn, sleep, texts, unique, useBrowser, visible, waitGone, waitNoText, waitText, waitUrl, xText } from "../lib/browser.mjs";
import { makeLearner, makePost, notificationsOf } from "../lib/factory.mjs";

const items = (driver) => texts(driver, By.css(".nt-item .nt-text strong"));
const item = (title) => `//li[contains(@class,'nt-item')][.//strong[normalize-space(.)=${q(title)}]]`;
const badge = By.css(".sidebar nav a .nav-badge");
const like = (who, post) => apiOk(who, `frontend/showcase/${post.id}/reaction`, { method: "PUT", body: { reaction: "love" } });
const comment = (who, post, content) => apiOk(who, `frontend/showcase/${post.id}/comments`, { method: "POST", body: { content } });
const badgeText = async (driver) => ((await exists(driver, badge)) ? (await find(driver, badge)).getText() : "");

/** A learner with a post and `n` fresh social notifications on top of the welcome message. */
async function learnerWithNotifications(n = 2) {
  const me = await makeLearner("notified");
  const post = await makePost({ author: me });
  for (let i = 0; i < n; i += 1) await comment("learner2", post, `Comment number ${i + 1} ${unique("c")}`);
  return { me, post };
}

describe("Learner · Notifications page", () => {
  const b = useBrowser();

  it("lists notifications newest first with title, text, time and kind", async () => {
    const { me } = await learnerWithNotifications(1);
    await signIn(b.driver, me);
    await go(b.driver, "/notifications");
    await waitText(b.driver, "Liam Learner commented on your post");
    const first = await (await find(b.driver, By.css(".nt-item"))).getText();
    assert.match(first, /Liam Learner commented on your post/);
    assert.match(first, /Comment number 1/);
    assert.match(first, /just now|\dm ago/);
    assert.match(first, /social/i);
    assert.deepEqual((await items(b.driver)).slice(-1), [`Welcome to Uddeepto, ${me.name.split(" ")[0]}!`], "the welcome message is the oldest");
  });

  it("new notifications are marked with a dot and counted in the Unread tab", async () => {
    const { me } = await learnerWithNotifications(2);
    await signIn(b.driver, me);
    await go(b.driver, "/notifications");
    await waitText(b.driver, "Unread (3)");
    assert.equal(await count(b.driver, By.css(".nt-item .nt-dot")), 3);
  });

  it("the sidebar badge matches the unread count", async () => {
    const { me } = await learnerWithNotifications(2);
    await signIn(b.driver, me);
    await go(b.driver, "/notifications");
    await b.driver.wait(async () => (await badgeText(b.driver)) === "3", 10000);
  });

  it("the kind chips show how many unread each has and filter the list", async () => {
    const { me } = await learnerWithNotifications(2);
    await signIn(b.driver, me);
    await go(b.driver, "/notifications");
    await waitText(b.driver, "Unread (3)");
    const chips = await texts(b.driver, By.css(".nt-chip"));
    assert.ok(chips.some((t) => /^Social\s*2$/.test(t.replace(/\n/g, " "))), chips.join(" | "));
    assert.ok(chips.includes("Everything"));
    await click(b.driver, By.xpath("//button[contains(@class,'nt-chip')][contains(normalize-space(.),'Social')]"));
    await b.driver.wait(async () => (await count(b.driver, By.css(".nt-item"))) === 2, 8000);
    assert.ok((await items(b.driver)).every((t) => t.includes("commented on your post")));
  });

  it("a kind with nothing yet explains that", async () => {
    const me = await makeLearner("emptykind");
    await signIn(b.driver, me);
    await go(b.driver, "/notifications");
    await click(b.driver, By.xpath("//button[contains(@class,'nt-chip')][contains(normalize-space(.),'Jobs')]"));
    await waitText(b.driver, "No jobs notifications yet.");
  });

  it("clicking a notification opens what it is about and marks it read", async () => {
    const { me, post } = await learnerWithNotifications(1);
    await signIn(b.driver, me);
    await go(b.driver, "/notifications");
    await click(b.driver, By.xpath(item("Liam Learner commented on your post") + "//a[contains(@class,'nt-main')]"));
    await waitUrl(b.driver, `/showcase/${post.id}`);
    const stored = (await notificationsOf(me)).find((n) => n.type === "post_comment");
    assert.equal(stored.read, true);
  });

  it("the check button marks one notification read and again as unread", async () => {
    const { me } = await learnerWithNotifications(1);
    await signIn(b.driver, me);
    await go(b.driver, "/notifications");
    const row = item("Liam Learner commented on your post");
    await waitText(b.driver, "Unread (2)");
    await hover(b.driver, By.xpath(row));
    await click(b.driver, By.xpath(row + "//button[@title='Mark as read']"));
    await waitText(b.driver, "Unread (1)");
    await click(b.driver, By.xpath(row + "//button[@title='Mark as unread']"));
    await waitText(b.driver, "Unread (2)");
  });

  it("'Mark all as read' clears every dot and the badge", async () => {
    const { me } = await learnerWithNotifications(2);
    await signIn(b.driver, me);
    await go(b.driver, "/notifications");
    await waitText(b.driver, "Unread (3)");
    await click(b.driver, xText("Mark all as read", { tag: "button" }));
    await b.driver.wait(async () => (await count(b.driver, By.css(".nt-item .nt-dot"))) === 0, 8000);
    await waitText(b.driver, "Unread");
    assert.equal(await hasText(b.driver, "Unread ("), false);
    await b.driver.wait(async () => (await badgeText(b.driver)) === "", 8000);
    assert.equal(await (await find(b.driver, xText("Mark all as read", { tag: "button" }))).isEnabled(), false, "nothing left to mark");
  });

  it("the Unread tab shows only what is unread and drops items as they are read", async () => {
    const { me } = await learnerWithNotifications(1);
    await signIn(b.driver, me);
    await go(b.driver, "/notifications");
    await waitText(b.driver, "Unread (2)");
    await click(b.driver, By.xpath("//div[contains(@class,'tabs')]//button[contains(normalize-space(.),'Unread')]"));
    await b.driver.wait(async () => (await count(b.driver, By.css(".nt-item"))) === 2, 8000);
    await click(b.driver, xText("Mark all as read", { tag: "button" }));
    await waitText(b.driver, "Nothing new");
    await waitText(b.driver, "You’re all caught up.");
  });

  it("a notification can be deleted", async () => {
    const { me } = await learnerWithNotifications(1);
    await signIn(b.driver, me);
    await go(b.driver, "/notifications");
    const row = item("Liam Learner commented on your post");
    await waitText(b.driver, "Unread (2)");
    await hover(b.driver, By.xpath(row));
    await click(b.driver, By.xpath(row + "//button[@aria-label='Delete notification']"));
    await waitGone(b.driver, By.xpath(row));
    assert.ok(!(await notificationsOf(me)).some((n) => n.type === "post_comment"));
  });

  it("'Clear read' appears once something is read and removes only read notifications", async () => {
    const { me } = await learnerWithNotifications(1);
    await signIn(b.driver, me);
    await go(b.driver, "/notifications");
    await waitText(b.driver, "Unread (2)");
    assert.equal(await exists(b.driver, xText("Clear read", { tag: "button" })), false);
    await apiOk(me, `frontend/notifications/${(await notificationsOf(me)).find((n) => n.type === "welcome").id}`, { method: "PATCH", body: { read: true } });
    await b.driver.navigate().refresh();
    await visible(b.driver, xText("Clear read", { tag: "button" }));
    await click(b.driver, xText("Clear read", { tag: "button" }));
    await b.driver.wait(async () => (await count(b.driver, By.css(".nt-item"))) === 1, 8000);
    assert.equal((await notificationsOf(me)).length, 1);
  });

  it("a long list loads in pages with a 'Load more' button", async () => {
    const { me } = await learnerWithNotifications(24);
    await signIn(b.driver, me);
    await go(b.driver, "/notifications");
    await waitText(b.driver, "Load more");
    assert.equal(await count(b.driver, By.css(".nt-item")), 20);
    await click(b.driver, xText("Load more", { tag: "button" }));
    await b.driver.wait(async () => (await count(b.driver, By.css(".nt-item"))) === 25, 8000);
    assert.equal(await exists(b.driver, xText("Load more", { tag: "button" })), false);
  });

  it("read state is kept after a reload", async () => {
    const { me } = await learnerWithNotifications(1);
    await signIn(b.driver, me);
    await go(b.driver, "/notifications");
    await waitText(b.driver, "Unread (2)");
    await click(b.driver, xText("Mark all as read", { tag: "button" }));
    await b.driver.wait(async () => (await count(b.driver, By.css(".nt-item .nt-dot"))) === 0, 8000);
    await b.driver.navigate().refresh();
    await waitText(b.driver, "Liam Learner commented on your post");
    assert.equal(await count(b.driver, By.css(".nt-item .nt-dot")), 0);
  });

  it("a new notification appears at the top live and raises the badge", async () => {
    const { me, post } = await learnerWithNotifications(0);
    await signIn(b.driver, me);
    await go(b.driver, "/notifications");
    await waitText(b.driver, "Unread (1)");
    const text = unique("Live comment");
    await comment("learner2", post, text);
    await waitText(b.driver, "Unread (2)");
    await b.driver.wait(async () => (await items(b.driver))[0] === "Liam Learner commented on your post", 8000);
    await b.driver.wait(async () => (await badgeText(b.driver)) === "2", 8000);
  });

  it("the welcome notification points to the dashboard", async () => {
    const me = await makeLearner("greeted");
    await signIn(b.driver, me);
    await go(b.driver, "/notifications");
    await click(b.driver, By.xpath(item(`Welcome to Uddeepto, ${me.name.split(" ")[0]}!`) + "//a[contains(@class,'nt-main')]"));
    await waitUrl(b.driver, /^\/dashboard/);
  });

  it("taking back an appreciation also removes its unread notification", async () => {
    const me = await makeLearner("fickle");
    const post = await makePost({ author: me });
    await like("learner2", post);
    assert.ok((await notificationsOf(me)).some((n) => n.type === "post_like"));
    await like("learner2", post);
    assert.ok(!(await notificationsOf(me)).some((n) => n.type === "post_like"));
    await signIn(b.driver, me);
    await go(b.driver, "/notifications");
    await waitText(b.driver, "Welcome to Uddeepto");
    assert.equal(await hasText(b.driver, "liked your post"), false);
  });

  it("social notifications show the person's picture initial; system ones show an icon", async () => {
    const { me } = await learnerWithNotifications(1);
    await signIn(b.driver, me);
    await go(b.driver, "/notifications");
    await waitText(b.driver, "Liam Learner commented on your post");
    assert.ok(await isShown(b.driver, By.xpath(item("Liam Learner commented on your post") + "//span[contains(@class,'avatar')]")));
    assert.ok(await isShown(b.driver, By.xpath(`//li[contains(@class,'nt-item')][.//strong[starts-with(normalize-space(.),'Welcome')]]//span[contains(@class,'nt-icon')]`)));
  });
});
