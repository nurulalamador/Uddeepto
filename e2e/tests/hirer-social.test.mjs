import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { By, api, apiOk, chooseOption, click, clickButton, count, exists, find, go, hasText, hover, isShown, q, setValue, signIn, sleep, texts, type, unique, useBrowser, visible, waitGone, waitText, waitUrl, xText } from "../lib/browser.mjs";
import { applyTo, makeHirer, makeJob, makeLearner, makePost, notificationsOf } from "../lib/factory.mjs";

const card = (content) => `//article[contains(@class,'post')][.//*[contains(@class,'post-content')][contains(normalize-space(.), ${q(content)})]]`;
const item = (title) => `//li[contains(@class,'nt-item')][.//strong[normalize-space(.)=${q(title)}]]`;

describe("Hirer · Showcase", () => {
  const b = useBrowser();

  it("a hirer can read the community's posts but has no 'Create a post' button", async () => {
    const post = await makePost({ author: "learner2" });
    await signIn(b.driver, "hirer");
    await go(b.driver, "/showcase");
    await waitText(b.driver, post.content);
    assert.equal(await exists(b.driver, xText("Create a post", { tag: "button" })), false);
  });

  it("the server also refuses a hirer's post", async () => {
    const refused = await api("hirer", "frontend/showcase", { method: "POST", body: { category_id: "00000000-0000-4000-8000-000000000000", content: "I am a hirer" } });
    assert.equal(refused.status, 403);
  });

  it("a hirer can appreciate and comment on a post", async () => {
    const post = await makePost({ author: "learner2" });
    const text = unique("Hiring note");
    await signIn(b.driver, "hirer");
    await go(b.driver, `/showcase/${post.id}`);
    await waitText(b.driver, post.content);
    await click(b.driver, By.xpath("//footer//button[contains(@class,'reaction')][1]"));
    await b.driver.wait(async () => (await notificationsOf("learner2")).some((n) => n.type === "post_like" && n.title === "Hana Hirer liked your post"), 8000);
    await type(b.driver, By.css("[aria-label='Write a comment']"), text);
    await click(b.driver, By.css("button[aria-label='Send comment']"));
    await waitText(b.driver, text);
  });

  it("a hirer can report a post, but cannot delete one", async () => {
    const post = await makePost({ author: "learner2" });
    await signIn(b.driver, "hirer");
    await go(b.driver, "/showcase");
    await waitText(b.driver, post.content);
    await click(b.driver, By.xpath(card(post.content) + "//button[@aria-label='Post options']"));
    assert.equal(await exists(b.driver, xText("Delete post", { tag: "button" })), false);
    await click(b.driver, xText("Report post", { tag: "button" }));
    await waitText(b.driver, "Tell the moderation team");
  });

  it("the interest filter works for a hirer too", async () => {
    const design = await makePost({ content: unique("Hirer design"), category: "design" });
    await signIn(b.driver, "hirer");
    await go(b.driver, "/showcase");
    await chooseOption(b.driver, "Filter category", "Graphic Design");
    await waitText(b.driver, design.content);
  });
});

