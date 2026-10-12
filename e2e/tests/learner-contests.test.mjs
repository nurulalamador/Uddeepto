import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { By, api, apiOk, chooseOption, click, clickButton, clickLink, count, exists, find, go, hasText, isShown, q, setValue, signIn, sleep, texts, type, unique, upload, useBrowser, visible, waitGone, waitNoText, waitText, waitUrl, xText } from "../lib/browser.mjs";
import { fixture } from "../lib/fixtures.mjs";
import { makeContest, makeLearner, notificationsOf, seed } from "../lib/factory.mjs";

const contestCard = (name) => `//article[.//h2[normalize-space(.)=${q(name)}] or .//h3[normalize-space(.)=${q(name)}]]`;
const tab = (name) => By.xpath(`//div[contains(@class,'contest-tabs')]//button[normalize-space(.)='${name}']`);
const tabNames = (driver) => texts(driver, By.css(".contest-tabs button"));
/** Everything inside the "Your submissions" card. */
const submissionsText = (driver) =>
  driver.executeScript("const h=[...document.querySelectorAll('h2')].find(e=>e.textContent.trim()==='Your submissions'); return h ? h.parentElement.innerText : ''");
async function waitSubmissions(driver, predicate, message) {
  let last = "";
  await driver.wait(async () => predicate((last = await submissionsText(driver))), 12000, `${message}
--- card ---
${last}`);
}
async function open(driver, contest, who) {
  await signIn(driver, who);
  await go(driver, `/contests/${contest.id}`);
  await waitText(driver, contest.name);
}
/** The rails hold only a handful of cards, so find a contest by searching for its (unique) name. */
async function findInList(driver, name) {
  await go(driver, "/contests");
  await waitText(driver, "Ongoing Contests");
  await type(driver, By.css("input[aria-label='Search contests…']"), name);
  await waitText(driver, name);
}
async function joinFromHero(driver) {
  await click(driver, By.xpath("//header[contains(@class,'contest-hero')]//button[contains(normalize-space(.),'Join contest')]"));
  await waitText(driver, "You’ve joined the contest.");
}

describe("Learner · Contest lists", () => {
  const b = useBrowser();

  it("ongoing and upcoming contests are shown in their own sections with a countdown", async () => {
    const live = await makeContest({ name: unique("Live list"), phase: "live" });
    const soon = await makeContest({ name: unique("Soon list"), phase: "upcoming", category: "design", type: "drawing" });
    await signIn(b.driver, "learner");
    await findInList(b.driver, live.name);
    await waitText(b.driver, "Ongoing Contests");
    await waitText(b.driver, "Ending in");
    await findInList(b.driver, soon.name);
    await waitText(b.driver, "Upcoming Contests");
    await waitText(b.driver, "Starting in");
  });

  it("a card shows its interest, dates, number of participants and entry fee", async () => {
    const live = await makeContest({ name: unique("Card facts"), phase: "live" });
    await signIn(b.driver, "learner");
    await findInList(b.driver, live.name);
    const text = await b.driver.executeScript(
      "const h=[...document.querySelectorAll('h2,h3')].find(e=>e.textContent.trim()===arguments[0]); let c=h; while(c && !c.matches('article')) c=c.parentElement; return (c||h.parentElement).innerText;",
      live.name,
    );
    assert.match(text, /Web Development/);
    assert.match(text, /0 participants?/);
    assert.match(text, /Entry fee/i);
    assert.match(text, /Free/);
  });

  it("draft contests are never listed", async () => {
    const draft = await makeContest({ name: unique("Hidden contest"), status: "draft" });
    await signIn(b.driver, "learner");
    await go(b.driver, "/contests");
    await waitText(b.driver, "Ongoing Contests");
    await sleep(600);
    assert.equal(await hasText(b.driver, draft.name), false);
  });

  it("the interest filter limits contests to one interest", async () => {
    const tag = unique("Filtered").replace(/ /g, "");
    const design = await makeContest({ name: `${tag} design`, phase: "live", category: "design", type: "drawing" });
    const web = await makeContest({ name: `${tag} web`, phase: "live", category: "web" });
    await signIn(b.driver, "learner");
    await findInList(b.driver, tag);
    await chooseOption(b.driver, "Filter interest", "Graphic Design");
    await waitText(b.driver, design.name);
    assert.equal(await hasText(b.driver, web.name), false, "the Web contest is filtered out");
  });

  it("searching by name finds the contest", async () => {
    const needle = await makeContest({ name: unique("Needle sprint"), phase: "live" });
    await makeContest({ name: unique("Other sprint"), phase: "live" });
    await signIn(b.driver, "learner");
    await go(b.driver, "/contests");
    await type(b.driver, By.css("input[aria-label='Search contests…']"), needle.name);
    await waitText(b.driver, needle.name);
    await waitNoText(b.driver, "Other sprint");
  });

  it("a contest the learner joined is marked 'Joined' in the list", async () => {
    const learner = await makeLearner("joiner");
    const live = await makeContest({ name: unique("Joined mark"), phase: "live" });
    await apiOk(learner, `frontend/contests/${live.id}/join`, { method: "POST" });
    await signIn(b.driver, learner);
    await findInList(b.driver, live.name);
    assert.ok(await isShown(b.driver, By.xpath(`//*[contains(@class,'joined-tag')][ancestor::*[.//*[normalize-space(.)=${q(live.name)}]]]`)));
  });

  it("a card's View button opens the contest", async () => {
    const live = await makeContest({ name: unique("View me"), phase: "live" });
    await signIn(b.driver, "learner");
    await findInList(b.driver, live.name);
    await click(b.driver, By.xpath(`//a[contains(@href,'/contests/${live.id}')]`));
    await waitUrl(b.driver, `/contests/${live.id}`);
    await waitText(b.driver, "About this contest");
  });

  it("'See Previous Contests' lists finished contests as Ended", async () => {
    const past = await makeContest({ name: unique("Finished"), phase: "past", status: "completed" });
    await signIn(b.driver, "learner");
    await go(b.driver, "/contests");
    await waitText(b.driver, "Ongoing Contests");
    await clickLink(b.driver, "See Previous Contests");
    await waitUrl(b.driver, "/contests/previous");
    await waitText(b.driver, past.name);
    await waitText(b.driver, "Ended");
    await waitText(b.driver, "Previous contests");
  });
});

