// The custom video player (it replaces the browser's own controls). Needs the fake Gemini: E2E_AI_MOCK=1.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { By, Key, apiOk, click, go, setValue, signIn, sleep, unique, useBrowser, visible, waitText } from "../lib/browser.mjs";
import { addVideo, makeCourse, makeLearner } from "../lib/factory.mjs";

const mocked = Boolean(process.env.E2E_AI_MOCK);
const shown = (label) => By.css(`.vp [aria-label="${label}"]`);
const clock = (b) => b.driver.executeScript("const v=document.querySelector('.vp video'); return {t:v.currentTime, paused:v.paused, d:v.duration}");

async function setup() {
  const course = await makeCourse({ title: unique("Player course"), materials: [] });
  const video = await addVideo(course, unique("Player lesson"));
  const learner = await makeLearner("watcher");
  await apiOk(learner, `courses/${course.id}/enroll`, { method: "POST" });
  return { course, video, learner };
}
const route = (ctx, checkpoint) => `frontend/courses/${ctx.course.id}/materials/${ctx.video.id}/quiz/${checkpoint}`;
const passAll = async (ctx, steps) => {
  for (const checkpoint of steps) {
    await apiOk(ctx.learner, route(ctx, checkpoint));
    await apiOk(ctx.learner, route(ctx, checkpoint), { method: "POST", body: { answers: [0, 0, 0] } });
  }
};

describe("Learner · Custom video player", { skip: !mocked && "run with E2E_AI_MOCK=1" }, () => {
  const b = useBrowser();
  async function open(ctx) {
    await signIn(b.driver, ctx.learner);
    await go(b.driver, `/courses/${ctx.course.id}/materials/${ctx.video.id}`);
    await visible(b.driver, By.css(".vp video"));
    await b.driver.wait(async () => (await clock(b)).d > 8, 10000);
  }

  it("uses its own controls instead of the browser's", async () => {
    const ctx = await setup();
    await open(ctx);
    assert.equal(await b.driver.executeScript("return document.querySelector('.vp video').controls"), false);
    for (const label of ["Play", "Seek", "Mute", "Volume", "Playback speed", "Full screen"]) await visible(b.driver, shown(label));
  });

  it("shows the elapsed and total time", async () => {
    const ctx = await setup();
    await open(ctx);
    await waitText(b.driver, "0:00 / 0:09");
  });

  it("the play button starts and pauses the video", async () => {
    const ctx = await setup();
    await open(ctx);
    await click(b.driver, shown("Play"));
    await b.driver.wait(async () => (await clock(b)).paused === false, 4000);
    await click(b.driver, shown("Pause"));
    await b.driver.wait(async () => (await clock(b)).paused === true, 4000);
  });

  it("clicking the picture toggles playback too", async () => {
    const ctx = await setup();
    await open(ctx);
    await click(b.driver, By.css(".vp-stage"));
    await b.driver.wait(async () => (await clock(b)).paused === false, 4000);
    await click(b.driver, By.css(".vp-stage"));
    await b.driver.wait(async () => (await clock(b)).paused === true, 4000);
  });

  it("the speed button cycles through the playback speeds", async () => {
    const ctx = await setup();
    await open(ctx);
    const rate = () => b.driver.executeScript("return document.querySelector('.vp video').playbackRate");
    assert.equal(await rate(), 1);
    await click(b.driver, shown("Playback speed"));
    assert.equal(await rate(), 1.25);
    await click(b.driver, shown("Playback speed"));
    assert.equal(await rate(), 1.5);
  });

  it("the mute button switches the sound off and on", async () => {
    const ctx = await setup();
    await open(ctx);
    await click(b.driver, shown("Mute"));
    assert.equal(await b.driver.executeScript("return document.querySelector('.vp video').muted"), true);
    await click(b.driver, shown("Unmute"));
    assert.equal(await b.driver.executeScript("return document.querySelector('.vp video').muted"), false);
  });

  it("the progress bar marks both check-points", async () => {
    const ctx = await setup();
    await open(ctx);
    assert.equal((await b.driver.findElements(By.css(".vp-marker"))).length, 2);
    assert.equal((await b.driver.findElements(By.css(".vp-marker.done"))).length, 0);
  });

  it("a passed check-point's marker turns green", async () => {
    const ctx = await setup();
    await passAll(ctx, [1]);
    await open(ctx);
    assert.equal((await b.driver.findElements(By.css(".vp-marker.done"))).length, 1);
  });

  it("the progress bar moves the video, but not past a check-point that is still locked", async () => {
    const ctx = await setup();
    await open(ctx);
    await setValue(b.driver, By.css(".vp-seek input[type=range]"), "1.5");
    await b.driver.wait(async () => Math.abs((await clock(b)).t - 1.5) < 0.3, 3000);
    await setValue(b.driver, By.css(".vp-seek input[type=range]"), "8");
    await sleep(500);
    assert.ok((await clock(b)).t <= 3.1, "the bar cannot be dragged beyond the first check-point");
  });

  it("the keyboard works: space toggles and the arrow keys move", async () => {
    const ctx = await setup();
    await open(ctx);
    await click(b.driver, By.css(".vp-stage"));
    await b.driver.wait(async () => (await clock(b)).paused === false, 4000);
    await b.driver.actions().sendKeys(" ").perform();
    await b.driver.wait(async () => (await clock(b)).paused === true, 4000);
    const before = (await clock(b)).t;
    await b.driver.actions().sendKeys(Key.ARROW_RIGHT).perform();
    await b.driver.wait(async () => (await clock(b)).t > before + 1, 3000);
  });

  it("a completed lesson uses the same player, with no check-point markers", async () => {
    const ctx = await setup();
    await passAll(ctx, [1, 2, 3]);
    await open(ctx);
    assert.equal(await b.driver.executeScript("return document.querySelector('.vp video').controls"), false);
    assert.equal((await b.driver.findElements(By.css(".vp-marker"))).length, 0);
    assert.equal((await b.driver.findElements(By.css(".viewer-body .vp"))).length, 1);
  });
});
