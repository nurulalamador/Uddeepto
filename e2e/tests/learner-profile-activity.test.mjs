// What a profile shows about activity: pictures on showcase posts and the contests a person joined.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { By, apiOk, exists, go, hasText, signIn, texts, unique, useBrowser, visible, waitText, waitUrl, xText, click } from "../lib/browser.mjs";
import { fixture } from "../lib/fixtures.mjs";
import { makeContest, makeLearner, makeHirer, seed } from "../lib/factory.mjs";

async function postWithPicture(author, content) {
  const s = await seed();
  const form = new FormData();
  form.set("category_id", s.category.web);
  form.set("content", content);
  form.append("media", new Blob([await readFile(fixture("post.png"))], { type: "image/png" }), "post.png");
  return apiOk(author, "frontend/showcase", { method: "POST", form });
}

describe("Profile · Recent showcase pictures", () => {
  const b = useBrowser();
  const card = (content) => By.xpath(`//a[contains(@class,'pf-post')][.//p[contains(normalize-space(.), ${JSON.stringify(content)})]]`);
  const loaded = (locator) => b.driver.wait(async () => b.driver.executeScript("const img=arguments[0]; return img && img.complete && img.naturalWidth > 0", await visible(b.driver, locator)), 8000, "the picture never loaded");

  it("a post with a picture shows it on the profile", async () => {
    const me = await makeLearner("pictured");
    const text = unique("Look at my picture");
    await postWithPicture(me, text);
    await signIn(b.driver, "learner");
    await go(b.driver, `/profile/${me.id}`);
    await visible(b.driver, card(text));
    await loaded(By.xpath(`//a[contains(@class,'pf-post')][.//p[contains(normalize-space(.), ${JSON.stringify(text)})]]//img[contains(@class,'pf-post-image')]`));
  });

  it("the owner sees the picture on their own profile too", async () => {
    const me = await makeLearner("ownpic");
    const text = unique("My own picture");
    await postWithPicture(me, text);
    await signIn(b.driver, me);
    await go(b.driver, "/profile");
    await loaded(By.xpath(`//a[contains(@class,'pf-post')][.//p[contains(normalize-space(.), ${JSON.stringify(text)})]]//img[contains(@class,'pf-post-image')]`));
  });

  it("a text-only post has no picture", async () => {
    const me = await makeLearner("textpost");
    const text = unique("Only words here");
    await apiOk(me, "frontend/showcase", { method: "POST", body: { category_id: (await seed()).category.web, content: text } });
    await signIn(b.driver, "learner");
    await go(b.driver, `/profile/${me.id}`);
    await visible(b.driver, card(text));
    assert.equal(await exists(b.driver, By.css(".pf-post-image")), false);
  });

  it("clicking the post opens it", async () => {
    const me = await makeLearner("clickpic");
    const text = unique("Open this picture post");
    const post = await postWithPicture(me, text);
    await signIn(b.driver, "learner");
    await go(b.driver, `/profile/${me.id}`);
    await click(b.driver, card(text));
    await waitUrl(b.driver, new RegExp(`^/showcase/${post.id}`));
  });
});

