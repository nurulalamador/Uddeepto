// Check-point questions on video lessons. Needs the fake Gemini: run with E2E_AI_MOCK=1 (see e2e/README.md).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { By, api, apiOk, click, exists, find, go, hasText, signIn, sleep, unique, useBrowser, visible, waitGone, waitText, xText } from "../lib/browser.mjs";
import { addVideo, makeCourse, makeLearner } from "../lib/factory.mjs";

const mocked = Boolean(process.env.E2E_AI_MOCK);
const panel = By.css(".quiz-panel");
const questionFields = By.css(".quiz-panel fieldset.quiz-question");
const submit = xText("Submit answers", { tag: "button" });
const option = (question, choice) => By.xpath(`(//fieldset[contains(@class,'quiz-question')])[${question}]//label[contains(@class,'quiz-option')][${choice}]`);

async function setup(tag = "viewer") {
  const course = await makeCourse({ title: unique("Quiz course"), materials: [] });
  const video = await addVideo(course, unique("Intro to recursion"));
  const learner = await makeLearner(tag);
  await apiOk(learner, `courses/${course.id}/enroll`, { method: "POST" });
  return { course, video, learner };
}
const route = (ctx, checkpoint) => `frontend/courses/${ctx.course.id}/materials/${ctx.video.id}/quiz/${checkpoint}`;
const play = (b) => b.driver.executeScript("const v=document.querySelector('.quiz-video .vp video'); v.muted=true; return v.play().then(()=>true)");
const jump = (b, seconds) => b.driver.executeScript("document.querySelector('.quiz-video .vp video').currentTime=arguments[0]", seconds);
const clock = (b) => b.driver.executeScript("const v=document.querySelector('.quiz-video .vp video'); return {t:v.currentTime, paused:v.paused, d:v.duration}");