describe("Hirer · Messages", () => {
  const b = useBrowser();
  const compose = By.css("textarea[aria-label='Message']");

  it("a hirer starts a conversation with a learner and the learner receives it", async () => {
    const hirer = await makeHirer("messenger");
    const learner = await makeLearner("receiver2");
    await signIn(b.driver, hirer);
    await go(b.driver, "/messages");
    await click(b.driver, By.css("button.fab"));
    await type(b.driver, By.css(".modal input"), learner.name);
    await click(b.driver, By.xpath(`//div[contains(@class,'list-row')][.//strong[normalize-space(.)=${q(learner.name)}]]//button[contains(normalize-space(.),'Select')]`));
    await visible(b.driver, compose);
    const text = unique("Interested in your profile");
    await type(b.driver, compose, text);
    await click(b.driver, By.xpath("//div[contains(@class,'message-compose')]//button"));
    await b.driver.wait(async () => (await texts(b.driver, By.css(".message-stream article.bubble p"))).includes(text), 8000);
    const inbox = await apiOk(learner, "frontend/messages");
    assert.equal(inbox[0].name, hirer.name);
    assert.equal(inbox[0].last_message, text);
  });

  it("a learner's reply reaches the hirer live", async () => {
    const hirer = await makeHirer("waiting2");
    const learner = await makeLearner("replying");
    const conversation = (await apiOk(hirer, "frontend/messages", { method: "POST", body: { user_id: learner.id } })).id;
    await signIn(b.driver, hirer);
    await go(b.driver, "/messages");
    await click(b.driver, By.xpath(`//aside//button[contains(@class,'conversation')][.//strong[normalize-space(.)=${q(learner.name)}]]`));
    await visible(b.driver, compose);
    const text = unique("Thanks for reaching out");
    await apiOk(learner, `frontend/messages/${conversation}`, { method: "POST", body: { content: text } });
    await b.driver.wait(async () => (await texts(b.driver, By.css(".message-stream article.bubble p"))).includes(text), 10000);
  });

  it("an applicant's profile offers 'Send message' to the hirer", async () => {
    const hirer = await makeHirer("contacting");
    const job = await makeJob({ owner: hirer, title: unique("Contact role") });
    const learner = await makeLearner("applicant3");
    await applyTo(job, learner);
    await signIn(b.driver, hirer);
    await go(b.driver, `/profile/${learner.id}`);
    await waitText(b.driver, learner.name);
    await click(b.driver, xText("Send message", { tag: "a" }));
    await waitUrl(b.driver, /^\/messages/);
    await visible(b.driver, compose);
  });
});

describe("Hirer · Notifications", () => {
  const b = useBrowser();

  it("a new application shows up as a notification that leads to Job Management", async () => {
    const hirer = await makeHirer("alerted");
    const job = await makeJob({ owner: hirer, title: unique("Alert role") });
    const learner = await makeLearner("keen");
    await applyTo(job, learner, "I am very keen on this role.");
    await signIn(b.driver, hirer);
    await go(b.driver, "/notifications");
    const title = `${learner.name} applied for “${job.title}”`;
    await waitText(b.driver, title);
    await waitText(b.driver, "I am very keen on this role.");
    await click(b.driver, By.xpath(item(title) + "//a[contains(@class,'nt-main')]"));
    await waitUrl(b.driver, /^\/job-management/);
  });

  it("the filter chips for a hirer are Social, Jobs and System", async () => {
    const hirer = await makeHirer("chips2");
    await signIn(b.driver, hirer);
    await go(b.driver, "/notifications");
    await waitText(b.driver, "Everything");
    assert.deepEqual((await texts(b.driver, By.css(".nt-chip"))).map((t) => t.split("\n")[0]), ["Everything", "Social", "Jobs", "System"]);
  });

  it("the Jobs chip keeps only job notifications and shows its unread count", async () => {
    const hirer = await makeHirer("jobschip");
    const job = await makeJob({ owner: hirer, title: unique("Chip role") });
    await applyTo(job, await makeLearner("one2"));
    await applyTo(job, await makeLearner("two2"));
    await signIn(b.driver, hirer);
    await go(b.driver, "/notifications");
    await waitText(b.driver, "Unread (3)");
    await click(b.driver, By.xpath("//button[contains(@class,'nt-chip')][contains(normalize-space(.),'Jobs')]"));
    await b.driver.wait(async () => (await count(b.driver, By.css(".nt-item"))) === 2, 8000);
  });

  it("a hirer's welcome message is about posting jobs", async () => {
    const hirer = await makeHirer("welcomed");
    await signIn(b.driver, hirer);
    await go(b.driver, "/notifications");
    await waitText(b.driver, "Post your first job and start finding talent.");
  });

  it("the sidebar badge counts a hirer's unread notifications live", async () => {
    const hirer = await makeHirer("badge2");
    const job = await makeJob({ owner: hirer, title: unique("Badge role") });
    await signIn(b.driver, hirer);
    await go(b.driver, "/dashboard");
    const badge = By.css(".sidebar nav a .nav-badge");
    await b.driver.wait(async () => (await exists(b.driver, badge)) && (await (await find(b.driver, badge)).getText()) === "1", 15000);
    await applyTo(job, await makeLearner("pinger"));
    await b.driver.wait(async () => (await (await find(b.driver, badge)).getText()) === "2", 20000, "badge never reached 2");
  });

  it("a hirer never receives learner or admin announcements", async () => {
    const hirer = await makeHirer("quiet2");
    const { makeCourse } = await import("../lib/factory.mjs");
    await makeCourse({ title: unique("Announced course") });
    const types = (await notificationsOf(hirer)).map((n) => n.type);
    assert.ok(!types.includes("course_new") && !types.includes("report_received"), types.join(","));
  });
});

