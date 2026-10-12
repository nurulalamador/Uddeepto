import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { By, acceptConfirm, api, apiOk, click, count, dismissConfirm, exists, find, go, hasText, setValue, signIn, sleep, texts, type, unique, useBrowser, visible, waitGone, waitText, waitUrl, xText } from "../lib/browser.mjs";
import { makeLearner, makePost, notificationsOf } from "../lib/factory.mjs";
import { row, search } from "../lib/admin.mjs";

const tab = (label) => By.xpath(`//div[@role='tablist']//button[@role='tab'][contains(normalize-space(.),${JSON.stringify(label)})]`);
const statusFilter = By.xpath("//label[./span[normalize-space(.)='Status']]//select");
const review = (content) => By.xpath(`//table//tbody/tr[.//*[contains(normalize-space(.), ${JSON.stringify(content)})]]//button[normalize-space(.)='Review']`);
const decision = By.xpath("//*[contains(@class,'modal')]//label[contains(normalize-space(.),'Decision')]//select");

async function report(post, { by, reason = "spam", details = "" } = {}) {
  const reporter = by ?? (await makeLearner("reporter"));
  await apiOk(reporter, `showcase/${post.id}/report`, { method: "POST", body: { reason, details } });
  return reporter;
}
async function openModeration(b, view = "reports") {
  await signIn(b.driver, "admin");
  await go(b.driver, "/moderation");
  await waitText(b.driver, "Moderation");
  await visible(b.driver, search);
  if (view === "posts") {
    await click(b.driver, tab("Community posts"));
    await waitText(b.driver, "Review public and private community posts.");
  }
}
async function find_(b, text) {
  await type(b.driver, search, text);
  await sleep(700);
  await visible(b.driver, row(text));
}

describe("Admin · Moderation page", () => {
  const b = useBrowser();

  it("shows the Moderation heading, the report queue and the tools pill", async () => {
    await openModeration(b);
    await waitText(b.driver, "SAFETY & QUALITY");
    await waitText(b.driver, "Moderation tools");
    await waitText(b.driver, "Reported posts");
    await waitText(b.driver, "Review the reason and context, then record a decision.");
  });

  it("has two tabs: Report queue and Community posts", async () => {
    await openModeration(b);
    assert.deepEqual((await texts(b.driver, By.css("[role=tablist] [role=tab]"))).map((t) => t.trim()), ["Report queue", "Community posts"]);
    assert.equal(await (await find(b.driver, tab("Report queue"))).getAttribute("aria-selected"), "true");
  });

  it("the report table has its six columns", async () => {
    const post = await makePost({ author: "learner2" });
    await report(post);
    await openModeration(b);
    assert.deepEqual(await texts(b.driver, By.css(".moderation-table thead th")), ["REASON / REPORTED CONTENT", "REPORTED BY", "POST AUTHOR", "STATUS", "REPORTED", "ACTION"]);
  });

  it("the report status filter has Pending, Reviewing, Resolved and Dismissed", async () => {
    await openModeration(b);
    assert.deepEqual(await texts(b.driver, By.xpath("//label[./span[normalize-space(.)='Status']]//option")), ["All statuses", "pending", "reviewing", "resolved", "dismissed"]);
  });

  it("the post tab's filter has Public and Private", async () => {
    await openModeration(b, "posts");
    assert.deepEqual(await texts(b.driver, By.xpath("//label[./span[normalize-space(.)='Status']]//option")), ["All statuses", "public", "private"]);
  });

  it("the 'Management' link leads to the management page", async () => {
    await openModeration(b);
    await click(b.driver, xText("Management", { tag: "a" }));
    await waitUrl(b.driver, /^\/admin/);
  });

  it("learners and hirers cannot open the page", async () => {
    for (const who of ["learner", "hirer"]) {
      await signIn(b.driver, who);
      await go(b.driver, "/moderation");
      await waitText(b.driver, "Access restricted");
    }
  });
});

