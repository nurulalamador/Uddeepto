import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { By, apiOk, chooseOption, click, clickButton, clickLink, count, dropdownValue, exists, find, go, hasText, isShown, q, signIn, sleep, texts, type, unique, useBrowser, visible, waitGone, waitNoText, waitText, waitUrl, xText } from "../lib/browser.mjs";
import { makeCourse, makeLearner, seed } from "../lib/factory.mjs";

const courseCard = (title) => `//article[contains(@class,'catalog-card')][.//h2[normalize-space(.)=${q(title)}]]`;
const titles = (driver) => texts(driver, By.css("article.catalog-card h2"));
const searchBox = By.css("input[aria-label='Search courses…']");
/** Opens the Explore tab (a learner who has enrolled somewhere starts on 'My learning'). */
async function explore(driver, who = "learner") {
  await signIn(driver, who);
  await go(driver, "/courses");
  await waitText(driver, "Explore Courses");
  const active = await texts(driver, By.css(".courses-sticky .tabs button.active"));
  if (active[0] !== "Explore Courses") await clickButton(driver, "Explore courses");
  await waitText(driver, "Newest first");
}

describe("Learner · Browsing courses", () => {
  const b = useBrowser();

  it("lists published courses with category, instructor and price", async () => {
    const course = await makeCourse({ title: unique("Browse me"), price: 0 });
    await explore(b.driver);
    await type(b.driver, searchBox, course.title);
    await visible(b.driver, By.xpath(courseCard(course.title)));
    const card = courseCard(course.title);
    assert.ok(await isShown(b.driver, By.xpath(card + "//*[contains(normalize-space(.),'Web Development')]")));
    assert.ok(await isShown(b.driver, By.xpath(card + "//*[contains(normalize-space(.),'Dr. Iris Instructor')]")));
    assert.equal(await (await find(b.driver, By.xpath(card + "//footer/strong"))).getText(), "Free");
    assert.ok(await isShown(b.driver, By.xpath(card + "//a[contains(normalize-space(.),'View details')]")));
  });

  it("a paid course shows its price in BDT", async () => {
    const course = await makeCourse({ title: unique("Paid listing"), price: 750 });
    await explore(b.driver);
    await type(b.driver, searchBox, course.title);
    await visible(b.driver, By.xpath(courseCard(course.title)));
    assert.equal(await (await find(b.driver, By.xpath(courseCard(course.title) + "//footer/strong"))).getText(), "BDT 750.00");
  });

  it("drafts are never listed", async () => {
    const draft = await makeCourse({ title: unique("Secret draft"), status: "draft" });
    await explore(b.driver);
    await type(b.driver, searchBox, draft.title);
    await waitText(b.driver, "No courses yet");
    assert.equal(await hasText(b.driver, draft.title), false);
  });

  it("the search box narrows the list to matching titles", async () => {
    const tag = unique("Zebra");
    const match = await makeCourse({ title: `${tag} Course` });
    const other = await makeCourse({ title: unique("Unrelated") });
    await explore(b.driver);
    await type(b.driver, searchBox, tag);
    await visible(b.driver, By.xpath(courseCard(match.title)));
    await b.driver.wait(async () => JSON.stringify(await titles(b.driver)) === JSON.stringify([match.title]), 8000, `list was ${await titles(b.driver)}`);
    assert.ok(!(await titles(b.driver)).includes(other.title));
  });

  it("the interest filter shows only courses of that interest", async () => {
    const design = await makeCourse({ title: unique("Design only"), category: "design" });
    const web = await makeCourse({ title: unique("Web only"), category: "web" });
    await explore(b.driver);
    await chooseOption(b.driver, "Filter interest", "Graphic Design");
    await visible(b.driver, By.xpath(courseCard(design.title)));
    await b.driver.wait(async () => !(await titles(b.driver)).includes(web.title), 8000, "the Web course should be filtered out");
    await chooseOption(b.driver, "Filter interest", "All interests");
    await visible(b.driver, By.xpath(courseCard(web.title)));
  });

  it("sorting by price works in both directions", async () => {
    const tag = unique("Priced").replace(/ /g, "");
    const low = await makeCourse({ title: `${tag} low`, price: 100 });
    const high = await makeCourse({ title: `${tag} high`, price: 900 });
    const mid = await makeCourse({ title: `${tag} mid`, price: 400 });
    await explore(b.driver);
    await type(b.driver, searchBox, tag);
    await visible(b.driver, By.xpath(courseCard(high.title)));
    await chooseOption(b.driver, "Sort courses", "Price");
    await b.driver.wait(async () => JSON.stringify(await titles(b.driver)) === JSON.stringify([high.title, mid.title, low.title]), 8000, `high to low gave ${await titles(b.driver)}`);
    await click(b.driver, By.css("button.sort-direction"));
    await b.driver.wait(async () => JSON.stringify(await titles(b.driver)) === JSON.stringify([low.title, mid.title, high.title]), 8000, `low to high gave ${await titles(b.driver)}`);
  });

  it("the sort direction button is disabled until a sort is chosen", async () => {
    await explore(b.driver);
    await waitText(b.driver, "Newest first");
    assert.equal(await (await find(b.driver, By.css("button.sort-direction"))).isEnabled(), false);
    await chooseOption(b.driver, "Sort courses", "Total materials");
    assert.equal(await (await find(b.driver, By.css("button.sort-direction"))).isEnabled(), true);
  });

  it("a learner with interests sees a 'Recommended for you' rail", async () => {
    await explore(b.driver);
    await waitText(b.driver, "Recommended for you");
    await waitText(b.driver, "Courses that match your interests.");
  });

  it("a learner who has not enrolled anywhere starts on Explore and 'My learning' says so", async () => {
    const fresh = await makeLearner("explorer");
    await signIn(b.driver, fresh);
    await go(b.driver, "/courses");
    await waitText(b.driver, "Explore Courses");
    assert.equal((await texts(b.driver, By.css(".courses-sticky .tabs button")))[0], "Explore Courses", "Explore comes first");
    await clickButton(b.driver, "My learning");
    await waitText(b.driver, "You haven’t enrolled in a course yet");
  });

  it("a learner who has enrolled lands on 'My learning' first with a progress bar", async () => {
    const learner = await makeLearner("enrolled");
    const course = await makeCourse({ title: unique("Mine") });
    await apiOk(learner, `courses/${course.id}/enroll`, { method: "POST" });
    await signIn(b.driver, learner);
    await go(b.driver, "/courses");
    await waitText(b.driver, course.title);
    assert.deepEqual(await titles(b.driver), [course.title]);
    assert.ok(await isShown(b.driver, By.css("[aria-label='Course progress']")), "progress bar");
    assert.ok(await isShown(b.driver, By.css("[aria-label='Enrolled']")));
    await clickButton(b.driver, "Explore courses");
    await waitText(b.driver, "Newest first");
  });
});