describe("Learner · Joining a contest", () => {
  const b = useBrowser();

  it("the contest page shows what it is, when it runs and who runs it", async () => {
    const contest = await makeContest({ name: unique("Facts"), phase: "live" });
    await open(b.driver, contest, "learner");
    await waitText(b.driver, "Live now");
    await waitText(b.driver, "About this contest");
    await waitText(b.driver, "At a glance");
    await waitText(b.driver, "ORGANIZER");
    await waitText(b.driver, "Ada Admin");
    assert.ok(await isShown(b.driver, By.xpath("//button[contains(normalize-space(.),'Join contest')]")));
  });

  it("an ongoing contest without problems has Details, Submission and Participants tabs", async () => {
    const contest = await makeContest({ name: unique("No problems"), phase: "live" });
    await open(b.driver, contest, "learner");
    assert.deepEqual(await tabNames(b.driver), ["Details", "Submission", "Participants"]);
  });

  it("with problems there is a Problems tab listing each problem and its points", async () => {
    const contest = await makeContest({ name: unique("With problems"), phase: "live", problems: [{ name: "Add numbers", points: 100 }, { name: "Multiply", points: 50 }] });
    await open(b.driver, contest, "learner");
    assert.deepEqual(await tabNames(b.driver), ["Details", "Problems", "Submission", "Participants"]);
    await click(b.driver, tab("Problems"));
    await waitText(b.driver, "Add numbers");
    await waitText(b.driver, "Multiply");
    await waitText(b.driver, "100");
  });

  it("an upcoming contest can be joined but has no problems or submission yet", async () => {
    const contest = await makeContest({ name: unique("Later"), phase: "upcoming", problems: [{ name: "Hidden until start" }] });
    const learner = await makeLearner("early");
    await open(b.driver, contest, learner);
    await waitText(b.driver, "Upcoming");
    assert.deepEqual(await tabNames(b.driver), ["Details", "Participants"]);
    await joinFromHero(b.driver);
  });

  it("joining a free contest confirms it, updates the count and the hero", async () => {
    const contest = await makeContest({ name: unique("Join me"), phase: "live" });
    const learner = await makeLearner("joiner2");
    await open(b.driver, contest, learner);
    await waitText(b.driver, "0 participants");
    await joinFromHero(b.driver);
    await waitText(b.driver, "You’re in this contest");
    await waitText(b.driver, "1 participants");
    assert.equal(await exists(b.driver, By.xpath("//header//button[contains(normalize-space(.),'Join contest')]")), false);
    assert.ok(await isShown(b.driver, xText("Make a submission", { tag: "button" })));
  });

  it("someone who has not joined is asked to join before submitting", async () => {
    const contest = await makeContest({ name: unique("Join first"), phase: "live" });
    const learner = await makeLearner("cautious");
    await open(b.driver, contest, learner);
    await click(b.driver, tab("Submission"));
    await waitText(b.driver, "Join to submit");
    await waitText(b.driver, "You need to join this contest before you can make a submission.");
    await click(b.driver, By.xpath("//*[contains(@class,'card')][.//h2[normalize-space(.)='Join to submit']]//button[contains(normalize-space(.),'Join contest')]"));
    await waitText(b.driver, "Submit your solution");
  });

  it("the participants tab lists who joined", async () => {
    const contest = await makeContest({ name: unique("Roster"), phase: "live" });
    const learner = await makeLearner("roster");
    await apiOk(learner, `frontend/contests/${contest.id}/join`, { method: "POST" });
    await open(b.driver, contest, "learner");
    await click(b.driver, tab("Participants"));
    await waitText(b.driver, learner.name);
    await waitText(b.driver, `@${learner.username}`);
  });

  it("a contest that is full cannot be joined", async () => {
    const contest = await makeContest({ name: unique("Full"), phase: "live", max: 1 });
    const first = await makeLearner("first");
    await apiOk(first, `frontend/contests/${contest.id}/join`, { method: "POST" });
    const late = await makeLearner("late");
    await open(b.driver, contest, late);
    await waitText(b.driver, "1 participants");
    assert.equal(await exists(b.driver, By.xpath("//header//button[contains(normalize-space(.),'Join contest')]")), false);
  });

  it("a paid contest shows the fee and refuses entry without a payment provider", async () => {
    const contest = await makeContest({ name: unique("Paid"), phase: "live", fee: 200 });
    const learner = await makeLearner("payer2");
    await open(b.driver, contest, learner);
    await waitText(b.driver, "Join contest · BDT 200.00");
    await click(b.driver, By.xpath("//header//button[contains(normalize-space(.),'Join contest')]"));
    await waitText(b.driver, "Paid entries need a payment provider");
  });

  it("the joined contest counts on the dashboard", async () => {
    const contest = await makeContest({ name: unique("Counted"), phase: "live" });
    const learner = await makeLearner("counter");
    await apiOk(learner, `frontend/contests/${contest.id}/join`, { method: "POST" });
    await signIn(b.driver, learner);
    await go(b.driver, "/dashboard");
    await waitText(b.driver, "Contests joined");
    assert.equal((await texts(b.driver, By.css(".ld-tile > strong")))[2], "1");
  });
});