describe("Learner · Video check-point questions", { skip: !mocked && "run with E2E_AI_MOCK=1" }, () => {
  const b = useBrowser();
  async function open(ctx) {
    await signIn(b.driver, ctx.learner);
    await go(b.driver, `/courses/${ctx.course.id}/materials/${ctx.video.id}`);
    await visible(b.driver, By.css(".quiz-video .vp video"));
    await b.driver.wait(async () => (await clock(b)).d > 8, 10000);
  }
  /** Picks option `choice` (1 is the right one in the fake Gemini) for every question. */
  async function answerAll(choice) {
    const fields = (await b.driver.findElements(questionFields)).length;
    for (let q = 1; q <= fields; q++) await click(b.driver, option(q, choice));
  }
  async function waitPanel() {
    await visible(b.driver, panel);
    await visible(b.driver, questionFields);
  }

  it("the lesson explains that questions will appear", async () => {
    const ctx = await setup();
    await open(ctx);
    await waitText(b.driver, "Questions will appear a third of the way through");
  });

  it("the video stops at one third and asks three questions", async () => {
    const ctx = await setup();
    await open(ctx);
    await jump(b, 2);
    await play(b);
    await waitPanel();
    assert.equal((await b.driver.findElements(questionFields)).length, 3);
    assert.equal((await clock(b)).paused, true);
    await waitText(b.driver, "Quick check · 1 of 3");
    await waitText(b.driver, "Answer at least 2 of 3 correctly to keep watching.");
  });

  it("the submit button waits until every question is answered", async () => {
    const ctx = await setup();
    await open(ctx);
    await jump(b, 2.9);
    await play(b);
    await waitPanel();
    assert.equal(await (await find(b.driver, submit)).isEnabled(), false);
    await click(b.driver, option(1, 1));
    assert.equal(await (await find(b.driver, submit)).isEnabled(), false);
    await answerAll(1);
    assert.equal(await (await find(b.driver, submit)).isEnabled(), true);
  });

  it("dragging the bar past the first check-point is stopped there", async () => {
    const ctx = await setup();
    await open(ctx);
    await jump(b, 8);
    await waitPanel();
    const { t } = await clock(b);
    assert.ok(t >= 2.8 && t <= 3.1, `parked at ${t}`);
  });

  it("wrong answers keep the learner out and do not give the answers away", async () => {
    const ctx = await setup();
    await open(ctx);
    await jump(b, 2.9);
    await play(b);
    await waitPanel();
    await answerAll(2);
    await click(b.driver, submit);
    await waitText(b.driver, "0 of 3 correct.");
    await waitText(b.driver, "You need at least 2 to continue.");
    assert.equal(await exists(b.driver, By.css(".quiz-option.correct")), false);
    assert.equal((await clock(b)).paused, true);
    await waitText(b.driver, "Watch the first part again from the start and try again.");
    assert.equal(await exists(b.driver, xText("Try again", { tag: "button" })), false);
    await click(b.driver, xText("Watch again", { tag: "button" }));
    await waitGone(b.driver, panel);
    await b.driver.wait(async () => (await clock(b)).t < 1.5, 3000, "the video should be back at the start");
  });

  /** Fails the check at `checkpoint` (earlier ones are passed through the API) and returns where the video went. */
  async function failAt(checkpoint, seekTo) {
    const ctx = await setup();
    for (let step = 1; step < checkpoint; step++) {
      await apiOk(ctx.learner, route(ctx, step));
      await apiOk(ctx.learner, route(ctx, step), { method: "POST", body: { answers: [0, 0, 0] } });
    }
    await open(ctx);
    await jump(b, seekTo);
    await play(b);
    await waitPanel();
    await answerAll(2);
    await click(b.driver, submit);
    await waitText(b.driver, "0 of 3 correct.");
    await click(b.driver, xText("Watch again", { tag: "button" }));
    await waitGone(b.driver, panel);
    await sleep(300);
    return clock(b);
  }

  it("failing the second check sends the video back to one third", async () => {
    const { t } = await failAt(2, 5.9);
    assert.ok(t >= 2.8 && t < 4.5, `rewound to ${t}`);
  });

  it("failing the final check sends the video back to two thirds", async () => {
    const { t } = await failAt(3, 8.5);
    assert.ok(t >= 5.8 && t < 7.5, `rewound to ${t}`);
  });

  it("after watching the part again the same check-point asks again", async () => {
    const { t } = await failAt(2, 5.9);
    assert.ok(t < 4.5);
    await jump(b, 5.9);
    await play(b);
    await waitText(b.driver, "Quick check · 2 of 3");
    await waitPanel();
  });

  it("two right answers out of three are enough to carry on", async () => {
    const ctx = await setup();
    await open(ctx);
    await jump(b, 2.9);
    await play(b);
    await waitPanel();
    await click(b.driver, option(1, 1));
    await click(b.driver, option(2, 1));
    await click(b.driver, option(3, 2));
    await click(b.driver, submit);
    await waitText(b.driver, "2 of 3 correct.");
    await waitText(b.driver, "You can keep watching.");
  });

  it("passing the first check-point resumes the video, and the second one stops it at two thirds", async () => {
    const ctx = await setup();
    await open(ctx);
    await jump(b, 2.9);
    await play(b);
    await waitPanel();
    await answerAll(1);
    await click(b.driver, submit);
    await waitText(b.driver, "3 of 3 correct.");
    await waitText(b.driver, "Because Intro to recursion");
    await click(b.driver, xText("Continue watching", { tag: "button" }));
    await waitGone(b.driver, panel);
    await jump(b, 5.9);
    await play(b);
    await waitText(b.driver, "Quick check · 2 of 3");
    await waitPanel();
  });

  it("a later check-point cannot be answered before the earlier ones", async () => {
    const ctx = await setup();
    await apiOk(ctx.learner, route(ctx, 3));
    const early = await api(ctx.learner, route(ctx, 3), { method: "POST", body: { answers: [0, 0, 0] } });
    assert.equal(early.status, 409);
    const second = await api(ctx.learner, route(ctx, 2), { method: "POST", body: { answers: [0, 0, 0] } });
    assert.equal(second.status, 409);
  });

  it("finishing the video asks the final questions, and passing them completes the lesson", async () => {
    const ctx = await setup();
    for (const checkpoint of [1, 2]) {
      const quiz = await apiOk(ctx.learner, route(ctx, checkpoint));
      assert.equal(quiz.questions.length, 3);
      const result = await apiOk(ctx.learner, route(ctx, checkpoint), { method: "POST", body: { answers: [0, 0, 0] } });
      assert.equal(result.passed, true);
    }
    await open(ctx);
    await jump(b, 8.5);
    await play(b);
    await waitText(b.driver, "Final check");
    await waitPanel();
    await waitText(b.driver, "Answer at least 2 of 3 correctly to complete this lesson.");
    await answerAll(1);
    await click(b.driver, submit);
    await waitText(b.driver, "Lesson completed - well done!");
    const course = await apiOk(ctx.learner, `frontend/courses/${ctx.course.id}`);
    assert.equal(course.materials.find((m) => m.id === ctx.video.id).completed, true);
    assert.equal(course.progress_done, 1);
  });

  it("opening the video does not complete the lesson", async () => {
    const ctx = await setup();
    await open(ctx);
    await sleep(500);
    const course = await apiOk(ctx.learner, `frontend/courses/${ctx.course.id}`);
    assert.equal(course.materials.find((m) => m.id === ctx.video.id).completed, false);
  });

  it("a completed lesson plays without any questions", async () => {
    const ctx = await setup();
    for (const checkpoint of [1, 2, 3]) {
      await apiOk(ctx.learner, route(ctx, checkpoint));
      await apiOk(ctx.learner, route(ctx, checkpoint), { method: "POST", body: { answers: [0, 0, 0] } });
    }
    await signIn(b.driver, ctx.learner);
    await go(b.driver, `/courses/${ctx.course.id}/materials/${ctx.video.id}`);
    await visible(b.driver, By.css(".viewer-body video"));
    assert.equal(await exists(b.driver, By.css(".quiz-video")), false);
    assert.equal(await hasText(b.driver, "Questions will appear"), false);
  });

  it("the questions are written once and everyone gets the same ones", async () => {
    const ctx = await setup();
    const other = await makeLearner("second");
    await apiOk(other, `courses/${ctx.course.id}/enroll`, { method: "POST" });
    const first = await apiOk(ctx.learner, route(ctx, 1));
    const second = await apiOk(other, route(ctx, 1));
    assert.deepEqual(first.questions.map((q) => q.id), second.questions.map((q) => q.id));
    assert.match(first.questions[0].question, /Intro to recursion/);
  });

  it("the right answers are never sent with the questions", async () => {
    const ctx = await setup();
    const quiz = await apiOk(ctx.learner, route(ctx, 1));
    assert.ok(quiz.questions.every((q) => !("correct_index" in q) && !("explanation" in q)));
  });

  it("answers must cover every question", async () => {
    const ctx = await setup();
    await apiOk(ctx.learner, route(ctx, 1));
    const short = await api(ctx.learner, route(ctx, 1), { method: "POST", body: { answers: [0] } });
    assert.equal(short.status, 422);
  });

  it("only enrolled learners can open check-point questions", async () => {
    const ctx = await setup();
    const outsider = await makeLearner("outsider");
    assert.equal((await api(outsider, route(ctx, 1))).status, 403);
  });

  it("only video lessons have check-points", async () => {
    const course = await makeCourse({ title: unique("Text only course") });
    const learner = await makeLearner("textreader");
    await apiOk(learner, `courses/${course.id}/enroll`, { method: "POST" });
    const refused = await api(learner, `frontend/courses/${course.id}/materials/${course.materials[0].id}/quiz/1`);
    assert.equal(refused.status, 404);
  });

  it("a hirer cannot use check-point questions", async () => {
    const ctx = await setup();
    assert.equal((await api("hirer", route(ctx, 1))).status, 403);
  });

  it("renaming the course makes fresh questions", async () => {
    const ctx = await setup();
    const before = await apiOk(ctx.learner, route(ctx, 1));
    await apiOk("admin", `frontend/admin/courses/${ctx.course.id}`, { method: "PATCH", body: { title: unique("Renamed quiz course") } });
    const after = await apiOk(ctx.learner, route(ctx, 1));
    assert.notDeepEqual(before.questions.map((q) => q.id), after.questions.map((q) => q.id));
  });
});
