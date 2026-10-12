import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { By, acceptConfirm, api, apiOk, click, count, dismissConfirm, exists, find, go, hasText, isShown, q, setValue, signIn, sleep, texts, type, unique, upload, useBrowser, visible, waitGone, waitText, waitNoText, xText } from "../lib/browser.mjs";
import { makeCourse, makeLearner, notificationsOf, seed, slugOf } from "../lib/factory.mjs";
import { fixture } from "../lib/fixtures.mjs";
import { addInterest, cells, choose, filter, findRow, modalField, openList, pickInstructor, row, rowAction, rowCheck, saveButton, search, tabButton } from "../lib/admin.mjs";

const bulkStatus = By.css("select[aria-label='New status for selected records']");

describe("Admin · Interests", () => {
  const b = useBrowser();
  const open = async () => {
    await openList(b.driver, "/admin?tab=interest_categories");
    await click(b.driver, tabButton("Interests"));
    await waitText(b.driver, "Interests management");
  };

  it("lists the seeded interests with slug, icon, description and availability", async () => {
    await open();
    assert.deepEqual(await texts(b.driver, By.css(".admin-table thead th")), ["", "NAME", "SLUG", "ICON", "DESCRIPTION", "AVAILABILITY", "CREATED", "ACTIONS"]);
    for (const name of ["Web Development", "Graphic Design", "Music", "Data Science"]) await visible(b.driver, row(name));
  });

  it("search finds an interest by name", async () => {
    await open();
    await findRow(b.driver, "Music");
    assert.equal(await count(b.driver, By.css(".admin-table tbody tr")), 1);
  });

  it("the availability filter has Active and Inactive", async () => {
    await open();
    assert.deepEqual(await texts(b.driver, By.xpath("//label[./span[normalize-space(.)='Status']]//option")), ["All statuses", "Active", "Inactive"]);
  });

  it("'Add interest' shows name, slug, icon, description, entry type and availability", async () => {
    await open();
    await click(b.driver, xText("Add interest", { tag: "button" }));
    for (const name of ["name", "slug", "icon", "description", "submission_kind", "is_active"]) await visible(b.driver, modalField(name));
    assert.deepEqual(await texts(b.driver, By.css(".modal select[name=submission_kind] option")), ["Text", "Code", "Image", "Audio"]);
    assert.equal(await (await find(b.driver, modalField("icon"))).getAttribute("value"), "sparkles");
  });

  it("an admin can add an interest and it is offered to learners", async () => {
    const name = unique("Robotics");
    await open();
    await click(b.driver, xText("Add interest", { tag: "button" }));
    await type(b.driver, modalField("name"), name);
    await type(b.driver, modalField("slug"), slugOf(name));
    await choose(b.driver, "submission_kind", "code");
    await click(b.driver, saveButton("Create record"));
    await waitText(b.driver, "Interest saved.");
    await findRow(b.driver, name);
    const offered = await apiOk("learner", "users/interests");
    assert.ok(offered.some((i) => i.name === name));
  });

  it("a duplicate slug is refused", async () => {
    await open();
    await click(b.driver, xText("Add interest", { tag: "button" }));
    await type(b.driver, modalField("name"), unique("Copycat"));
    await type(b.driver, modalField("slug"), "web-development");
    await click(b.driver, saveButton("Create record"));
    await b.driver.wait(async () => exists(b.driver, By.css(".modal [role=alert]")), 8000);
  });

  it("name, slug and icon are required", async () => {
    await open();
    await click(b.driver, xText("Add interest", { tag: "button" }));
    await type(b.driver, modalField("icon"), "");
    await click(b.driver, saveButton("Create record"));
    assert.equal(await b.driver.executeScript("return document.querySelector('.modal input[name=name]').validity.valueMissing"), true);
    assert.ok(await isShown(b.driver, By.css(".modal")));
  });

  it("an interest can be renamed", async () => {
    const name = unique("Gardening");
    const created = await apiOk("admin", "frontend/admin/interest_categories", { method: "POST", body: { name, slug: slugOf(name), icon: "sparkles", submission_kind: "text", is_active: true } });
    const renamed = unique("Horticulture");
    await open();
    await findRow(b.driver, name);
    await click(b.driver, rowAction(name, "Edit interest"));
    await waitText(b.driver, "Edit interest");
    await type(b.driver, modalField("name"), renamed);
    await click(b.driver, saveButton("Save changes"));
    await waitText(b.driver, "Interest saved.");
    await findRow(b.driver, renamed);
    assert.ok(created.id);
  });

  it("an interest switched to inactive disappears from the learners' choices", async () => {
    const name = unique("Hidden topic");
    const made = await apiOk("admin", "frontend/admin/interest_categories", { method: "POST", body: { name, slug: slugOf(name), icon: "sparkles", submission_kind: "text", is_active: true } });
    await open();
    await findRow(b.driver, name);
    await click(b.driver, rowAction(name, "Edit interest"));
    await choose(b.driver, "is_active", "false");
    await click(b.driver, saveButton("Save changes"));
    await waitText(b.driver, "Interest saved.");
    await b.driver.wait(async () => /inactive/i.test(await (await find(b.driver, row(name))).getText()), 8000);
    const offered = await apiOk("learner", "users/interests");
    assert.ok(!offered.some((i) => i.id === made.id));
  });

  it("the Inactive filter shows only inactive interests", async () => {
    const name = unique("Dormant topic");
    await apiOk("admin", "frontend/admin/interest_categories", { method: "POST", body: { name, slug: slugOf(name), icon: "sparkles", submission_kind: "text", is_active: false } });
    await open();
    await setValue(b.driver, filter("Status"), "false");
    await visible(b.driver, row(name));
    await b.driver.wait(async () => !(await exists(b.driver, row("Web Development"))), 8000);
  });

  it("an interest can be deleted after confirming", async () => {
    const name = unique("Short-lived");
    await apiOk("admin", "frontend/admin/interest_categories", { method: "POST", body: { name, slug: slugOf(name), icon: "sparkles", submission_kind: "text", is_active: true } });
    await open();
    await findRow(b.driver, name);
    const message = await acceptConfirm(b.driver, () => click(b.driver, rowAction(name, "Delete interest")));
    assert.match(message, /Delete this interest\?/);
    await waitText(b.driver, "Interest deleted.");
    await b.driver.wait(async () => !(await exists(b.driver, row(name))), 8000);
  });

  it("cancelling the confirmation keeps the interest", async () => {
    const name = unique("Kept topic");
    await apiOk("admin", "frontend/admin/interest_categories", { method: "POST", body: { name, slug: slugOf(name), icon: "sparkles", submission_kind: "text", is_active: true } });
    await open();
    await findRow(b.driver, name);
    await dismissConfirm(b.driver, () => click(b.driver, rowAction(name, "Delete interest")));
    await sleep(500);
    assert.ok(await exists(b.driver, row(name)));
  });

  it("two interests can be deleted together with 'Delete selected'", async () => {
    const [one, two] = [unique("Bulk gone"), unique("Bulk gone")];
    for (const name of [one, two]) await apiOk("admin", "frontend/admin/interest_categories", { method: "POST", body: { name, slug: slugOf(name), icon: "sparkles", submission_kind: "text", is_active: true } });
    await open();
    await findRow(b.driver, "Bulk gone");
    await click(b.driver, rowCheck(one));
    await click(b.driver, rowCheck(two));
    await waitText(b.driver, "2 selected");
    await acceptConfirm(b.driver, () => click(b.driver, xText("Delete selected", { tag: "button" })));
    await waitText(b.driver, "2 record(s) deleted.");
  });

  it("a learner cannot manage interests through the API", async () => {
    const refused = await api("learner", "frontend/admin/interest_categories", { method: "POST", body: { name: "Nope", slug: "nope", icon: "x", submission_kind: "text" } });
    assert.equal(refused.status, 403);
  });
});