describe("Admin · Report queue", () => {
  const b = useBrowser();

  it("a fresh report shows its reason, the post text, the reporter and the author", async () => {
    const post = await makePost({ author: "learner2", content: unique("Spammy words") });
    const reporter = await report(post, { reason: "spam", details: "Looks like an advert" });
    await openModeration(b);
    await find_(b, post.content);
    const text = await (await find(b.driver, row(post.content))).getText();
    assert.match(text.toLowerCase(), /spam/);
    assert.match(text, new RegExp(reporter.name));
    assert.match(text, /Liam Learner/);
    assert.match(text, /Looks like an advert/);
    assert.match(text.toLowerCase(), /pending/);
  });

  it("the other report reasons read naturally", async () => {
    const post = await makePost({ author: "learner2", content: unique("Rude words") });
    await report(post, { reason: "harassment" });
    await openModeration(b);
    await find_(b, post.content);
    assert.match((await (await find(b.driver, row(post.content))).getText()).toLowerCase(), /harassment/);
  });

  it("search finds a report by the post's text", async () => {
    const post = await makePost({ author: "learner2", content: unique("Findable report") });
    await report(post);
    await openModeration(b);
    await find_(b, post.content);
    assert.equal(await count(b.driver, By.css(".moderation-table tbody tr")), 1);
  });

  it("a search with no match says no reports match", async () => {
    await openModeration(b);
    await type(b.driver, search, "zzzz-no-such-report");
    await waitText(b.driver, "No reports match");
    await waitText(b.driver, "Try another search or status filter.");
  });

  it("filtering by Pending keeps pending reports only", async () => {
    const post = await makePost({ author: "learner2" });
    await report(post);
    await openModeration(b);
    await setValue(b.driver, statusFilter, "pending");
    await b.driver.wait(async () => {
      const statuses = await texts(b.driver, By.css(".moderation-table tbody tr td:nth-child(4)"));
      return statuses.length > 0 && statuses.every((t) => /pending/i.test(t));
    }, 8000);
  });

  it("the eye icon opens the reported post", async () => {
    const post = await makePost({ author: "learner2", content: unique("Viewable report") });
    await report(post);
    await openModeration(b);
    await find_(b, post.content);
    await click(b.driver, By.css("a[aria-label='View reported post']"));
    await waitUrl(b.driver, new RegExp(`^/showcase/${post.id}`));
    await waitText(b.driver, post.content);
  });

  it("'Review' opens the report with the reason, context and a decision form", async () => {
    const post = await makePost({ author: "learner2", content: unique("Reviewed words") });
    await report(post, { details: "Please check this" });
    await openModeration(b);
    await find_(b, post.content);
    await click(b.driver, review(post.content));
    await waitText(b.driver, "Review report");
    await waitText(b.driver, "Please check this");
    assert.deepEqual(await texts(b.driver, By.xpath("//*[contains(@class,'modal')]//label[contains(normalize-space(.),'Decision')]//option")), ["pending", "reviewing", "resolved", "dismissed"]);
    await visible(b.driver, By.css(".modal textarea"));
  });

  it("marking a report 'reviewing' saves it without telling the reporter", async () => {
    const post = await makePost({ author: "learner2", content: unique("Looking at it") });
    const reporter = await report(post);
    await openModeration(b);
    await find_(b, post.content);
    await click(b.driver, review(post.content));
    await setValue(b.driver, decision, "reviewing");
    await click(b.driver, By.xpath("//*[contains(@class,'modal')]//button[contains(normalize-space(.),'Save review')]"));
    await waitText(b.driver, "Report review saved.");
    await b.driver.wait(async () => /reviewing/i.test(await (await find(b.driver, row(post.content))).getText()), 8000);
    await sleep(500);
    assert.ok(!(await notificationsOf(reporter)).some((n) => n.type === "report_update"));
  });

  it("resolving a report tells the reporter that action was taken", async () => {
    const post = await makePost({ author: "learner2", content: unique("Resolved words") });
    const reporter = await report(post);
    await openModeration(b);
    await find_(b, post.content);
    await click(b.driver, review(post.content));
    await setValue(b.driver, decision, "resolved");
    await type(b.driver, By.css(".modal textarea"), "Removed the offending text.");
    await click(b.driver, By.xpath("//*[contains(@class,'modal')]//button[contains(normalize-space(.),'Save review')]"));
    await waitText(b.driver, "Report review saved.");
    await b.driver.wait(async () => /resolved/i.test(await (await find(b.driver, row(post.content))).getText()), 8000);
    await b.driver.wait(async () => (await notificationsOf(reporter)).some((n) => n.title === "Your report was reviewed" && /took action/.test(n.body)), 10000);
  });

  it("dismissing a report tells the reporter that no violation was found", async () => {
    const post = await makePost({ author: "learner2", content: unique("Fine words") });
    const reporter = await report(post);
    await openModeration(b);
    await find_(b, post.content);
    await click(b.driver, review(post.content));
    await setValue(b.driver, decision, "dismissed");
    await click(b.driver, By.xpath("//*[contains(@class,'modal')]//button[contains(normalize-space(.),'Save review')]"));
    await waitText(b.driver, "Report review saved.");
    await b.driver.wait(async () => (await notificationsOf(reporter)).some((n) => n.title === "Your report was reviewed" && /no violation/.test(n.body)), 10000);
  });

  it("the reporter's notification leads to the showcase", async () => {
    const post = await makePost({ author: "learner2", content: unique("Linked words") });
    const reporter = await report(post);
    await apiOk("admin", `frontend/admin/reported_showcase_posts/${(await apiOk("admin", `frontend/admin/reported_showcase_posts?q=${encodeURIComponent(post.content)}`))[0].id}`, { method: "PATCH", body: { status: "dismissed", resolution_note: "ok" } });
    await signIn(b.driver, reporter);
    await go(b.driver, "/notifications");
    await waitText(b.driver, "Your report was reviewed");
    await click(b.driver, By.xpath("(//li[contains(@class,'nt-item')][.//strong[normalize-space(.)='Your report was reviewed']])[1]//a[contains(@class,'nt-main')]"));
    await waitUrl(b.driver, /^\/showcase/);
  });

  it("the resolution note is kept and shown again when the report is reopened", async () => {
    const post = await makePost({ author: "learner2", content: unique("Noted words") });
    await report(post);
    await openModeration(b);
    await find_(b, post.content);
    await click(b.driver, review(post.content));
    await setValue(b.driver, decision, "resolved");
    await type(b.driver, By.css(".modal textarea"), "Warned the author.");
    await click(b.driver, By.xpath("//*[contains(@class,'modal')]//button[contains(normalize-space(.),'Save review')]"));
    await waitText(b.driver, "Report review saved.");
    await click(b.driver, review(post.content));
    await b.driver.wait(async () => (await (await find(b.driver, By.css(".modal textarea"))).getAttribute("value")) === "Warned the author.", 5000);
  });

  it("the same person cannot report one post twice", async () => {
    const post = await makePost({ author: "learner2" });
    const reporter = await report(post);
    const again = await api(reporter, `showcase/${post.id}/report`, { method: "POST", body: { reason: "spam" } });
    assert.equal(again.status, 409);
  });

  it("nobody can report their own post", async () => {
    const post = await makePost({ author: "learner2" });
    const mine = await api("learner2", `showcase/${post.id}/report`, { method: "POST", body: { reason: "spam" } });
    assert.equal(mine.status, 409);
  });

  it("an unknown reason is refused", async () => {
    const post = await makePost({ author: "learner2" });
    const refused = await api("learner", `showcase/${post.id}/report`, { method: "POST", body: { reason: "boring" } });
    assert.equal(refused.status, 422);
  });

  it("an invalid decision is refused by the server", async () => {
    const post = await makePost({ author: "learner2", content: unique("Bad decision") });
    await report(post);
    const [item] = await apiOk("admin", `frontend/admin/reported_showcase_posts?q=${encodeURIComponent(post.content)}`);
    const refused = await api("admin", `frontend/admin/reported_showcase_posts/${item.id}`, { method: "PATCH", body: { status: "banished" } });
    assert.ok([400, 422].includes(refused.status), String(refused.status));
  });

  it("learners cannot read or decide reports", async () => {
    assert.equal((await api("learner", "frontend/admin/reported_showcase_posts")).status, 403);
    assert.equal((await api("hirer", "frontend/admin/reported_showcase_posts")).status, 403);
  });

  it("hiding the reported post keeps the report but removes the link to the post", async () => {
    const post = await makePost({ author: "learner2", content: unique("Soon gone") });
    await report(post);
    const [item] = await apiOk("admin", `frontend/admin/reported_showcase_posts?q=${encodeURIComponent(post.content)}`);
    assert.equal(item.post_id, post.id);
    await apiOk("admin", `frontend/admin/showcase_posts/${post.id}`, { method: "DELETE" });
    await openModeration(b);
    await find_(b, post.content);
    assert.equal(await exists(b.driver, By.css("a[aria-label='View reported post']")), false);
  });
});