describe("Profile · Contests", () => {
  const b = useBrowser();
  const item = (name) => By.xpath(`//a[contains(@class,'pf-contest')][.//strong[normalize-space(.)=${JSON.stringify(name)}]]`);
  const join = async (who, contest) => apiOk(who, `frontend/contests/${contest.id}/join`, { method: "POST" });
  const finish = async (contest) => apiOk("admin", `frontend/admin/contests/${contest.id}`, { method: "PATCH", body: { status: "completed" } });
  const submitAndScore = async (who, contest, score) => {
    await apiOk(who, `frontend/contests/${contest.id}/submit`, { method: "POST", body: { problem_id: contest.problems[0].id, content: "answer", language: "Python" } });
    const mine = (await apiOk("admin", `frontend/manage/contests/${contest.id}/submissions`)).find((sub) => sub.name.includes(who.name));
    await apiOk("admin", `frontend/manage/submissions/${mine.id}`, { method: "PATCH", body: { score, status: "accepted" } });
  };

  it("a learner who has joined nothing sees an empty Contests section", async () => {
    const me = await makeLearner("nocontest");
    await signIn(b.driver, "learner");
    await go(b.driver, `/profile/${me.id}`);
    await waitText(b.driver, "Contests");
    await waitText(b.driver, "No contests joined yet.");
  });

  it("the owner's empty section explains how it fills up", async () => {
    const me = await makeLearner("ownnone");
    await signIn(b.driver, me);
    await go(b.driver, "/profile");
    await waitText(b.driver, "Contests you join will be listed here with your final position.");
  });

  it("a contest in progress is listed as In progress, without a rank", async () => {
    const me = await makeLearner("runner");
    const contest = await makeContest({ name: unique("Running contest"), phase: "live" });
    await join(me, contest);
    await signIn(b.driver, "learner");
    await go(b.driver, `/profile/${me.id}`);
    await visible(b.driver, item(contest.name));
    assert.match(await (await b.driver.findElement(item(contest.name))).getText(), /In progress · 1 participant/);
  });

  it("an upcoming contest is listed as Upcoming", async () => {
    const me = await makeLearner("waiter");
    const contest = await makeContest({ name: unique("Later contest"), phase: "upcoming" });
    await join(me, contest);
    await signIn(b.driver, "learner");
    await go(b.driver, `/profile/${me.id}`);
    assert.match(await (await visible(b.driver, item(contest.name)).then(() => b.driver.findElement(item(contest.name)))).getText(), /Upcoming/);
  });

  it("a completed contest shows the final position, the points and the number of participants", async () => {
    const contest = await makeContest({ name: unique("Ranked contest"), phase: "live", problems: [{ name: "Task", points: 100 }] });
    const [first, second] = [await makeLearner("gold"), await makeLearner("silver")];
    for (const who of [first, second]) await join(who, contest);
    await submitAndScore(first, contest, 90);
    await submitAndScore(second, contest, 40);
    await finish(contest);
    await signIn(b.driver, "learner");
    await go(b.driver, `/profile/${first.id}`);
    await visible(b.driver, item(contest.name));
    const winner = await (await b.driver.findElement(item(contest.name))).getText();
    assert.match(winner, /#1/);
    assert.match(winner, /Rank 1 of 2 · 90 pts/);
    await go(b.driver, `/profile/${second.id}`);
    await visible(b.driver, item(contest.name));
    assert.match(await (await b.driver.findElement(item(contest.name))).getText(), /Rank 2 of 2 · 40 pts/);
  });

  it("the podium ranks are highlighted", async () => {
    const contest = await makeContest({ name: unique("Podium contest"), phase: "live", problems: [{ name: "Task", points: 100 }] });
    const winner = await makeLearner("podium");
    await join(winner, contest);
    await submitAndScore(winner, contest, 70);
    await finish(contest);
    await signIn(b.driver, "learner");
    await go(b.driver, `/profile/${winner.id}`);
    await visible(b.driver, By.xpath(`//a[contains(@class,'pf-contest')][.//strong[normalize-space(.)=${JSON.stringify(contest.name)}]]//span[contains(@class,'pf-rank') and contains(@class,'podium') and contains(@class,'p1')]`));
  });

  it("a contest that has ended but is not completed yet says the results are pending", async () => {
    const me = await makeLearner("pending");
    const contest = await makeContest({ name: unique("Over contest"), phase: "live" });
    await join(me, contest);
    await apiOk("admin", `frontend/admin/contests/${contest.id}`, { method: "PATCH", body: { ending_time: new Date(Date.now() - 3600e3).toISOString(), starting_time: new Date(Date.now() - 86400e3).toISOString() } });
    await signIn(b.driver, "learner");
    await go(b.driver, `/profile/${me.id}`);
    await visible(b.driver, item(contest.name));
    assert.match(await (await b.driver.findElement(item(contest.name))).getText(), /Results pending/);
  });

  it("a contest in the list opens its page", async () => {
    const me = await makeLearner("opener");
    const contest = await makeContest({ name: unique("Linked contest"), phase: "live" });
    await join(me, contest);
    await signIn(b.driver, "learner");
    await go(b.driver, `/profile/${me.id}`);
    await click(b.driver, item(contest.name));
    await waitUrl(b.driver, new RegExp(`^/contests/${contest.id}`));
  });

  it("contests the person did not join are not listed", async () => {
    const me = await makeLearner("selective");
    const other = await makeContest({ name: unique("Not joined"), phase: "live" });
    const mine = await makeContest({ name: unique("Joined one"), phase: "live" });
    await join(me, mine);
    await signIn(b.driver, "learner");
    await go(b.driver, `/profile/${me.id}`);
    await visible(b.driver, item(mine.name));
    assert.equal(await exists(b.driver, item(other.name)), false);
  });

  it("hirers and admins have no Contests section", async () => {
    const hirer = await makeHirer("nocontests");
    await signIn(b.driver, hirer);
    await go(b.driver, "/profile");
    await waitText(b.driver, hirer.name);
    assert.equal(await exists(b.driver, By.css(".pf-contests")), false);
    assert.equal(await hasText(b.driver, "No contests joined yet."), false);
  });
});
