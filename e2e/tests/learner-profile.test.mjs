import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { By, acceptConfirm, apiOk, chooseOption, click, clickButton, count, currentPath, exists, find, go, hasText, isShown, q, setValue, signIn, sleep, texts, type, unique, upload, useBrowser, visible, waitGone, waitText, waitTextCI, waitUrl, xText } from "../lib/browser.mjs";
import { fixture } from "../lib/fixtures.mjs";
import { makeLearner, makePost } from "../lib/factory.mjs";

const named = (n) => By.css(`.modal [name=${n}]`);
const timelineCard = (title) => `//li[.//div[contains(@class,'pf-tl-card')]//h3[normalize-space(.)=${q(title)}]]//div[contains(@class,'pf-tl-card')]`;
async function openOwn(driver, who) {
  await signIn(driver, who);
  await go(driver, "/profile");
  await waitText(driver, "Edit profile");
}
async function openEdit(driver) {
  await clickButton(driver, "Edit profile", { exact: false });
  await waitText(driver, "Edit your profile");
}

describe("Learner · Viewing a profile", () => {
  const b = useBrowser();

  it("the own profile shows the name, username, role and join date", async () => {
    await openOwn(b.driver, "learner");
    await waitText(b.driver, "Lena Learner");
    await waitText(b.driver, "@learner1");
    await waitText(b.driver, "Joined");
    assert.ok(await isShown(b.driver, xText("Edit profile", { tag: "button" })));
  });

  it("the address becomes /profile/ plus the person's Uddeepto ID", async () => {
    await signIn(b.driver, "learner");
    await go(b.driver, "/profile");
    await waitUrl(b.driver, /^\/profile\/\d{3}-\d{3}-\d{3}$/);
  });

  it("the About section shows the bio, or a hint when there is none", async () => {
    await openOwn(b.driver, "learner");
    await waitText(b.driver, "Lena Learner lives in the E2E test data.");
    const fresh = await makeLearner("nobio");
    await openOwn(b.driver, fresh);
    await waitText(b.driver, "Add a short bio so people know who you are.");
  });

  it("the Uddeepto ID card shows the ID and a link that works", async () => {
    await openOwn(b.driver, "learner");
    const id = await (await find(b.driver, By.css(".pf-id"))).getText();
    assert.match(id, /^\d{3}-\d{3}-\d{3}$/);
    await waitText(b.driver, `Share your profile link: /profile/${id}`);
    await go(b.driver, `/profile/${id}`);
    await waitText(b.driver, "Lena Learner");
  });

  it("the Copy button on the ID confirms with 'Copied'", async () => {
    await openOwn(b.driver, "learner");
    await visible(b.driver, By.css("button.pf-copy"));
    assert.equal(await count(b.driver, By.css("button.pf-copy")), 1, "exactly one copy button");
    await click(b.driver, By.css("button.pf-copy"));
    await waitText(b.driver, "Copied");
  });

  it("interests are listed on the profile", async () => {
    await openOwn(b.driver, "learner");
    await waitText(b.driver, "Interests");
    await waitText(b.driver, "Graphic Design");
    await waitText(b.driver, "Web Development");
  });

  it("personal details are shown to the owner with 'Not added' for empty fields", async () => {
    await openOwn(b.driver, "learner");
    await waitText(b.driver, "Only you and Uddeepto admins can see this.");
    await waitText(b.driver, "learner1@e2e.test");
    await waitText(b.driver, "Not added");
  });

  it("recent showcase posts appear on the profile", async () => {
    const me = await makeLearner("poster2");
    const post = await makePost({ author: me });
    await openOwn(b.driver, me);
    await waitText(b.driver, post.content);
  });

  it("another person's public profile has no edit button, no private details and offers a message", async () => {
    await signIn(b.driver, "learner");
    await go(b.driver, "/search?q=Liam");
    await click(b.driver, By.xpath("//a[contains(@href,'/profile/')][.//*[contains(normalize-space(.),'Liam Learner')]]"));
    await waitUrl(b.driver, /^\/profile\//);
    await waitText(b.driver, "Liam Learner");
    assert.equal(await exists(b.driver, xText("Edit profile", { tag: "button" })), false);
    assert.equal(await hasText(b.driver, "Personal details"), false);
    assert.equal(await hasText(b.driver, "learner2@e2e.test"), false, "their email stays private");
    assert.ok(await isShown(b.driver, xText("Send message", { tag: "a" })));
  });

  it("an unknown ID says the profile could not be found", async () => {
    await signIn(b.driver, "learner");
    await go(b.driver, "/profile/000-000-000");
    await waitText(b.driver, "Not found");
  });
});

describe("Learner · Editing the profile", () => {
  const b = useBrowser();
  const saveProfile = () => click(b.driver, By.xpath("//*[contains(@class,'modal')]//button[contains(normalize-space(.),'Save profile')]"));

  it("name, headline and bio can be changed and are shown afterwards", async () => {
    const me = await makeLearner("editor");
    await openOwn(b.driver, me);
    await openEdit(b.driver);
    await type(b.driver, named("name"), "Edited Name");
    await type(b.driver, named("headline"), "Aspiring engineer");
    await type(b.driver, named("bio"), "I like building things.");
    await saveProfile();
    await waitGone(b.driver, By.css(".modal"));
    await waitText(b.driver, "Edited Name");
    await waitText(b.driver, "Aspiring engineer");
    await waitText(b.driver, "I like building things.");
    await b.driver.navigate().refresh();
    await waitText(b.driver, "Aspiring engineer");
  });

  it("a name shorter than two letters is refused by the form", async () => {
    const me = await makeLearner("shortname");
    await openOwn(b.driver, me);
    await openEdit(b.driver);
    await type(b.driver, named("name"), "A");
    await saveProfile();
    assert.equal(await b.driver.executeScript("return document.querySelector('.modal [name=name]').validity.tooShort"), true);
  });

  it("a username with unsafe characters is refused by the form", async () => {
    const me = await makeLearner("badusername");
    await openOwn(b.driver, me);
    await openEdit(b.driver);
    await type(b.driver, named("username"), "bad name!");
    assert.equal(await b.driver.executeScript("return document.querySelector('.modal [name=username]').validity.patternMismatch"), true);
  });

  it("a username that someone else uses is refused", async () => {
    const me = await makeLearner("copycat2");
    await openOwn(b.driver, me);
    await openEdit(b.driver);
    await type(b.driver, named("username"), "learner2");
    await saveProfile();
    await waitText(b.driver, "Already exists");
  });

  it("personal details are saved and shown only in the private panel", async () => {
    const me = await makeLearner("private");
    await openOwn(b.driver, me);
    await openEdit(b.driver);
    await type(b.driver, named("phone"), "+880 1700-000000");
    await setValue(b.driver, named("birth_date"), "2000-05-17");
    await setValue(b.driver, By.css(".modal select[name=gender]"), "female");
    await type(b.driver, named("current_address"), "House 1, Dhaka");
    await type(b.driver, named("permanent_address"), "Village, Chattogram");
    await saveProfile();
    await waitGone(b.driver, By.css(".modal"));
    await waitText(b.driver, "+880 1700-000000");
    await waitText(b.driver, "House 1, Dhaka");
    await waitText(b.driver, "Village, Chattogram");
    await waitTextCI(b.driver, "female");
    await waitText(b.driver, "May 17, 2000");
  });

  it("a phone number that is not a number is refused with a message", async () => {
    const me = await makeLearner("badphone");
    await openOwn(b.driver, me);
    await openEdit(b.driver);
    await type(b.driver, named("phone"), "call me maybe");
    await saveProfile();
    await visible(b.driver, By.css(".modal .notice.error, .modal [role=alert]"));
  });

  it("interests can be added and removed from the edit form", async () => {
    const me = await makeLearner("interested", "web");
    await openOwn(b.driver, me);
    await openEdit(b.driver);
    await click(b.driver, By.xpath("//*[contains(@class,'modal')]//button[contains(@class,'interest-chip') and contains(@class,'available')][.//span[normalize-space(.)='Music']]"));
    await saveProfile();
    await waitGone(b.driver, By.css(".modal"));
    await waitText(b.driver, "Music");
    await openEdit(b.driver);
    await click(b.driver, By.css(".modal button[aria-label='Remove Music']"));
    await saveProfile();
    await waitGone(b.driver, By.css(".modal"));
    await b.driver.wait(async () => !(await hasText(b.driver, "Music")), 8000);
    await waitText(b.driver, "Web Development");
  });

  it("a profile picture can be uploaded and then removed", async () => {
    const me = await makeLearner("pictured");
    await openOwn(b.driver, me);
    await openEdit(b.driver);
    await upload(b.driver, By.css(".modal input[type=file]"), fixture("pixel.png"));
    await saveProfile();
    await waitGone(b.driver, By.css(".modal"));
    const avatar = By.css(".sidebar .profile img.avatar-img");
    await visible(b.driver, avatar);
    assert.ok((await (await find(b.driver, avatar)).getAttribute("src")).includes(`/profile/${me.id}/picture`));
    await openEdit(b.driver);
    await click(b.driver, xText("Remove picture", { tag: "button" }));
    await saveProfile();
    await waitGone(b.driver, By.css(".modal"));
    await b.driver.wait(async () => !(await exists(b.driver, avatar)), 8000);
  });

  it("closing the form discards what was typed", async () => {
    const me = await makeLearner("discard");
    await openOwn(b.driver, me);
    await openEdit(b.driver);
    await type(b.driver, named("headline"), "Should not be saved");
    await click(b.driver, By.css("button[aria-label='Close dialog']"));
    await waitGone(b.driver, By.css(".modal"));
    assert.equal(await hasText(b.driver, "Should not be saved"), false);
  });
});

describe("Learner · Education", () => {
  const b = useBrowser();
  const submit = (label) => click(b.driver, By.xpath(`//*[contains(@class,'modal')]//button[contains(normalize-space(.),'${label}')]`));
  async function openAdd(me) {
    await openOwn(b.driver, me);
    await click(b.driver, By.xpath("//section[contains(@class,'pf-section')][.//h2[contains(normalize-space(.),'Education')]]//button[contains(@class,'pf-add')]"));
    await waitText(b.driver, "Add education");
  }
  async function addEducation(me, institution) {
    await openAdd(me);
    await type(b.driver, named("institution"), institution);
    await type(b.driver, named("degree"), "BSc");
    await type(b.driver, named("field_of_study"), "Computer Science");
    await setValue(b.driver, named("start_date"), "2018-01");
    await setValue(b.driver, named("end_date"), "2022-12");
    await type(b.driver, named("grade"), "CGPA 3.8");
    await submit("Add education");
    await waitGone(b.driver, By.css(".modal"));
    await waitText(b.driver, institution);
  }

  it("an entry with school, degree, dates and grade is added to the timeline", async () => {
    const me = await makeLearner("student2");
    await addEducation(me, "University of Dhaka");
    const text = await (await find(b.driver, By.xpath(timelineCard("University of Dhaka")))).getText();
    assert.match(text, /BSc/);
    assert.match(text, /Computer Science/);
    assert.match(text, /Jan 2018 - Dec 2022/);
    assert.match(text, /CGPA 3\.8/);
  });

  it("the school name is required", async () => {
    const me = await makeLearner("noschool");
    await openAdd(me);
    await setValue(b.driver, named("start_date"), "2018-01");
    await setValue(b.driver, named("end_date"), "2020-01");
    await submit("Add education");
    assert.equal(await b.driver.executeScript("return document.querySelector('.modal [name=institution]').validity.valueMissing"), true);
  });

  it("ticking 'I currently study here' removes the end date and shows Present", async () => {
    const me = await makeLearner("current");
    await openAdd(me);
    await type(b.driver, named("institution"), "Current University");
    await setValue(b.driver, named("start_date"), "2023-01");
    await click(b.driver, By.xpath("//*[contains(@class,'modal')]//label[contains(@class,'check-row')]"));
    assert.equal(await (await find(b.driver, named("end_date"))).isEnabled(), false);
    await submit("Add education");
    await waitGone(b.driver, By.css(".modal"));
    await waitText(b.driver, "Present");
  });

  it("an end date before the start date is refused", async () => {
    const me = await makeLearner("backwards");
    await openAdd(me);
    await type(b.driver, named("institution"), "Time Travel Academy");
    await setValue(b.driver, named("start_date"), "2022-05");
    await setValue(b.driver, named("end_date"), "2021-01");
    await submit("Add education");
    await waitText(b.driver, "The end date must be after the start date");
  });

  it("an entry can be edited", async () => {
    const me = await makeLearner("editedu");
    await addEducation(me, "Old College");
    await click(b.driver, By.xpath(timelineCard("Old College") + "//button[@aria-label='Edit']"));
    await waitText(b.driver, "Edit education");
    await type(b.driver, named("institution"), "New College");
    await submit("Save changes");
    await waitGone(b.driver, By.css(".modal"));
    await waitText(b.driver, "New College");
    assert.equal(await hasText(b.driver, "Old College"), false);
  });

  it("an entry can be deleted after confirming", async () => {
    const me = await makeLearner("deledu");
    await addEducation(me, "Short Lived School");
    const asked = await acceptConfirm(b.driver, () => click(b.driver, By.xpath(timelineCard("Short Lived School") + "//button[@aria-label='Delete']")));
    assert.equal(asked, "Remove “Short Lived School” from your education?");
    await b.driver.wait(async () => !(await hasText(b.driver, "Short Lived School")), 8000);
    await waitText(b.driver, "Add the schools, colleges and universities you attended.");
  });

  it("newer entries are listed first", async () => {
    const me = await makeLearner("ordering");
    await addEducation(me, "Earlier School");
    await openAdd(me);
    await type(b.driver, named("institution"), "Later School");
    await setValue(b.driver, named("start_date"), "2023-01");
    await setValue(b.driver, named("end_date"), "2024-06");
    await submit("Add education");
    await waitText(b.driver, "Later School");
    const order = await texts(b.driver, By.css(".pf-timeline h3"));
    assert.deepEqual(order, ["Later School", "Earlier School"]);
  });
});

describe("Learner · Experience", () => {
  const b = useBrowser();
  const submit = (label) => click(b.driver, By.xpath(`//*[contains(@class,'modal')]//button[contains(normalize-space(.),'${label}')]`));
  async function openAdd(me) {
    await openOwn(b.driver, me);
    await click(b.driver, By.xpath("//section[contains(@class,'pf-section')][.//h2[contains(normalize-space(.),'Experience')]]//button[contains(@class,'pf-add')]"));
    await waitText(b.driver, "Add experience");
  }
  async function fill(title, interest = "Web Development") {
    await type(b.driver, named("title"), title);
    await type(b.driver, named("workplace"), "Acme Ltd");
    await type(b.driver, named("location"), "Dhaka, Bangladesh");
    await chooseOption(b.driver, "Interest category of this experience", interest);
    await setValue(b.driver, named("start_date"), "2021-03");
    await setValue(b.driver, named("end_date"), "2023-08");
    await type(b.driver, named("description"), "Built many things.");
  }

  it("an experience is added with its workplace, place, dates and interest", async () => {
    const me = await makeLearner("worker");
    await openAdd(me);
    await fill("Frontend Developer");
    await submit("Add experience");
    await waitGone(b.driver, By.css(".modal"));
    await waitText(b.driver, "Frontend Developer");
    const text = await (await find(b.driver, By.xpath(timelineCard("Frontend Developer")))).getText();
    assert.match(text, /Acme Ltd/);
    assert.match(text, /Dhaka, Bangladesh/);
    assert.match(text, /Mar 2021 - Aug 2023/);
    assert.match(text, /Web Development/);
    assert.match(text, /Built many things\./);
  });

  it("title and workplace are required", async () => {
    const me = await makeLearner("incomplete");
    await openAdd(me);
    await submit("Add experience");
    assert.equal(await b.driver.executeScript("return document.querySelector('.modal [name=title]').validity.valueMissing"), true);
  });

  it("an interest must be chosen, or 'Others'", async () => {
    const me = await makeLearner("nointerest");
    await openAdd(me);
    await type(b.driver, named("title"), "Mystery job");
    await type(b.driver, named("workplace"), "Somewhere");
    await setValue(b.driver, named("start_date"), "2021-03");
    await setValue(b.driver, named("end_date"), "2022-03");
    await submit("Add experience");
    await waitText(b.driver, "Choose the interest this experience belongs to, or Others.");
  });

  it("'Others' is offered for work that fits no interest and is shown as Others", async () => {
    const me = await makeLearner("others");
    await openAdd(me);
    await fill("Family business", "Others");
    await submit("Add experience");
    await waitGone(b.driver, By.css(".modal"));
    await waitText(b.driver, "Family business");
    assert.match(await (await find(b.driver, By.xpath(timelineCard("Family business")))).getText(), /Others/);
  });

  it("a current job shows 'Present'", async () => {
    const me = await makeLearner("employed");
    await openAdd(me);
    await type(b.driver, named("title"), "Current role");
    await type(b.driver, named("workplace"), "Now Inc");
    await chooseOption(b.driver, "Interest category of this experience", "Web Development");
    await setValue(b.driver, named("start_date"), "2024-01");
    await click(b.driver, By.xpath("//*[contains(@class,'modal')]//label[contains(@class,'check-row')]"));
    await submit("Add experience");
    await waitGone(b.driver, By.css(".modal"));
    await waitText(b.driver, "Present");
  });

  it("an experience can be edited and keeps its other details", async () => {
    const me = await makeLearner("changer");
    await openAdd(me);
    await fill("Junior Developer");
    await submit("Add experience");
    await waitText(b.driver, "Junior Developer");
    await click(b.driver, By.xpath(timelineCard("Junior Developer") + "//button[@aria-label='Edit']"));
    await waitText(b.driver, "Edit experience");
    await type(b.driver, named("title"), "Senior Developer");
    await submit("Save changes");
    await waitGone(b.driver, By.css(".modal"));
    await waitText(b.driver, "Senior Developer");
    assert.match(await (await find(b.driver, By.xpath(timelineCard("Senior Developer")))).getText(), /Acme Ltd/);
  });

  it("an experience can be deleted after confirming", async () => {
    const me = await makeLearner("remover");
    await openAdd(me);
    await fill("Temporary job");
    await submit("Add experience");
    await waitText(b.driver, "Temporary job");
    const asked = await acceptConfirm(b.driver, () => click(b.driver, By.xpath(timelineCard("Temporary job") + "//button[@aria-label='Delete']")));
    assert.equal(asked, "Remove “Temporary job” from your experience?");
    await b.driver.wait(async () => !(await hasText(b.driver, "Temporary job")), 8000);
  });

  it("other people see the experience on a public profile but cannot change it", async () => {
    const me = await makeLearner("public");
    await apiOk(me, "frontend/profile/experience", { method: "POST", body: { title: "Public role", workplace: "Open Co", category_id: null, start_date: "2020-01", end_date: "2021-01" } });
    await signIn(b.driver, "learner");
    await go(b.driver, `/profile/${me.id}`);
    await waitText(b.driver, "Public role");
    assert.equal(await exists(b.driver, By.css(".pf-tl-actions")), false);
  });
});
