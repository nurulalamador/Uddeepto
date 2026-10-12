import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { By, WEB, acceptConfirm, api, apiOk, chooseOption, click, clickButton, count, currentPath, dropdownValue, exists, find, go, hasText, isShown, q, signIn, sleep, texts, type, unique, upload, useBrowser, visible, waitGone, waitNoText, waitText, waitUrl, xText } from "../lib/browser.mjs";
import { fixture } from "../lib/fixtures.mjs";
import { makePost, makeLearner, notificationsOf, seed } from "../lib/factory.mjs";

const card = (content) => `//article[contains(@class,'post')][.//*[contains(@class,'post-content')][contains(normalize-space(.), ${q(content)})]]`;
const inCard = (content, rest) => By.xpath(card(content) + rest);

async function openComposer(driver) {
  await click(driver, xText("Create a post", { tag: "button" }));
  await waitText(driver, "What have you been working on?");
}
async function publish(driver, content, interest = "Web Development") {
  await openComposer(driver);
  await type(driver, By.css("textarea[name=content]"), content);
  await chooseOption(driver, "Choose an interest for your post", interest);
  await clickButton(driver, "Publish post", { exact: false });
}

describe("Learner · Showcase feed", () => {
  const b = useBrowser();

  it("shows other people's posts with their author, date, interest and counters", async () => {
    const post = await makePost({ author: "learner2" });
    await signIn(b.driver, "learner");
    await go(b.driver, "/showcase");
    await waitText(b.driver, post.content);
    const article = card(post.content);
    assert.ok(await isShown(b.driver, By.xpath(article + "//strong[normalize-space(.)='Liam Learner']")));
    assert.ok((await (await find(b.driver, By.xpath(article + "//header//small"))).getText()).includes("Web Development"));
    assert.ok(await isShown(b.driver, By.xpath(article + "//footer//*[contains(normalize-space(.),'Appreciate')]")));
    assert.ok(await isShown(b.driver, By.xpath(article + "//footer//*[contains(normalize-space(.),'Comments')]")));
  });

  it("an author's name leads to their public profile", async () => {
    const post = await makePost({ author: "learner2" });
    await signIn(b.driver, "learner");
    await go(b.driver, "/showcase");
    await click(b.driver, By.xpath(card(post.content) + "//header//a"));
    await waitUrl(b.driver, /^\/profile\//);
    await waitText(b.driver, "Liam Learner");
  });

  it("the search box filters posts by their text", async () => {
    const target = await makePost({ content: unique("Needle post") });
    const other = await makePost({ content: unique("Haystack post") });
    await signIn(b.driver, "learner");
    await go(b.driver, "/showcase");
    await waitText(b.driver, other.content);
    await type(b.driver, By.css("input[aria-label='Search community posts…']"), target.content);
    await waitText(b.driver, target.content);
    await waitNoText(b.driver, other.content);
  });

  it("a search with no match explains that nothing was found", async () => {
    await signIn(b.driver, "learner");
    await go(b.driver, "/showcase");
    await type(b.driver, By.css("input[aria-label='Search community posts…']"), "zzzz-nothing-matches-this-zzzz");
    await waitText(b.driver, "No posts match those filters");
  });

  it("the interest filter narrows the feed to one interest", async () => {
    const design = await makePost({ content: unique("Design only"), category: "design" });
    const web = await makePost({ content: unique("Web only"), category: "web" });
    await signIn(b.driver, "learner");
    await go(b.driver, "/showcase");
    await waitText(b.driver, design.content);
    await chooseOption(b.driver, "Filter category", "Graphic Design");
    await waitNoText(b.driver, web.content);
    await waitText(b.driver, design.content);
    await chooseOption(b.driver, "Filter category", "All interests");
    await waitText(b.driver, web.content);
  });

  it("the feed ends with a friendly 'all caught up' note", async () => {
    await signIn(b.driver, "learner");
    await go(b.driver, "/showcase");
    await b.driver.executeScript("window.scrollTo(0, document.body.scrollHeight)");
    await waitText(b.driver, "You’re all caught up.");
  });

  it("'Open full post' shows the single post page and the top bar names the author", async () => {
    const post = await makePost({ author: "learner2" });
    await signIn(b.driver, "learner");
    await go(b.driver, "/showcase");
    await click(b.driver, By.xpath(card(post.content) + "//a[@aria-label='Open full post']"));
    await waitUrl(b.driver, /^\/showcase\/[0-9a-f-]{36}/);
    await waitText(b.driver, post.content);
    await waitText(b.driver, "Liam Learner's post");
    assert.ok(await isShown(b.driver, By.css(".post-detail-back")));
    assert.ok(await isShown(b.driver, By.css("#comments")), "comments are open on the post page");
  });

  it("the back arrow on a post page returns to the feed", async () => {
    const post = await makePost({ author: "learner2" });
    await signIn(b.driver, "learner");
    await go(b.driver, `/showcase/${post.id}`);
    await waitText(b.driver, post.content);
    await click(b.driver, By.css(".post-detail-back"));
    await waitUrl(b.driver, /^\/showcase$/);
  });
});

describe("Learner · Creating posts", () => {
  const b = useBrowser();

  it("a post with text and an interest appears at the top of the feed", async () => {
    const content = unique("My new post");
    await signIn(b.driver, "learner");
    await go(b.driver, "/showcase");
    await publish(b.driver, content);
    await waitGone(b.driver, By.css(".modal"));
    await waitText(b.driver, content);
    const first = await (await find(b.driver, By.css("article.post .post-content"))).getText();
    assert.equal(first, content);
    assert.ok((await (await find(b.driver, By.xpath(card(content) + "//header//small"))).getText()).includes("Web Development"));
  });

  it("publishing without choosing an interest is refused with a clear message", async () => {
    await signIn(b.driver, "learner");
    await go(b.driver, "/showcase");
    await openComposer(b.driver);
    await type(b.driver, By.css("textarea[name=content]"), unique("No interest"));
    await clickButton(b.driver, "Publish post", { exact: false });
    await waitText(b.driver, "Choose an interest before publishing your post.");
  });

  it("an empty post is blocked by the form", async () => {
    await signIn(b.driver, "learner");
    await go(b.driver, "/showcase");
    await openComposer(b.driver);
    await chooseOption(b.driver, "Choose an interest for your post", "Web Development");
    await clickButton(b.driver, "Publish post", { exact: false });
    assert.equal(await b.driver.executeScript("return document.querySelector('textarea[name=content]').validity.valueMissing"), true);
    assert.ok(await isShown(b.driver, By.css(".modal")));
  });

  it("the dialog can be closed without posting", async () => {
    await signIn(b.driver, "learner");
    await go(b.driver, "/showcase");
    await openComposer(b.driver);
    await click(b.driver, By.css("button[aria-label='Close dialog']"));
    await waitGone(b.driver, By.css(".modal"));
  });

  it("a picture can be attached, previewed, removed and attached again", async () => {
    await signIn(b.driver, "learner");
    await go(b.driver, "/showcase");
    await openComposer(b.driver);
    await upload(b.driver, By.css(".media-picker-button input[type=file]"), fixture("pixel.png"));
    await visible(b.driver, By.css(".media-preview img"));
    assert.equal(await count(b.driver, By.css(".media-preview")), 1);
    await click(b.driver, By.css("button[aria-label='Remove pixel.png']"));
    await waitGone(b.driver, By.css(".media-preview"));
    await upload(b.driver, By.css(".media-picker-button input[type=file]"), fixture("pixel.png"));
    await visible(b.driver, By.css(".media-preview img"));
  });

  it("a post with a picture shows the picture in the feed", async () => {
    const content = unique("Post with picture");
    await signIn(b.driver, "learner");
    await go(b.driver, "/showcase");
    await openComposer(b.driver);
    await type(b.driver, By.css("textarea[name=content]"), content);
    await chooseOption(b.driver, "Choose an interest for your post", "Graphic Design");
    await upload(b.driver, By.css(".media-picker-button input[type=file]"), fixture("pixel.png"));
    await visible(b.driver, By.css(".media-preview img"));
    await clickButton(b.driver, "Publish post", { exact: false });
    await waitText(b.driver, content);
    const image = await visible(b.driver, By.xpath(card(content) + "//div[contains(@class,'post-media')]//img"));
    await b.driver.wait(async () => (await image.getAttribute("naturalWidth")) !== "0", 8000, "the uploaded picture never loaded");
    assert.ok((await image.getAttribute("src")).includes("/frontend/showcase/"));
  });

  it("new posts are visible to other learners", async () => {
    const content = unique("Visible to all");
    await signIn(b.driver, "learner");
    await go(b.driver, "/showcase");
    await publish(b.driver, content);
    await waitText(b.driver, content);
    const feed = await apiOk("learner2", "frontend/showcase?limit=5");
    assert.ok(feed.some((post) => post.content === content), "the second learner's feed should include it");
  });
});

describe("Learner · Reactions and comments", () => {
  const b = useBrowser();

  it("appreciating a post counts it and survives a reload; a second click takes it back", async () => {
    const post = await makePost({ author: "learner2" });
    await signIn(b.driver, "learner");
    await go(b.driver, "/showcase");
    const button = By.xpath(card(post.content) + "//footer//button[contains(@class,'reaction')][1]");
    await waitText(b.driver, post.content);
    await click(b.driver, button);
    await b.driver.wait(async () => (await (await find(b.driver, button)).getAttribute("aria-pressed")) === "true", 5000);
    assert.ok((await (await find(b.driver, button)).getText()).startsWith("1"));
    await b.driver.navigate().refresh();
    await waitText(b.driver, post.content);
    assert.equal(await (await find(b.driver, button)).getAttribute("aria-pressed"), "true");
    await click(b.driver, button);
    await b.driver.wait(async () => (await (await find(b.driver, button)).getAttribute("aria-pressed")) === "false", 5000);
    assert.ok((await (await find(b.driver, button)).getText()).startsWith("0"));
  });

  it("the author is told when someone appreciates the post", async () => {
    const post = await makePost({ author: "learner2" });
    await signIn(b.driver, "learner");
    await go(b.driver, "/showcase");
    await click(b.driver, By.xpath(card(post.content) + "//footer//button[contains(@class,'reaction')][1]"));
    await b.driver.wait(async () => (await notificationsOf("learner2")).some((n) => n.type === "post_like" && n.body === post.content), 8000);
    const note = (await notificationsOf("learner2")).find((n) => n.type === "post_like" && n.body === post.content);
    assert.equal(note.title, "Lena Learner liked your post");
  });

  it("a comment is added from the post page, counted, and shown with its author", async () => {
    const post = await makePost({ author: "learner2" });
    const text = unique("Great work");
    await signIn(b.driver, "learner");
    await go(b.driver, `/showcase/${post.id}`);
    await waitText(b.driver, "No comments yet. Start the conversation.");
    await type(b.driver, By.css("[aria-label='Write a comment']"), text);
    await click(b.driver, By.css("button[aria-label='Send comment']"));
    await waitText(b.driver, text);
    await waitNoText(b.driver, "No comments yet");
    assert.ok(await isShown(b.driver, By.xpath(`//div[contains(@class,'comment')][contains(normalize-space(.), ${q(text)})]//a[contains(normalize-space(.), 'Lena Learner')] | //div[contains(@class,'comment')][contains(normalize-space(.), ${q(text)})][contains(normalize-space(.), 'Lena Learner')]`)));
    assert.ok((await (await find(b.driver, By.xpath("//footer//button[.//span[normalize-space(.)='Comments']]"))).getText()).startsWith("1"));
  });

  it("comments are saved and still there after a reload", async () => {
    const post = await makePost({ author: "learner2" });
    const text = unique("Persistent comment");
    await apiOk("learner", `frontend/showcase/${post.id}/comments`, { method: "POST", body: { content: text } });
    await signIn(b.driver, "learner");
    await go(b.driver, `/showcase/${post.id}`);
    await waitText(b.driver, text);
  });

  it("the post's author is notified of a new comment", async () => {
    const post = await makePost({ author: "learner2" });
    const text = unique("Notify me");
    await signIn(b.driver, "learner");
    await go(b.driver, `/showcase/${post.id}`);
    await type(b.driver, By.css("[aria-label='Write a comment']"), text);
    await click(b.driver, By.css("button[aria-label='Send comment']"));
    await waitText(b.driver, text);
    const note = (await notificationsOf("learner2")).find((n) => n.type === "post_comment" && n.body === text);
    assert.ok(note, "learner2 should have a comment notification");
    assert.equal(note.title, "Lena Learner commented on your post");
  });

  it("a comment can be appreciated and its author is notified", async () => {
    const post = await makePost({ author: "learner2" });
    const text = unique("Like my comment");
    await apiOk("learner2", `frontend/showcase/${post.id}/comments`, { method: "POST", body: { content: text } });
    await signIn(b.driver, "learner");
    await go(b.driver, `/showcase/${post.id}`);
    await waitText(b.driver, text);
    const like = By.xpath(`//div[contains(@class,'comment')][contains(normalize-space(.), ${q(text)})]//button[contains(@class,'reaction')]`);
    await click(b.driver, like);
    await b.driver.wait(async () => /selected/.test(await (await find(b.driver, like)).getAttribute("class")), 5000);
    await b.driver.wait(async () => (await notificationsOf("learner2")).some((n) => n.type === "comment_like"), 8000);
  });

  it("the send button stays disabled until there is something to say", async () => {
    const post = await makePost({ author: "learner2" });
    await signIn(b.driver, "learner");
    await go(b.driver, `/showcase/${post.id}`);
    await waitText(b.driver, "No comments yet");
    const send = By.css("button[aria-label='Send comment']");
    assert.equal(await (await find(b.driver, send)).isEnabled(), false);
    await type(b.driver, By.css("[aria-label='Write a comment']"), "   ");
    assert.equal(await (await find(b.driver, send)).isEnabled(), false, "spaces alone do not count");
    await type(b.driver, By.css("[aria-label='Write a comment']"), "Hello");
    assert.equal(await (await find(b.driver, send)).isEnabled(), true);
  });
});

describe("Learner · Managing and reporting posts", () => {
  const b = useBrowser();

  it("a learner can delete their own post after confirming", async () => {
    const post = await makePost({ author: "learner" });
    await signIn(b.driver, "learner");
    await go(b.driver, "/showcase");
    await waitText(b.driver, post.content);
    await click(b.driver, inCard(post.content, "//button[@aria-label='Post options']"));
    const message = await acceptConfirm(b.driver, () => click(b.driver, xText("Delete post", { tag: "button" })));
    assert.equal(message, "Delete this post?");
    await waitNoText(b.driver, post.content);
    const feed = await apiOk("learner2", "frontend/showcase?limit=20");
    assert.ok(!feed.some((p) => p.id === post.id));
  });

  it("cancelling the confirmation keeps the post", async () => {
    const post = await makePost({ author: "learner" });
    await signIn(b.driver, "learner");
    await go(b.driver, "/showcase");
    await click(b.driver, inCard(post.content, "//button[@aria-label='Post options']"));
    await click(b.driver, xText("Delete post", { tag: "button" }));
    await b.driver.wait(async () => { try { await b.driver.switchTo().alert(); return true; } catch { return false; } }, 5000);
    await (await b.driver.switchTo().alert()).dismiss();
    await sleep(400);
    assert.ok(await hasText(b.driver, post.content));
  });

  it("an author's own post offers Delete but not Report", async () => {
    const post = await makePost({ author: "learner" });
    await signIn(b.driver, "learner");
    await go(b.driver, "/showcase");
    await click(b.driver, inCard(post.content, "//button[@aria-label='Post options']"));
    assert.ok(await isShown(b.driver, xText("Delete post", { tag: "button" })));
    assert.equal(await exists(b.driver, xText("Report post", { tag: "button" })), false);
  });

  it("someone else's post offers Report but not Delete", async () => {
    const post = await makePost({ author: "learner2" });
    await signIn(b.driver, "learner");
    await go(b.driver, "/showcase");
    await click(b.driver, inCard(post.content, "//button[@aria-label='Post options']"));
    assert.ok(await isShown(b.driver, xText("Report post", { tag: "button" })));
    assert.equal(await exists(b.driver, xText("Delete post", { tag: "button" })), false);
  });

  it("the post menu closes with Escape", async () => {
    const post = await makePost({ author: "learner2" });
    await signIn(b.driver, "learner");
    await go(b.driver, "/showcase");
    await click(b.driver, inCard(post.content, "//button[@aria-label='Post options']"));
    await visible(b.driver, By.css(".post-menu"));
    await b.driver.actions().sendKeys("").perform();
    await waitGone(b.driver, By.css(".post-menu"));
  });

  it("reporting a post sends it to the moderators and thanks the reporter", async () => {
    const post = await makePost({ author: "learner2" });
    await signIn(b.driver, "learner");
    await go(b.driver, "/showcase");
    await click(b.driver, inCard(post.content, "//button[@aria-label='Post options']"));
    await click(b.driver, xText("Report post", { tag: "button" }));
    await waitText(b.driver, "Tell the moderation team why this post should be reviewed.");
    await b.driver.executeScript("const s=document.querySelector('.modal select'); s.value='spam'; s.dispatchEvent(new Event('change',{bubbles:true}))");
    await type(b.driver, By.css(".modal textarea"), "This looks like spam to me");
    await clickButton(b.driver, "Submit report", { exact: false });
    await waitText(b.driver, "Thanks - your report was sent to the moderation team.");
    const reports = await apiOk("admin", "frontend/admin/reported_showcase_posts?status=pending&q=spam");
    assert.ok(reports.some((r) => r.post_id === post.id && r.reason === "spam"));
    await b.driver.wait(async () => (await notificationsOf("admin")).some((n) => n.type === "report_received"), 8000);
  });

  it("the report button stays disabled until a reason is chosen", async () => {
    const post = await makePost({ author: "learner2" });
    await signIn(b.driver, "learner");
    await go(b.driver, "/showcase");
    await click(b.driver, inCard(post.content, "//button[@aria-label='Post options']"));
    await click(b.driver, xText("Report post", { tag: "button" }));
    await waitText(b.driver, "Tell the moderation team");
    assert.equal(await (await find(b.driver, By.css(".report-submit"))).isEnabled(), false);
  });

  it("reporting the same post twice shows 'You have already reported this post'", async () => {
    const post = await makePost({ author: "learner2" });
    await apiOk("learner", `showcase/${post.id}/report`, { method: "POST", body: { reason: "other", details: "first" } });
    await signIn(b.driver, "learner");
    await go(b.driver, "/showcase");
    await click(b.driver, inCard(post.content, "//button[@aria-label='Post options']"));
    await click(b.driver, xText("Report post", { tag: "button" }));
    await waitText(b.driver, "Tell the moderation team");
    await b.driver.executeScript("const s=document.querySelector('.modal select'); s.value='other'; s.dispatchEvent(new Event('change',{bubbles:true}))");
    await clickButton(b.driver, "Submit report", { exact: false });
    await waitText(b.driver, "You have already reported this post");
  });
});