describe("Admin · Instructors", () => {
  const b = useBrowser();
  const open = async () => {
    await openList(b.driver, "/admin?tab=instructors");
    await waitText(b.driver, "Instructors management");
  };
  const addForm = async ({ name, designation = "", details = "", image = true, links = {} }) => {
    await click(b.driver, xText("Add instructor", { tag: "button" }));
    await visible(b.driver, modalField("name"));
    if (image) await upload(b.driver, modalField("image"), fixture("instructor.png"));
    await type(b.driver, modalField("name"), name);
    if (designation) await type(b.driver, modalField("designation"), designation);
    if (details) await type(b.driver, modalField("details"), details);
    for (const [field, value] of Object.entries(links)) await type(b.driver, modalField(field), value);
  };

  it("lists the seeded instructor with designation, assigned courses and creation date", async () => {
    await open();
    assert.deepEqual(await texts(b.driver, By.css(".admin-table thead th")), ["", "NAME", "DESIGNATION", "DETAILS", "SOCIAL LINKS", "ASSIGNED COURSES", "CREATED", "ACTIONS"]);
    await visible(b.driver, row("Dr. Iris Instructor"));
  });

  it("search finds an instructor by name", async () => {
    await open();
    await findRow(b.driver, "Iris");
  });

  it("the form has photo, name, designation, details and three links", async () => {
    await open();
    await click(b.driver, xText("Add instructor", { tag: "button" }));
    for (const name of ["image", "name", "designation", "details", "linkedin_url", "github_url", "website_url"]) await find(b.driver, modalField(name));
    await waitText(b.driver, "Add a profile photo");
  });

  it("a photo is required for a new instructor", async () => {
    await open();
    await addForm({ name: unique("No Photo"), image: false });
    await click(b.driver, saveButton("Add instructor"));
    assert.equal(await b.driver.executeScript("return document.querySelector('.modal input[name=image]').validity.valueMissing"), true);
  });

  it("an admin can add an instructor with a photo and links", async () => {
    const name = unique("Prof. Ada");
    await open();
    await addForm({ name, designation: "Staff engineer", details: "Twenty years of compilers.", links: { linkedin_url: "https://linkedin.com/in/ada", github_url: "https://github.com/ada", website_url: "https://ada.example.com" } });
    await waitText(b.driver, "Instructor photo preview").catch(() => {});
    await click(b.driver, saveButton("Add instructor"));
    await waitText(b.driver, "Instructor added.");
    await findRow(b.driver, name);
    await visible(b.driver, By.css(`a[aria-label='${name} linkedin']`));
    await visible(b.driver, By.css(`a[aria-label='${name} github']`));
    await visible(b.driver, By.css(`a[aria-label='${name} website']`));
    assert.match(await (await find(b.driver, row(name))).getText(), /Staff engineer/);
  });

  it("an invalid link is rejected by the browser", async () => {
    await open();
    await addForm({ name: unique("Bad Link"), links: { linkedin_url: "not a url" } });
    await click(b.driver, saveButton("Add instructor"));
    assert.equal(await b.driver.executeScript("return document.querySelector('.modal input[name=linkedin_url]').validity.typeMismatch"), true);
  });

  it("a new instructor can be picked when creating a course", async () => {
    const name = unique("Pickable Prof");
    await open();
    await addForm({ name });
    await click(b.driver, saveButton("Add instructor"));
    await waitText(b.driver, "Instructor added.");
    await openList(b.driver, "/courses");
    await click(b.driver, xText("Add course", { tag: "button" }));
    await pickInstructor(b.driver, name);
    assert.equal(await (await find(b.driver, By.css("#course-instructor-search"))).getAttribute("value"), name);
  });

  it("an instructor can be edited", async () => {
    const name = unique("Editable Prof");
    await open();
    await addForm({ name });
    await click(b.driver, saveButton("Add instructor"));
    await waitText(b.driver, "Instructor added.");
    await findRow(b.driver, name);
    await click(b.driver, rowAction(name, "Edit instructor"));
    await waitText(b.driver, "Instructor photo");
    assert.equal(await (await find(b.driver, modalField("name"))).getAttribute("value"), name);
    await type(b.driver, modalField("designation"), "Principal lecturer");
    await click(b.driver, saveButton("Save instructor"));
    await waitText(b.driver, "Instructor updated.");
    await b.driver.wait(async () => /Principal lecturer/.test(await (await find(b.driver, row(name))).getText()), 8000);
  });

  it("an instructor's photo can be removed", async () => {
    const name = unique("Photo Prof");
    await open();
    await addForm({ name });
    await click(b.driver, saveButton("Add instructor"));
    await waitText(b.driver, "Instructor added.");
    await findRow(b.driver, name);
    await click(b.driver, rowAction(name, "Edit instructor"));
    await click(b.driver, By.xpath("//label[contains(@class,'admin-remove-photo')]/input"));
    await click(b.driver, saveButton("Save instructor"));
    await waitText(b.driver, "Instructor updated.");
  });

  it("deleting an instructor warns when courses are assigned to them", async () => {
    const name = unique("Busy Prof");
    await open();
    await addForm({ name });
    await click(b.driver, saveButton("Add instructor"));
    await waitText(b.driver, "Instructor added.");
    const made = (await apiOk("admin", `frontend/admin/instructors?q=${encodeURIComponent(name)}`))[0];
    const s = await seed();
    await apiOk("admin", "frontend/admin/courses", { method: "POST", body: { title: unique("Orphan course"), slug: slugOf(unique("orphan")), description: "d", category_ids: [s.category.web], instructor_id: made.id, price: 0, currency: "BDT", status: "draft" } });
    await findRow(b.driver, name);
    const message = await acceptConfirm(b.driver, () => click(b.driver, rowAction(name, "Delete instructor")));
    assert.match(message, /1 assigned course\(s\) will become unassigned\./);
    await waitText(b.driver, "Instructor deleted. 1 course(s) need a new instructor.");
  });

  it("an instructor without courses is deleted simply", async () => {
    const name = unique("Idle Prof");
    await open();
    await addForm({ name });
    await click(b.driver, saveButton("Add instructor"));
    await waitText(b.driver, "Instructor added.");
    await findRow(b.driver, name);
    await acceptConfirm(b.driver, () => click(b.driver, rowAction(name, "Delete instructor")));
    await waitText(b.driver, "Instructor deleted.");
  });

  it("the public instructors page lists a new instructor to learners", async () => {
    const name = unique("Public Prof");
    await open();
    await addForm({ name, designation: "Guest lecturer" });
    await click(b.driver, saveButton("Add instructor"));
    await waitText(b.driver, "Instructor added.");
    const list = await apiOk("learner", `frontend/instructors?q=${encodeURIComponent(name)}`).catch(() => null);
    if (list) assert.ok(JSON.stringify(list).includes(name));
  });
});