describe("Learner · A course page", () => {
  const b = useBrowser();

  it("shows the course summary, its content list, the instructor and the price", async () => {
    const course = await makeCourse({ title: unique("Detail"), price: 0 });
    await signIn(b.driver, "learner");
    await go(b.driver, `/courses/${course.id}`);
    await waitText(b.driver, course.title);
    await waitText(b.driver, "About this course");
    await waitText(b.driver, "Course content");
    await waitText(b.driver, "Your instructor");
    await waitText(b.driver, "Dr. Iris Instructor");
    await waitText(b.driver, "2 learning materials");
    assert.ok(await isShown(b.driver, xText("Enroll now", { tag: "button" })));
  });

  it("before enrolling only the free preview opens; other lessons are locked", async () => {
    const course = await makeCourse({ title: unique("Locked") });
    await signIn(b.driver, "learner");
    await go(b.driver, `/courses/${course.id}`);
    await waitText(b.driver, "Free preview");
    assert.equal(await count(b.driver, By.css("a.curriculum-open")), 1);
    assert.ok(await isShown(b.driver, By.css(".curriculum-locked")));
  });

  it("a free preview can be read before enrolling and says so", async () => {
    const course = await makeCourse({ title: unique("Preview") });
    await signIn(b.driver, "learner");
    await go(b.driver, `/courses/${course.id}/materials/${course.materials[0].id}`);
    await waitText(b.driver, "First lesson text.");
    await waitText(b.driver, "You’re viewing a free preview.");
  });

  it("a locked lesson cannot be opened by its address", async () => {
    const course = await makeCourse({ title: unique("Locked direct") });
    await signIn(b.driver, "learner");
    await go(b.driver, `/courses/${course.id}/materials/${course.materials[1].id}`);
    await waitText(b.driver, "Enroll in this course to open this material");
    assert.equal(await hasText(b.driver, "Second lesson text."), false);
  });

  it("enrolling in a free course confirms, opens the lessons and shows 0% progress", async () => {
    const learner = await makeLearner("enroller");
    const course = await makeCourse({ title: unique("Free enrol") });
    await signIn(b.driver, learner);
    await go(b.driver, `/courses/${course.id}`);
    await click(b.driver, xText("Enroll now", { tag: "button" }));
    await waitText(b.driver, "You’re enrolled. Your next chapter starts now.");
    await waitText(b.driver, "Start learning");
    assert.equal(await exists(b.driver, xText("Enroll now", { tag: "button" })), false);
    assert.equal(await count(b.driver, By.css("a.curriculum-open")), 2);
    await waitText(b.driver, "1 learner");
  });

  it("a paid course cannot be taken without payment", async () => {
    const learner = await makeLearner("payer");
    const course = await makeCourse({ title: unique("Needs payment"), price: 300 });
    await signIn(b.driver, learner);
    await go(b.driver, `/courses/${course.id}`);
    await waitText(b.driver, "BDT 300.00");
    await click(b.driver, xText("Enroll now", { tag: "button" }));
    await waitText(b.driver, "Complete payment before enrollment");
    assert.ok(await isShown(b.driver, xText("Enroll now", { tag: "button" })));
  });

  it("the instructor's name leads to the instructor's page with their courses", async () => {
    const course = await makeCourse({ title: unique("Taught") });
    await signIn(b.driver, "learner");
    await go(b.driver, `/courses/${course.id}`);
    await click(b.driver, By.css("a.course-hero-instructor"));
    await waitUrl(b.driver, /^\/instructors\//);
    await waitText(b.driver, "Dr. Iris Instructor");
    await waitText(b.driver, "Senior Instructor");
    await waitText(b.driver, course.title);
  });

  it("the page opens back on the course list from the top-bar arrow", async () => {
    const course = await makeCourse({ title: unique("Back") });
    await signIn(b.driver, "learner");
    await go(b.driver, `/courses/${course.id}`);
    await waitText(b.driver, course.title);
    await click(b.driver, By.css(".post-detail-back"));
    await waitUrl(b.driver, /^\/courses$/);
  });
});

describe("Learner · Learning a course", () => {
  const b = useBrowser();

  async function enrolledIn(materials) {
    const learner = await makeLearner("student");
    const course = await makeCourse({ title: unique("Study"), materials });
    await apiOk(learner, `courses/${course.id}/enroll`, { method: "POST" });
    return { learner, course };
  }

  it("opening a lesson shows its text and the lesson list with a position", async () => {
    const { learner, course } = await enrolledIn([{ name: "Intro", text: "Welcome text here", preview: true }, { name: "Deep dive", text: "Deep text here" }]);
    await signIn(b.driver, learner);
    await go(b.driver, `/courses/${course.id}/materials/${course.materials[0].id}`);
    await waitText(b.driver, "Welcome text here");
    await waitText(b.driver, "1 of 2 materials");
    assert.deepEqual(await texts(b.driver, By.css(".material-sidebar li, aside li")), ["1. Intro", "2. Deep dive"]);
  });

  it("reading a lesson marks it complete and moves the progress bar", async () => {
    const { learner, course } = await enrolledIn([{ name: "One", text: "t1", preview: true }, { name: "Two", text: "t2" }]);
    await signIn(b.driver, learner);
    await go(b.driver, `/courses/${course.id}/materials/${course.materials[0].id}`);
    await waitText(b.driver, "50% complete");
    await waitText(b.driver, "1 of 2 materials");
  });

  it("'Next' goes to the following lesson and finishing the last one completes the course", async () => {
    const { learner, course } = await enrolledIn([{ name: "One", text: "t1", preview: true }, { name: "Two", text: "t2" }]);
    await signIn(b.driver, learner);
    await go(b.driver, `/courses/${course.id}/materials/${course.materials[0].id}`);
    await waitText(b.driver, "50% complete");
    await clickLink(b.driver, "Next");
    await waitUrl(b.driver, course.materials[1].id);
    await waitText(b.driver, "100% complete");
    await waitText(b.driver, "2 of 2 materials");
    const mine = await apiOk(learner, "frontend/catalog/courses?tab=enrolled");
    assert.ok(mine.some((item) => item.id === course.id));
  });

  it("'Previous' returns to the earlier lesson and 'Back to course' to the course page", async () => {
    const { learner, course } = await enrolledIn([{ name: "One", text: "t1", preview: true }, { name: "Two", text: "t2" }]);
    await signIn(b.driver, learner);
    await go(b.driver, `/courses/${course.id}/materials/${course.materials[1].id}`);
    await waitText(b.driver, "t2");
    await clickLink(b.driver, "Previous");
    await waitUrl(b.driver, course.materials[0].id);
    await click(b.driver, By.css("a[aria-label='Back to course']"));
    await waitUrl(b.driver, new RegExp(`^/courses/${course.id}$`));
  });

  it("the lesson list on the side jumps to any lesson", async () => {
    const { learner, course } = await enrolledIn([{ name: "One", text: "t1", preview: true }, { name: "Two", text: "t2" }, { name: "Three", text: "t3" }]);
    await signIn(b.driver, learner);
    await go(b.driver, `/courses/${course.id}/materials/${course.materials[0].id}`);
    await waitText(b.driver, "t1");
    await click(b.driver, By.xpath("//aside//a[contains(normalize-space(.),'3. Three')]"));
    await waitUrl(b.driver, course.materials[2].id);
    await waitText(b.driver, "t3");
  });

  it("'Continue learning' on the course page resumes at the first unfinished lesson", async () => {
    const { learner, course } = await enrolledIn([{ name: "One", text: "t1", preview: true }, { name: "Two", text: "t2" }]);
    await apiOk(learner, `frontend/courses/${course.id}/complete/${course.materials[0].id}`, { method: "PUT" });
    await signIn(b.driver, learner);
    await go(b.driver, `/courses/${course.id}`);
    await click(b.driver, xText("Continue learning", { tag: "a" }));
    await waitUrl(b.driver, course.materials[1].id);
  });

  it("a finished course counts on the dashboard", async () => {
    const { learner, course } = await enrolledIn([{ name: "Only", text: "t", preview: true }]);
    await apiOk(learner, `frontend/courses/${course.id}/complete/${course.materials[0].id}`, { method: "PUT" });
    await signIn(b.driver, learner);
    await go(b.driver, "/dashboard");
    await waitText(b.driver, "Courses completed");
    assert.deepEqual((await texts(b.driver, By.css(".ld-tile > strong"))).slice(0, 2), ["1", "1"]);
  });
});