describe("Admin · Community posts", () => {
  const b = useBrowser();

  it("lists posts with author, interest, visibility and date", async () => {
    const post = await makePost({ author: "learner2", content: unique("Listed post") });
    await openModeration(b, "posts");
    assert.deepEqual(await texts(b.driver, By.css(".moderation-table thead th")), ["POST CONTENT", "AUTHOR", "INTEREST", "VISIBILITY", "POSTED", "ACTION"]);
    await find_(b, post.content);
    const text = await (await find(b.driver, row(post.content))).getText();
    assert.match(text, /Liam Learner/);
    assert.match(text, /Web Development/);
    assert.match(text.toLowerCase(), /public/);
  });

  it("search finds a post by its text", async () => {
    const post = await makePost({ author: "learner2", content: unique("Searchable post") });
    await openModeration(b, "posts");
    await find_(b, post.content);
  });

  it("a search with no match says no posts match", async () => {
    await openModeration(b, "posts");
    await type(b.driver, search, "zzzz-no-such-post");
    await waitText(b.driver, "No posts match");
  });

  it("the eye icon opens the post", async () => {
    const post = await makePost({ author: "learner2", content: unique("Openable post") });
    await openModeration(b, "posts");
    await find_(b, post.content);
    await click(b.driver, By.css("a[aria-label='View post']"));
    await waitUrl(b.driver, new RegExp(`^/showcase/${post.id}`));
  });

  it("an admin can hide a post after confirming, and the author is told", async () => {
    const post = await makePost({ author: "learner2", content: unique("Hide me") });
    await openModeration(b, "posts");
    await find_(b, post.content);
    const message = await acceptConfirm(b.driver, () => click(b.driver, By.css("button[aria-label='Hide post']")));
    assert.match(message, /Hide this post from the community\?/);
    await waitText(b.driver, "Post hidden from the community.");
    await b.driver.wait(async () => (await notificationsOf("learner2")).some((n) => n.title === "A moderator removed your post"), 10000);
  });

  it("a hidden post no longer shows in the learners' showcase", async () => {
    const post = await makePost({ author: "learner2", content: unique("Vanishing post") });
    await apiOk("admin", `frontend/admin/showcase_posts/${post.id}`, { method: "DELETE" });
    await signIn(b.driver, "learner");
    await go(b.driver, "/showcase");
    await sleep(1500);
    assert.equal(await hasText(b.driver, post.content), false);
  });

  it("cancelling the confirmation keeps the post", async () => {
    const post = await makePost({ author: "learner2", content: unique("Spared post") });
    await openModeration(b, "posts");
    await find_(b, post.content);
    await dismissConfirm(b.driver, () => click(b.driver, By.css("button[aria-label='Hide post']")));
    await sleep(500);
    assert.ok(await exists(b.driver, row(post.content)));
  });

  it("a learner cannot hide other people's posts through the API", async () => {
    const post = await makePost({ author: "learner2" });
    assert.equal((await api("learner", `frontend/admin/showcase_posts/${post.id}`, { method: "DELETE" })).status, 403);
  });

  it("returning to the Report queue tab clears the search", async () => {
    await openModeration(b, "posts");
    await type(b.driver, search, "something");
    await click(b.driver, tab("Report queue"));
    await waitText(b.driver, "Reported posts");
    assert.equal(await (await find(b.driver, search)).getAttribute("value"), "");
  });
});