describe("Learner · Submitting entries", () => {
  const b = useBrowser();
  const submit = () => click(b.driver, xText("Submit entry", { tag: "button" }));

  it("a code contest takes a problem, a language and the code, and lists the submission", async () => {
    const contest = await makeContest({ name: unique("Code"), phase: "live", problems: [{ name: "Add numbers" }, { name: "Multiply" }] });
    const learner = await makeLearner("coder");
    await apiOk(learner, `frontend/contests/${contest.id}/join`, { method: "POST" });
    await open(b.driver, contest, learner);
    await click(b.driver, tab("Submission"));
    await waitText(b.driver, "Submit your solution");
    assert.equal(await (await find(b.driver, xText("Submit entry", { tag: "button" }))).isEnabled(), false);
    await setValue(b.driver, By.xpath("//label[contains(normalize-space(.),'Problem')]//select"), contest.problems[1].id);
    await setValue(b.driver, By.xpath("//label[contains(normalize-space(.),'Language')]//select"), "Python");
    await type(b.driver, By.css("textarea.code-input"), "print(6 * 7)");
    assert.equal(await (await find(b.driver, xText("Submit entry", { tag: "button" }))).isEnabled(), true);
    await submit();
    await waitText(b.driver, "Submission received. Good luck!");
    await waitSubmissions(b.driver, (t) => t.includes("Multiply") && t.includes("Python") && !t.includes("No submissions yet"), "the submission should be listed with its problem and language");
  });

  it("several submissions can be made and all stay listed", async () => {
    const contest = await makeContest({ name: unique("Many"), phase: "live" });
    const learner = await makeLearner("many");
    await apiOk(learner, `frontend/contests/${contest.id}/join`, { method: "POST" });
    await open(b.driver, contest, learner);
    await click(b.driver, tab("Submission"));
    await setValue(b.driver, By.xpath("//label[contains(normalize-space(.),'Language')]//select"), "Python");
    await type(b.driver, By.css("textarea.code-input"), "first attempt");
    await submit();
    await waitSubmissions(b.driver, (t) => (t.match(/Python/g) || []).length === 1, "first submission listed");
    await type(b.driver, By.css("textarea.code-input"), "second attempt");
    await submit();
    await waitSubmissions(b.driver, (t) => (t.match(/Python/g) || []).length === 2, "both submissions listed");
  });

  it("a text contest asks for an answer", async () => {
    const contest = await makeContest({ name: unique("Essay"), phase: "live", category: "data", type: "general" });
    const learner = await makeLearner("writer", "data");
    await apiOk(learner, `frontend/contests/${contest.id}/join`, { method: "POST" });
    await open(b.driver, contest, learner);
    await click(b.driver, tab("Submission"));
    await waitText(b.driver, "Submit your entry");
    await type(b.driver, By.css("textarea"), "My written answer about data science");
    await submit();
    await waitText(b.driver, "Submission received. Good luck!");
    await waitSubmissions(b.driver, (t) => !t.includes("No submissions yet") && /submitted/i.test(t), "the answer should be listed as submitted");
  });

  it("a drawing contest takes a picture, previews it and uploads it", async () => {
    const contest = await makeContest({ name: unique("Drawing"), phase: "live", category: "design", type: "drawing" });
    const learner = await makeLearner("artist", "design");
    await apiOk(learner, `frontend/contests/${contest.id}/join`, { method: "POST" });
    await open(b.driver, contest, learner);
    await click(b.driver, tab("Submission"));
    await waitText(b.driver, "Drag and drop your image");
    assert.equal(await (await find(b.driver, xText("Submit entry", { tag: "button" }))).isEnabled(), false);
    await upload(b.driver, By.css(".dropzone input[type=file]"), fixture("pixel.png"));
    await visible(b.driver, By.css("img.submission-image"));
    await type(b.driver, By.css("textarea"), "My first drawing");
    await submit();
    await waitText(b.driver, "Submission received. Good luck!");
    await waitSubmissions(b.driver, (t) => !t.includes("No submissions yet"), "the drawing should be listed");
  });

  it("a singing contest takes a recording", async () => {
    const contest = await makeContest({ name: unique("Singing"), phase: "live", category: "music", type: "singing" });
    const learner = await makeLearner("singer", "music");
    await apiOk(learner, `frontend/contests/${contest.id}/join`, { method: "POST" });
    await open(b.driver, contest, learner);
    await click(b.driver, tab("Submission"));
    await waitText(b.driver, "Drag and drop your recording");
    await upload(b.driver, By.css(".dropzone input[type=file]"), fixture("song.mp3"));
    await visible(b.driver, By.css("audio.submission-audio"));
    await submit();
    await waitText(b.driver, "Submission received. Good luck!");
  });

  it("the participants tab shows a participant's points after the judges score an entry", async () => {
    const contest = await makeContest({ name: unique("Scored"), phase: "live", problems: [{ name: "Only problem", points: 100 }] });
    const learner = await makeLearner("scored");
    await apiOk(learner, `frontend/contests/${contest.id}/join`, { method: "POST" });
    await apiOk(learner, `frontend/contests/${contest.id}/submit`, { method: "POST", body: { problem_id: contest.problems[0].id, content: "answer", language: "Python" } });
    const submissions = await apiOk("admin", `frontend/manage/contests/${contest.id}/submissions`);
    await apiOk("admin", `frontend/manage/submissions/${submissions[0].id}`, { method: "PATCH", body: { score: 80, status: "accepted" } });
    await open(b.driver, contest, learner);
    await click(b.driver, tab("Participants"));
    await waitText(b.driver, "80 pts");
  });
});

