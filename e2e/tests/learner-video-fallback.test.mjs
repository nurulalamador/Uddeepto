// Without a Gemini key (the default for this suite) check-points are skipped: a video completes when it ends.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { By, apiOk, exists, go, signIn, unique, useBrowser, visible } from "../lib/browser.mjs";
import { addVideo, makeCourse, makeLearner } from "../lib/factory.mjs";

describe("Learner · Video lessons when the AI is unavailable", { skip: Boolean(process.env.E2E_AI_MOCK) && "the AI is mocked in this run" }, () => {
  const b = useBrowser();

  it("the video plays without questions and is completed when it reaches the end", async () => {
    const course = await makeCourse({ title: unique("Fallback course"), materials: [] });
    const video = await addVideo(course);
    const learner = await makeLearner("fallback");
    await apiOk(learner, `courses/${course.id}/enroll`, { method: "POST" });
    await signIn(b.driver, learner);
    await go(b.driver, `/courses/${course.id}/materials/${video.id}`);
    await visible(b.driver, By.css(".quiz-video .vp video"));
    await b.driver.wait(async () => (await b.driver.executeScript("return document.querySelector('.quiz-video .vp video').duration")) > 8, 10000);
    await b.driver.executeScript("const v=document.querySelector('.quiz-video .vp video'); v.muted=true; v.currentTime=8; v.play().catch(() => {}); return true");
    await b.driver.wait(async () => (await apiOk(learner, `frontend/courses/${course.id}`)).materials.find((m) => m.id === video.id).completed, 25000, "the video never completed");
    assert.equal(await exists(b.driver, By.css(".quiz-panel")), false);
  });

  it("the questions endpoint answers 'unavailable' rather than failing", async () => {
    const course = await makeCourse({ title: unique("Fallback api course"), materials: [] });
    const video = await addVideo(course);
    const learner = await makeLearner("fallbackapi");
    await apiOk(learner, `courses/${course.id}/enroll`, { method: "POST" });
    const quiz = await apiOk(learner, `frontend/courses/${course.id}/materials/${video.id}/quiz/1`);
    assert.equal(quiz.available, false);
  });
});
