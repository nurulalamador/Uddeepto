import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { By, apiOk, chooseOption, click, clickLink, exists, find, go, hasText, isShown, q, signIn, sleep, texts, type, unique, useBrowser, visible, waitText, waitUrl, xText } from "../lib/browser.mjs";
import { makeLearner, makeWebinar, notificationsOf } from "../lib/factory.mjs";

const tabs = (driver) => texts(driver, By.css(".contest-tabs button"));
async function findInList(driver, name) {
  await go(driver, "/webinars");
  await waitText(driver, "Upcoming Webinars");
  await type(driver, By.css("input[aria-label='Search webinars…']"), name);
  await waitText(driver, name);
}
async function open(driver, webinar, who) {
  await signIn(driver, who);
  await go(driver, `/webinars/${webinar.id}`);
  await waitText(driver, webinar.name);
}
const hero = (rest) => By.xpath(`//header[contains(@class,'contest-hero')]${rest}`);

describe("Learner · Webinar lists", () => {
  const b = useBrowser();

  it("the page has Ongoing and Upcoming sections and a link to previous webinars", async () => {
    await signIn(b.driver, "learner");
    await go(b.driver, "/webinars");
    await waitText(b.driver, "Ongoing Webinars");
    await waitText(b.driver, "Upcoming Webinars");
    assert.ok(await isShown(b.driver, xText("See Previous Webinars", { tag: "a" })));
  });

  it("an upcoming webinar card shows its speaker, time, seats and a countdown", async () => {
    const webinar = await makeWebinar({ name: unique("Card webinar"), capacity: 40 });
    await signIn(b.driver, "learner");
    await findInList(b.driver, webinar.name);
    await waitText(b.driver, "Dr. Iris Instructor");
    await waitText(b.driver, "0 registered · 40 seats");
    await waitText(b.driver, "Starting in");
    await waitText(b.driver, "Upcoming");
  });

  it("a webinar that is on right now appears under Ongoing with 'Ending in'", async () => {
    const webinar = await makeWebinar({ name: unique("On air"), when: "live" });
    await signIn(b.driver, "learner");
    await findInList(b.driver, webinar.name);
    await waitText(b.driver, "Ongoing Webinars");
    await waitText(b.driver, "Ending in");
  });

  it("an empty Ongoing section explains that nobody is live", async () => {
    await signIn(b.driver, "learner");
    await go(b.driver, "/webinars");
    await type(b.driver, By.css("input[aria-label='Search webinars…']"), "zzzz-no-such-webinar-zzzz");
    await waitText(b.driver, "No webinars are live");
  });

  it("draft webinars are never listed", async () => {
    const draft = await makeWebinar({ name: unique("Draft webinar"), status: "draft" });
    await signIn(b.driver, "learner");
    await go(b.driver, "/webinars");
    await waitText(b.driver, "Upcoming Webinars");
    await type(b.driver, By.css("input[aria-label='Search webinars…']"), draft.name);
    await sleep(800);
    assert.equal(await hasText(b.driver, draft.name), false);
  });

  it("the interest filter limits webinars to one interest", async () => {
    const tag = unique("Filtered").replace(/ /g, "");
    const design = await makeWebinar({ name: `${tag} design`, category: "design" });
    const web = await makeWebinar({ name: `${tag} web`, category: "web" });
    await signIn(b.driver, "learner");
    await findInList(b.driver, tag);
    await chooseOption(b.driver, "Filter interest", "Graphic Design");
    await waitText(b.driver, design.name);
    assert.equal(await hasText(b.driver, web.name), false);
  });

  it("View opens the webinar page", async () => {
    const webinar = await makeWebinar({ name: unique("Open me") });
    await signIn(b.driver, "learner");
    await findInList(b.driver, webinar.name);
    await click(b.driver, By.xpath(`//a[contains(@href,'/webinars/${webinar.id}')]`));
    await waitUrl(b.driver, `/webinars/${webinar.id}`);
    await waitText(b.driver, "About this webinar");
  });

  it("previous webinars have their own page", async () => {
    const past = await makeWebinar({ name: unique("Old webinar"), when: "past", status: "completed" });
    await signIn(b.driver, "learner");
    await go(b.driver, "/webinars");
    await clickLink(b.driver, "See Previous Webinars");
    await waitUrl(b.driver, "/webinars/previous");
    await type(b.driver, By.css("input[aria-label^='Search']:not([aria-label='Search Uddeepto'])"), past.name);
    await waitText(b.driver, past.name);
    await waitText(b.driver, "Ended");
  });
});