describe("Learner · Contest results", () => {
  const b = useBrowser();

  it("judging an entry notifies the participant and the result is shown on the contest page", async () => {
    const contest = await makeContest({ name: unique("Judged"), phase: "live", problems: [{ name: "Task", points: 100 }] });
    const learner = await makeLearner("judged");
    await apiOk(learner, `frontend/contests/${contest.id}/join`, { method: "POST" });
    await apiOk(learner, `frontend/contests/${contest.id}/submit`, { method: "POST", body: { problem_id: contest.problems[0].id, content: "solution", language: "Python" } });
    const [submission] = await apiOk("admin", `frontend/manage/contests/${contest.id}/submissions`);
    await apiOk("admin", `frontend/manage/submissions/${submission.id}`, { method: "PATCH", body: { score: 90, status: "accepted" } });
    const note = (await notificationsOf(learner)).find((n) => n.type === "contest_submission_judged");
    assert.equal(note.title, `Your submission in ${contest.name} was accepted`);
    await open(b.driver, contest, learner);
    await click(b.driver, tab("Submission"));
    await waitSubmissions(b.driver, (t) => /accepted/i.test(t) && t.includes("90 pts"), "the judged result should be listed");
  });

  it("when a contest ends the participants get their final rank in a notification", async () => {
    const contest = await makeContest({ name: unique("Ended"), phase: "live", problems: [{ name: "Task", points: 100 }] });
    const winner = await makeLearner("winner");
    const other = await makeLearner("other");
    for (const person of [winner, other]) await apiOk(person, `frontend/contests/${contest.id}/join`, { method: "POST" });
    await apiOk(winner, `frontend/contests/${contest.id}/submit`, { method: "POST", body: { problem_id: contest.problems[0].id, content: "great", language: "Python" } });
    const [submission] = await apiOk("admin", `frontend/manage/contests/${contest.id}/submissions`);
    await apiOk("admin", `frontend/manage/submissions/${submission.id}`, { method: "PATCH", body: { score: 100, status: "accepted" } });
    await apiOk("admin", `frontend/admin/contests/${contest.id}`, { method: "PATCH", body: { status: "completed" } });
    const won = (await notificationsOf(winner)).find((n) => n.type === "contest_result");
    assert.equal(won.title, `You won ${contest.name}!`);
    assert.equal(won.body, "Your final rank is #1 with 100 points.");
    const lost = (await notificationsOf(other)).find((n) => n.type === "contest_result");
    assert.match(lost.title, new RegExp(`You finished #2 in ${contest.name}`));
  });

  it("a finished contest shows 'Ended', a Results tab with the ranking, and cannot be joined", async () => {
    const contest = await makeContest({ name: unique("Over"), phase: "live", problems: [{ name: "Task", points: 100 }] });
    const winner = await makeLearner("champion");
    await apiOk(winner, `frontend/contests/${contest.id}/join`, { method: "POST" });
    await apiOk(winner, `frontend/contests/${contest.id}/submit`, { method: "POST", body: { problem_id: contest.problems[0].id, content: "great", language: "Python" } });
    const [submission] = await apiOk("admin", `frontend/manage/contests/${contest.id}/submissions`);
    await apiOk("admin", `frontend/manage/submissions/${submission.id}`, { method: "PATCH", body: { score: 75, status: "accepted" } });
    await apiOk("admin", `frontend/admin/contests/${contest.id}`, { method: "PATCH", body: { status: "completed" } });
    await open(b.driver, contest, "learner");
    await waitText(b.driver, "Ended");
    assert.equal(await exists(b.driver, By.xpath("//header//button[contains(normalize-space(.),'Join contest')]")), false);
    const names = await tabNames(b.driver);
    assert.ok(names.includes("Results"), names.join(","));
    await click(b.driver, tab("Results"));
    await waitText(b.driver, winner.name);
    await waitText(b.driver, "75");
  });

  it("a cancelled contest tells the participants", async () => {
    const contest = await makeContest({ name: unique("Called off"), phase: "upcoming" });
    const learner = await makeLearner("sad");
    await apiOk(learner, `frontend/contests/${contest.id}/join`, { method: "POST" });
    await apiOk("admin", `frontend/admin/contests/${contest.id}`, { method: "PATCH", body: { status: "cancelled" } });
    const note = (await notificationsOf(learner)).find((n) => n.type === "contest_cancelled");
    assert.equal(note.title, `${contest.name} was cancelled`);
    await open(b.driver, contest, learner);
    await waitText(b.driver, "Cancelled");
  });
});