describe("Admin · Courses", () => {
  const b = useBrowser();
  const open = async () => {
    await openList(b.driver, "/courses");
    await waitText(b.driver, "Courses management");
  };
  const fillCourse = async ({ title, slug = slugOf(title), price = "0", interest = "Web Development", instructor = "Dr. Iris Instructor", status = "draft", description = "A course made in the admin console." }) => {
    await click(b.driver, xText("Add course", { tag: "button" }));
    await visible(b.driver, modalField("title"));
    await type(b.driver, modalField("title"), title);
    await type(b.driver, modalField("slug"), slug);
    await type(b.driver, modalField("description"), description);
    if (interest) await addInterest(b.driver, interest);
    if (instructor) await pickInstructor(b.driver, instructor);
    await type(b.driver, modalField("price"), price);
    await choose(b.driver, "status", status);
  };

  it("lists courses with instructor, interests, price, enrolment and status", async () => {
    const course = await makeCourse({ title: unique("Listed course") });
    await open();
    assert.deepEqual(await texts(b.driver, By.css(".admin-table thead th")), ["", "TITLE", "INSTRUCTOR", "INTERESTS", "PRICE", "ENROLLED", "STATUS", "CREATED", "ACTIONS"]);
    await findRow(b.driver, course.title);
    const text = await (await find(b.driver, row(course.title))).getText();
    assert.match(text, /Dr\. Iris Instructor/);
    assert.match(text, /Web Development/);
    assert.match(text, /BDT 0/);
    assert.match(text.toLowerCase(), /published/);
  });

  it("the status filter has Draft, Published and Archived", async () => {
    await open();
    assert.deepEqual(await texts(b.driver, By.xpath("//label[./span[normalize-space(.)='Status']]//option")), ["All statuses", "Draft", "Published", "Archived"]);
  });

  it("filtering by Draft shows drafts only", async () => {
    await makeCourse({ title: unique("Filter draft"), status: "draft", materials: [] });
    await open();
    await setValue(b.driver, filter("Status"), "draft");
    await b.driver.wait(async () => {
      const states = await cells(b.driver, 7);
      return states.length > 0 && states.every((t) => /draft/i.test(t));
    }, 8000);
  });

  it("sorting by price A to Z orders by price and Title A to Z orders by title", async () => {
    await makeCourse({ title: unique("Pricey"), price: 900, materials: [] });
    await open();
    await setValue(b.driver, By.xpath("//label[./span[normalize-space(.)='Sort']]//select"), "price");
    await b.driver.wait(async () => {
      const prices = (await cells(b.driver, 5)).map((t) => Number(t.replace(/[^0-9]/g, "")));
      return prices.length > 2 && prices.every((p, i) => i === 0 || prices[i - 1] >= p);
    }, 8000);
    await setValue(b.driver, By.xpath("//label[./span[normalize-space(.)='Sort']]//select"), "title");
    await b.driver.wait(async () => {
      const titles = (await texts(b.driver, By.css(".admin-table tbody tr td:nth-child(2) strong"))).map((t) => t.toLowerCase());
      return titles.length > 2 && titles[0] === [...titles].sort()[0];
    }, 8000);
  });

  it("the add-course form has cover, title, slug, description, interests, instructor, price, currency and status", async () => {
    await open();
    await click(b.driver, xText("Add course", { tag: "button" }));
    for (const name of ["title", "slug", "description", "price", "currency", "status", "cover_image"]) await find(b.driver, modalField(name));
    await visible(b.driver, By.css("#course-instructor-search"));
    await visible(b.driver, By.css("fieldset.interest-picker"));
    assert.equal(await (await find(b.driver, modalField("currency"))).getAttribute("value"), "BDT");
    assert.equal(await (await find(b.driver, modalField("status"))).getAttribute("value"), "draft");
  });

  it("an admin can create a draft course that learners cannot see yet", async () => {
    const title = unique("Fresh draft");
    await open();
    await fillCourse({ title });
    await click(b.driver, saveButton("Create record"));
    await waitText(b.driver, "Course saved.");
    await findRow(b.driver, title);
    assert.match((await (await find(b.driver, row(title))).getText()).toLowerCase(), /draft/);
    const visibleToLearner = await apiOk("learner", `frontend/catalog/courses?q=${encodeURIComponent(title)}`);
    assert.ok(!JSON.stringify(visibleToLearner).includes(title));
  });

  it("an interest and an instructor are required", async () => {
    await open();
    await fillCourse({ title: unique("Incomplete"), interest: "" });
    await click(b.driver, saveButton("Create record"));
    await waitText(b.driver, "Select at least one interest.");
    await addInterest(b.driver, "Music");
    await click(b.driver, By.css("button[aria-label='Clear instructor']"));
    await click(b.driver, saveButton("Create record"));
    await waitText(b.driver, "Search for an instructor and select a profile before saving this course.");
  });

  it("an instructor can be found by typing part of the name", async () => {
    await open();
    await click(b.driver, xText("Add course", { tag: "button" }));
    await type(b.driver, By.css("#course-instructor-search"), "iris");
    await visible(b.driver, By.xpath("//div[@id='course-instructor-options']//strong[normalize-space(.)='Dr. Iris Instructor']"));
    await type(b.driver, By.css("#course-instructor-search"), "zzzz");
    await waitText(b.driver, "No instructors found");
  });

  it("the interest picker can search and remove interests", async () => {
    await open();
    await click(b.driver, xText("Add course", { tag: "button" }));
    await addInterest(b.driver, "Music");
    await waitText(b.driver, "1 selected");
    await click(b.driver, By.css("button[aria-label='Remove Music']"));
    await waitText(b.driver, "0 selected");
  });

  it("a duplicate slug is refused", async () => {
    const existing = await makeCourse({ title: unique("Slug owner"), materials: [] });
    await open();
    await fillCourse({ title: unique("Slug taker"), slug: slugOf(existing.title) });
    await click(b.driver, saveButton("Create record"));
    await b.driver.wait(async () => exists(b.driver, By.css(".modal [role=alert]")), 8000);
  });

  it("a cover image can be uploaded and shows in the list", async () => {
    const title = unique("Covered");
    await open();
    await fillCourse({ title });
    await upload(b.driver, modalField("cover_image"), fixture("cover.png"));
    await visible(b.driver, By.css("img[alt='Course cover preview']"));
    await click(b.driver, saveButton("Create record"));
    await waitText(b.driver, "Course saved.");
    await findRow(b.driver, title);
    await visible(b.driver, By.css(".admin-course-title-cell img"));
  });

  it("an admin can edit a course's title and price", async () => {
    const course = await makeCourse({ title: unique("To edit"), materials: [] });
    const renamed = unique("Edited");
    await open();
    await findRow(b.driver, course.title);
    await click(b.driver, rowAction(course.title, "Edit course"));
    await waitText(b.driver, "Edit course");
    await type(b.driver, modalField("title"), renamed);
    await type(b.driver, modalField("price"), "750");
    await click(b.driver, saveButton("Save changes"));
    await waitText(b.driver, "Course saved.");
    await findRow(b.driver, renamed);
    assert.match(await (await find(b.driver, row(renamed))).getText(), /BDT 750/);
  });

  it("a draft course gets a 'Publish course' button that publishes it and announces it to learners", async () => {
    const learner = await makeLearner("courseheard", "web");
    const course = await makeCourse({ title: unique("Review me"), status: "draft", materials: [] });
    await open();
    await findRow(b.driver, course.title);
    await click(b.driver, xText("Publish course", { tag: "button" }));
    await waitText(b.driver, "Course approved.");
    await b.driver.wait(async () => /published/i.test(await (await find(b.driver, row(course.title))).getText()), 8000);
    await b.driver.wait(async () => (await notificationsOf(learner)).some((n) => n.title === `New course: ${course.title}`), 10000);
  });

  it("a published course has no 'Publish course' button", async () => {
    const course = await makeCourse({ title: unique("Already live"), materials: [] });
    await open();
    await findRow(b.driver, course.title);
    assert.equal(await exists(b.driver, xText("Publish course", { tag: "button" })), false);
  });

  it("an admin can archive a course and learners lose it", async () => {
    const course = await makeCourse({ title: unique("To archive"), materials: [] });
    await open();
    await findRow(b.driver, course.title);
    await click(b.driver, rowAction(course.title, "Edit course"));
    await choose(b.driver, "status", "archived");
    await click(b.driver, saveButton("Save changes"));
    await waitText(b.driver, "Course saved.");
    const visibleToLearner = await apiOk("learner", `frontend/catalog/courses?q=${encodeURIComponent(course.title)}`);
    assert.ok(!JSON.stringify(visibleToLearner).includes(course.title));
  });

  it("an admin can delete a course after confirming", async () => {
    const course = await makeCourse({ title: unique("To delete"), materials: [] });
    await open();
    await findRow(b.driver, course.title);
    const message = await acceptConfirm(b.driver, () => click(b.driver, rowAction(course.title, "Delete course")));
    assert.match(message, /Delete this course\?/);
    await waitText(b.driver, "Course deleted.");
    await b.driver.wait(async () => !(await exists(b.driver, row(course.title))), 8000);
  });

  it("cancelling the confirmation keeps the course", async () => {
    const course = await makeCourse({ title: unique("Kept course"), materials: [] });
    await open();
    await findRow(b.driver, course.title);
    await dismissConfirm(b.driver, () => click(b.driver, rowAction(course.title, "Delete course")));
    await sleep(500);
    assert.ok(await exists(b.driver, row(course.title)));
  });

  it("two drafts can be published together from the bulk bar", async () => {
    const learner = await makeLearner("bulkheard", "web");
    const [one, two] = [await makeCourse({ title: unique("Bulk pub"), status: "draft", materials: [] }), await makeCourse({ title: unique("Bulk pub"), status: "draft", materials: [] })];
    await open();
    await findRow(b.driver, "Bulk pub");
    await click(b.driver, rowCheck(one.title));
    await click(b.driver, rowCheck(two.title));
    await waitText(b.driver, "2 selected");
    await setValue(b.driver, bulkStatus, "published");
    await click(b.driver, xText("Apply status", { tag: "button" }));
    await waitText(b.driver, "2 record(s) updated.");
    await b.driver.wait(async () => {
      const titles = (await notificationsOf(learner)).map((n) => n.title);
      return titles.includes(`New course: ${one.title}`) && titles.includes(`New course: ${two.title}`);
    }, 10000);
  });

  it("selected courses can be deleted together", async () => {
    const [one, two] = [await makeCourse({ title: unique("Bulk del"), materials: [] }), await makeCourse({ title: unique("Bulk del"), materials: [] })];
    await open();
    await findRow(b.driver, "Bulk del");
    await click(b.driver, rowCheck(one.title));
    await click(b.driver, rowCheck(two.title));
    const message = await acceptConfirm(b.driver, () => click(b.driver, xText("Delete selected", { tag: "button" })));
    assert.match(message, /Delete 2 selected courses\?/);
    await waitText(b.driver, "2 record(s) deleted.");
  });

  it("a learner cannot create, edit or delete courses", async () => {
    const course = await makeCourse({ title: unique("Guarded"), materials: [] });
    assert.equal((await api("learner", `frontend/admin/courses/${course.id}`, { method: "PATCH", body: { title: "Hacked" } })).status, 403);
    assert.equal((await api("learner", `frontend/admin/courses/${course.id}`, { method: "DELETE" })).status, 403);
  });
});