describe("Learner · A webinar page", () => {
  const b = useBrowser();

  it("shows the webinar, its speaker and the schedule", async () => {
    const webinar = await makeWebinar({ name: unique("Detail webinar"), capacity: 25 });
    await open(b.driver, webinar, "learner");
    await waitText(b.driver, "Upcoming");
    await waitText(b.driver, "Dr. Iris Instructor");
    await waitText(b.driver, "0 / 25 registered");
    await waitText(b.driver, "About this webinar");
    await waitText(b.driver, "At a glance");
    assert.ok(await isShown(b.driver, xText("Reserve my place", { tag: "button" })));
  });

  it("the Speakers tab introduces each speaker", async () => {
    const webinar = await makeWebinar({ name: unique("Speakers webinar") });
    await open(b.driver, webinar, "learner");
    await click(b.driver, By.xpath("//div[contains(@class,'contest-tabs')]//button[normalize-space(.)='Speakers']"));
    await waitText(b.driver, "Dr. Iris Instructor");
    await waitText(b.driver, "Senior Instructor");
  });

  it("reserving a place registers the learner and explains when the meeting link opens", async () => {
    const webinar = await makeWebinar({ name: unique("Reserve"), capacity: 10 });
    const learner = await makeLearner("attendee");
    await open(b.driver, webinar, learner);
    await click(b.driver, xText("Reserve my place", { tag: "button" }));
    await waitText(b.driver, "Your place is reserved.");
    await waitText(b.driver, "You’re registered");
    await waitText(b.driver, "The meeting link opens 15 minutes before the start");
    await waitText(b.driver, "1 / 10 registered");
    assert.equal(await exists(b.driver, xText("Reserve my place", { tag: "button" })), false);
  });

  it("the meeting link is offered once the webinar is about to begin", async () => {
    const webinar = await makeWebinar({ name: unique("Opening"), when: "opening", meeting: "https://meet.example.com/opening-room" });
    const learner = await makeLearner("early");
    await apiOk(learner, `frontend/webinars/${webinar.id}/join`, { method: "POST" });
    await open(b.driver, webinar, learner);
    const link = await visible(b.driver, By.xpath("//a[contains(normalize-space(.),'Join meeting')]"));
    assert.equal(await link.getAttribute("href"), "https://meet.example.com/opening-room");
    assert.equal(await link.getAttribute("target"), "_blank");
    assert.match(await link.getAttribute("rel"), /noopener/);
  });

  it("a webinar that is live shows 'Live now' and the link", async () => {
    const webinar = await makeWebinar({ name: unique("Live webinar"), when: "live" });
    const learner = await makeLearner("viewer");
    await apiOk(learner, `frontend/webinars/${webinar.id}/join`, { method: "POST" });
    await open(b.driver, webinar, learner);
    await waitText(b.driver, "Live now");
    await visible(b.driver, By.xpath("//a[contains(normalize-space(.),'Join meeting')]"));
  });

  it("a full webinar says so and offers no reservation", async () => {
    const webinar = await makeWebinar({ name: unique("Packed"), capacity: 1 });
    await apiOk(await makeLearner("first"), `frontend/webinars/${webinar.id}/join`, { method: "POST" });
    await open(b.driver, webinar, await makeLearner("second"));
    await waitText(b.driver, "This webinar is full");
    assert.equal(await exists(b.driver, xText("Reserve my place", { tag: "button" })), false);
  });

  it("a finished webinar with a recording links to it", async () => {
    // The seeded "Past Design Webinar" carries a recording address.
    await signIn(b.driver, "learner");
    await go(b.driver, "/webinars/previous");
    await type(b.driver, By.css("input[aria-label^='Search']:not([aria-label='Search Uddeepto'])"), "Past Design Webinar");
    await click(b.driver, By.xpath("//a[contains(@href,'/webinars/') and not(contains(@href,'previous'))]"));
    await waitText(b.driver, "Ended");
    const link = await visible(b.driver, By.xpath("//a[contains(normalize-space(.),'Watch recording')]"));
    assert.equal(await link.getAttribute("href"), "https://example.com/recording");
  });

  it("a finished webinar without a recording says it is not available", async () => {
    const webinar = await makeWebinar({ name: unique("No recording"), when: "past", status: "completed" });
    await open(b.driver, webinar, "learner");
    await waitText(b.driver, "Recording isn’t available yet");
    assert.equal(await exists(b.driver, xText("Reserve my place", { tag: "button" })), false);
  });

  it("a cancelled webinar tells everyone who registered", async () => {
    const webinar = await makeWebinar({ name: unique("Called off webinar") });
    const learner = await makeLearner("registered");
    await apiOk(learner, `frontend/webinars/${webinar.id}/join`, { method: "POST" });
    await apiOk("admin", `frontend/admin/webinars/${webinar.id}`, { method: "PATCH", body: { status: "cancelled" } });
    const note = (await notificationsOf(learner)).find((n) => n.type === "webinar_cancelled");
    assert.equal(note.title, `${webinar.name} was cancelled`);
    await open(b.driver, webinar, learner);
    await waitText(b.driver, "This webinar was cancelled");
  });

  it("the dashboard counts booked webinars and lists them under 'Coming up'", async () => {
    const webinar = await makeWebinar({ name: unique("Booked") });
    const learner = await makeLearner("booker");
    await apiOk(learner, `frontend/webinars/${webinar.id}/join`, { method: "POST" });
    await signIn(b.driver, learner);
    await go(b.driver, "/dashboard");
    await waitText(b.driver, "Webinars booked");
    assert.equal((await texts(b.driver, By.css(".ld-tile > strong")))[4], "1");
    await waitText(b.driver, webinar.name);
  });
});

describe("Learner · Webinar notifications", () => {
  it("learners with a matching interest hear about newly scheduled webinars", async () => {
    const learner = await makeLearner("follower", "web");
    const other = await makeLearner("elsewhere", "music");
    const webinar = await makeWebinar({ name: unique("Announced") });
    const mine = (await notificationsOf(learner)).find((n) => n.type === "webinar_new");
    assert.equal(mine?.title, `New webinar: ${webinar.name}`);
    assert.equal((await notificationsOf(other)).some((n) => n.type === "webinar_new"), false, "a different interest is not told");
  });

  it("a registered learner gets a reminder when the webinar is less than a day away", async () => {
    const webinar = await makeWebinar({ name: unique("Tomorrow"), when: "soon" });
    const learner = await makeLearner("reminded");
    await apiOk(learner, `frontend/webinars/${webinar.id}/join`, { method: "POST" });
    const list = await notificationsOf(learner);
    const reminder = list.find((n) => n.type === "webinar_reminder");
    assert.equal(reminder?.title, `“${webinar.name}” starts soon`);
    assert.match(reminder.body, /Starts in about \d+ hour/);
  });
});