describe("Hirer · Profile", () => {
  const b = useBrowser();

  it("shows the hirer's name, role and an empty-interest hint", async () => {
    const hirer = await makeHirer("profiled");
    await signIn(b.driver, hirer);
    await go(b.driver, "/profile");
    await waitText(b.driver, hirer.name);
    await waitText(b.driver, "Hirer");
    await waitText(b.driver, "Choose your interests from Edit profile.");
  });

  it("the headline and bio can be edited", async () => {
    const hirer = await makeHirer("editor2");
    await signIn(b.driver, hirer);
    await go(b.driver, "/profile");
    await clickButton(b.driver, "Edit profile", { exact: false });
    await waitText(b.driver, "Edit your profile");
    await type(b.driver, By.css(".modal [name=headline]"), "Talent partner at Acme");
    await type(b.driver, By.css(".modal [name=bio]"), "We hire builders.");
    await click(b.driver, By.xpath("//*[contains(@class,'modal')]//button[contains(normalize-space(.),'Save profile')]"));
    await waitGone(b.driver, By.css(".modal"));
    await waitText(b.driver, "Talent partner at Acme");
    await waitText(b.driver, "We hire builders.");
  });

  it("a learner viewing a hirer's profile sees their public details only", async () => {
    await signIn(b.driver, "learner");
    await go(b.driver, `/search?q=Hana`);
    await click(b.driver, By.xpath("//a[contains(@href,'/profile/')][.//*[contains(normalize-space(.),'Hana Hirer')]]"));
    await waitUrl(b.driver, /^\/profile\//);
    await waitText(b.driver, "Hana Hirer");
    await waitText(b.driver, "Hirer");
    assert.equal(await hasText(b.driver, "hirer1@e2e.test"), false);
  });

  it("a hirer can add work experience", async () => {
    const hirer = await makeHirer("worker2");
    await signIn(b.driver, hirer);
    await go(b.driver, "/profile");
    await click(b.driver, By.xpath("//section[contains(@class,'pf-section')][.//h2[contains(normalize-space(.),'Experience')]]//button[contains(@class,'pf-add')]"));
    await waitText(b.driver, "Add experience");
    await type(b.driver, By.css(".modal [name=title]"), "Head of Talent");
    await type(b.driver, By.css(".modal [name=workplace]"), "Acme Ltd");
    await chooseOption(b.driver, "Interest category of this experience", "Others");
    await setValue(b.driver, By.css(".modal [name=start_date]"), "2020-01");
    await setValue(b.driver, By.css(".modal [name=end_date]"), "2023-01");
    await click(b.driver, By.xpath("//*[contains(@class,'modal')]//button[contains(normalize-space(.),'Add experience')]"));
    await waitGone(b.driver, By.css(".modal"));
    await waitText(b.driver, "Head of Talent");
  });
});