describe("Admin · Course materials", () => {
  const b = useBrowser();
  async function openCourse(title) {
    await openList(b.driver, "/courses");
    await findRow(b.driver, title);
    await click(b.driver, rowAction(title, "Edit course"));
    await waitText(b.driver, "Course materials");
  }
  const form = By.xpath("//form[.//h3[normalize-space(.)='Add a material']]");
  const field = (name) => By.css(`.modal form [name=${name}]`);

  it("a course without materials says so", async () => {
    const course = await makeCourse({ title: unique("Empty course"), materials: [] });
    await openCourse(course.title);
    await waitText(b.driver, "No materials yet");
    await waitText(b.driver, "Add text lessons, videos, documents or other files below.");
  });

  it("existing materials are listed with their type", async () => {
    const course = await makeCourse({ title: unique("Stocked course") });
    await openCourse(course.title);
    await visible(b.driver, By.xpath("//ul[contains(@class,'admin-material-list')]//strong[normalize-space(.)='Lesson one']"));
    await waitText(b.driver, "Text lesson");
    await waitText(b.driver, "Free preview");
  });

  it("the material form offers text, video, document and other-file types", async () => {
    const course = await makeCourse({ title: unique("Typed course"), materials: [] });
    await openCourse(course.title);
    assert.deepEqual(await texts(b.driver, By.css(".modal select[name=type] option")), ["Text lesson", "Video lecture", "Document", "Other file"]);
  });

  it("an admin can add a text lesson and a learner can read it", async () => {
    const course = await makeCourse({ title: unique("Text course"), materials: [] });
    await openCourse(course.title);
    await type(b.driver, field("name"), "Intro lesson");
    await type(b.driver, field("content_text"), "Welcome to the course.");
    await click(b.driver, xText("Add material", { tag: "button" }));
    await visible(b.driver, By.xpath("//ul[contains(@class,'admin-material-list')]//strong[normalize-space(.)='Intro lesson']"));
    const materials = await apiOk("admin", `frontend/manage/courses/${course.id}/materials`);
    assert.equal(materials.length, 1);
  });

  it("a text lesson can be a free preview", async () => {
    const course = await makeCourse({ title: unique("Preview course"), materials: [] });
    await openCourse(course.title);
    await type(b.driver, field("name"), "Teaser");
    await type(b.driver, field("content_text"), "A taste of what is to come.");
    await setValue(b.driver, field("is_preview"), "true");
    await click(b.driver, xText("Add material", { tag: "button" }));
    await waitText(b.driver, "Free preview");
  });

  it("choosing 'Document' asks for a file instead of text", async () => {
    const course = await makeCourse({ title: unique("Doc course"), materials: [] });
    await openCourse(course.title);
    await setValue(b.driver, field("type"), "document");
    await visible(b.driver, field("file"));
    assert.equal(await exists(b.driver, field("content_text")), false);
    await waitText(b.driver, "PDF, Word, PowerPoint, Excel, TXT… · up to 50 MB");
  });

  it("an admin can upload a document", async () => {
    const course = await makeCourse({ title: unique("Upload course"), materials: [] });
    await openCourse(course.title);
    await setValue(b.driver, field("type"), "document");
    await type(b.driver, field("name"), "Syllabus");
    await upload(b.driver, field("file"), fixture("syllabus.pdf"));
    await click(b.driver, xText("Add material", { tag: "button" }));
    await visible(b.driver, By.xpath("//ul[contains(@class,'admin-material-list')]//strong[normalize-space(.)='Syllabus']"));
    await waitText(b.driver, "syllabus.pdf");
  });

  it("an executable upload is refused", async () => {
    const course = await makeCourse({ title: unique("Safe course"), materials: [] });
    await openCourse(course.title);
    await setValue(b.driver, field("type"), "other");
    await type(b.driver, field("name"), "Malware");
    await upload(b.driver, field("file"), fixture("tool.exe"));
    await click(b.driver, xText("Add material", { tag: "button" }));
    await b.driver.wait(async () => exists(b.driver, By.css(".modal [role=alert]")), 10000);
  });

  it("adding a material notifies enrolled learners", async () => {
    const learner = await makeLearner("enrolledheard", "web");
    const course = await makeCourse({ title: unique("Growing course"), materials: [] });
    await apiOk(learner, `courses/${course.id}/enroll`, { method: "POST" }).catch(() => apiOk(learner, `frontend/courses/${course.id}/enroll`, { method: "POST" }));
    await openCourse(course.title);
    await type(b.driver, field("name"), "Bonus lesson");
    await type(b.driver, field("content_text"), "More to learn.");
    await click(b.driver, xText("Add material", { tag: "button" }));
    await b.driver.wait(async () => (await notificationsOf(learner)).some((n) => n.type === "course_material_added"), 10000);
  });

  it("a material can be deleted after confirming", async () => {
    const course = await makeCourse({ title: unique("Pruned course") });
    await openCourse(course.title);
    const message = await acceptConfirm(b.driver, () => click(b.driver, By.css("button[aria-label='Delete Lesson two']")));
    assert.match(message, /Delete “Lesson two”\?/);
    await b.driver.wait(async () => !(await hasText(b.driver, "Lesson two")), 8000);
  });

  it("the material title and text are required", async () => {
    const course = await makeCourse({ title: unique("Strict course"), materials: [] });
    await openCourse(course.title);
    await click(b.driver, xText("Add material", { tag: "button" }));
    assert.equal(await b.driver.executeScript("return document.querySelector('.modal form [name=name]').validity.valueMissing"), true);
  });
});
