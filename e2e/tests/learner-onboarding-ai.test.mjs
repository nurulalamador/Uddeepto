import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { By, Key, api, apiOk, click, clickButton, count, exists, find, go, hasText, isShown, q, setValue, signIn, sleep, texts, type, unique, useBrowser, visible, waitGone, waitText, waitUrl, xText } from "../lib/browser.mjs";
import { makeCourse, makeUser } from "../lib/factory.mjs";
import { logout, waitWorkspace } from "../lib/flows.mjs";

const gate = By.css("dialog.interest-gate");
const option = (name) => By.xpath(`//dialog[contains(@class,'interest-gate')]//button[contains(@class,'ig-option')][.//span[contains(@class,'ig-option-name')][normalize-space(.)=${q(name)}]]`);
const NOT_CONFIGURED = "The AI assistant is not configured yet. Ask an admin to add a Gemini API key.";

describe("Learner · First-run interest question", () => {
  const b = useBrowser();
  const newcomer = () => makeUser({ role: "learner", tag: "newcomer" });

  it("a learner with no interests must answer before using the workspace", async () => {
    await signIn(b.driver, await newcomer());
    await go(b.driver, "/dashboard");
    await visible(b.driver, gate);
    await waitText(b.driver, "WELCOME TO UDDEEPTO");
    await waitText(b.driver, "Choose your interest");
  });

  it("the question lists every interest and can be searched", async () => {
    await signIn(b.driver, await newcomer());
    await go(b.driver, "/dashboard");
    await visible(b.driver, option("Web Development"));
    for (const name of ["Graphic Design", "Music", "Data Science"]) assert.ok(await isShown(b.driver, option(name)), name);
    await type(b.driver, By.css("input[aria-label='Search interests']"), "music");
    await visible(b.driver, option("Music"));
    await b.driver.wait(async () => !(await isShown(b.driver, option("Web Development"))), 5000);
    await type(b.driver, By.css("input[aria-label='Search interests']"), "zzzz");
    await waitText(b.driver, "No interests match “zzzz”.");
  });

  it("Continue stays disabled until an interest is chosen and the count follows the choices", async () => {
    await signIn(b.driver, await newcomer());
    await go(b.driver, "/dashboard");
    await waitText(b.driver, "Select at least one");
    const cont = By.xpath("//dialog//button[contains(normalize-space(.),'Continue')]");
    assert.equal(await (await find(b.driver, cont)).isEnabled(), false);
    await click(b.driver, option("Web Development"));
    await waitText(b.driver, "1 selected");
    await click(b.driver, option("Music"));
    await waitText(b.driver, "2 selected");
    assert.equal(await (await find(b.driver, option("Music"))).getAttribute("aria-pressed"), "true");
    await click(b.driver, option("Music"));
    await waitText(b.driver, "1 selected");
    assert.equal(await (await find(b.driver, cont)).isEnabled(), true);
  });

  it("saving the choice opens the workspace and keeps the interests", async () => {
    const person = await newcomer();
    await signIn(b.driver, person);
    await go(b.driver, "/dashboard");
    await click(b.driver, option("Graphic Design"));
    await click(b.driver, xText("Continue", { tag: "button" }));
    await waitGone(b.driver, gate);
    await waitText(b.driver, "Courses enrolled");
    const me = await apiOk(person, "users/me");
    assert.deepEqual(me.interests.map((i) => i.name), ["Graphic Design"]);
    await b.driver.navigate().refresh();
    await waitWorkspace(b.driver);
    assert.equal(await exists(b.driver, gate), false, "not asked again");
  });

  it("the question cannot be dismissed with Escape", async () => {
    await signIn(b.driver, await newcomer());
    await go(b.driver, "/dashboard");
    await visible(b.driver, gate);
    await click(b.driver, By.css("dialog .ig-choose header h1"));
    await b.driver.actions().sendKeys(Key.ESCAPE).perform();
    await sleep(500);
    assert.ok(await isShown(b.driver, gate));
  });

  it("the question offers Sign out", async () => {
    await signIn(b.driver, await newcomer());
    await go(b.driver, "/dashboard");
    await click(b.driver, By.css("dialog .ig-signout"));
    await waitUrl(b.driver, /^\/login/);
  });

  it("the AI guide beside it offers starting questions and answers politely when unavailable", async () => {
    await signIn(b.driver, await newcomer());
    await go(b.driver, "/dashboard");
    await waitText(b.driver, "Confused about which interest to choose?");
    const starters = await texts(b.driver, By.css(".ig-ai .ai-mini-starters button"));
    assert.equal(starters.length, 3);
    await click(b.driver, By.css(".ig-ai .ai-mini-starters button"));
    await waitText(b.driver, NOT_CONFIGURED);
    assert.ok(await isShown(b.driver, xText("Try again", { tag: "button" })));
  });

  it("a hirer is never asked to choose interests", async () => {
    await signIn(b.driver, "hirer");
    await go(b.driver, "/dashboard");
    await waitWorkspace(b.driver);
    await sleep(500);
    assert.equal(await exists(b.driver, gate), false);
  });

  it("an administrator is never asked either", async () => {
    await signIn(b.driver, "admin");
    await go(b.driver, "/dashboard");
    await waitWorkspace(b.driver);
    await sleep(500);
    assert.equal(await exists(b.driver, gate), false);
  });
});

describe("Learner · AI assistant", () => {
  const b = useBrowser();
  const box = By.css("textarea[aria-label='Message the AI assistant']");
  /** The chat is remembered in the browser, so every test starts from a clean slate. */
  async function freshChat(who = "learner") {
    await signIn(b.driver, who);
    await go(b.driver, "/ai");
    await b.driver.executeScript("localStorage.clear()");
    await b.driver.navigate().refresh();
    await visible(b.driver, box);
  }

  it("the page offers six starting points", async () => {
    await freshChat();
    await waitText(b.driver, "How can I help you learn today?");
    assert.equal(await count(b.driver, By.css(".ai-suggestions button")), 6);
  });

  it("the send button needs a question", async () => {
    await freshChat();
    const send = By.css("button[aria-label='Send message']");
    assert.equal(await (await find(b.driver, send)).isEnabled(), false);
    await type(b.driver, box, "What is recursion?");
    assert.equal(await (await find(b.driver, send)).isEnabled(), true);
  });

  it("a question shows in the chat and, without a configured key, the assistant says so", async () => {
    await freshChat();
    await type(b.driver, box, "What is recursion?");
    await click(b.driver, By.css("button[aria-label='Send message']"));
    await waitText(b.driver, "What is recursion?");
    await waitText(b.driver, NOT_CONFIGURED);
    assert.equal(await exists(b.driver, By.css(".ai-welcome")), false, "the starter cards give way to the chat");
  });

  it("Enter sends the question and the box is emptied", async () => {
    await freshChat();
    await type(b.driver, box, "Explain loops", { enter: true });
    await waitText(b.driver, "Explain loops");
    assert.equal(await (await find(b.driver, box)).getAttribute("value"), "");
  });

  it("a starting card sends its prompt", async () => {
    await freshChat();
    await click(b.driver, By.xpath("//div[contains(@class,'ai-suggestions')]//button[contains(normalize-space(.),'Plan my learning')]"));
    await waitText(b.driver, "Make me a 4-week study plan to learn web development from scratch");
    await waitText(b.driver, NOT_CONFIGURED);
  });

  it("'Try again' sends the question again", async () => {
    await freshChat();
    await type(b.driver, box, "Hello assistant", { enter: true });
    await waitText(b.driver, NOT_CONFIGURED);
    await click(b.driver, xText("Try again", { tag: "button" }));
    await waitText(b.driver, NOT_CONFIGURED);
    assert.equal((await texts(b.driver, By.css(".ai-message.user"))).filter((t) => t.includes("Hello assistant")).length, 1, "the question is not duplicated");
  });

  it("'New chat' clears the conversation", async () => {
    await freshChat();
    await type(b.driver, box, "Something to forget", { enter: true });
    await waitText(b.driver, NOT_CONFIGURED);
    await click(b.driver, xText("New chat", { tag: "button" }));
    await waitText(b.driver, "How can I help you learn today?");
    assert.equal(await hasText(b.driver, "Something to forget"), false);
  });

  it("the conversation is remembered after a reload", async () => {
    await freshChat();
    await type(b.driver, box, "Remember this question", { enter: true });
    await waitText(b.driver, NOT_CONFIGURED);
    await b.driver.navigate().refresh();
    await waitText(b.driver, "Remember this question");
    assert.equal(await exists(b.driver, By.css(".ai-welcome")), false);
  });

  it("the assistant is only for learners", async () => {
    await signIn(b.driver, "hirer");
    await go(b.driver, "/ai");
    await waitText(b.driver, "Access restricted");
    const refused = await api("hirer", "frontend/ai/chat", { method: "POST", body: { messages: [{ role: "user", content: "hi" }] } });
    assert.equal(refused.status, 403);
  });

  it("an answer-less chat asks for a real question (history must start with the learner)", async () => {
    const bad = await api("learner", "frontend/ai/chat", { method: "POST", body: { messages: [] } });
    assert.equal(bad.status, 422);
  });

  it("a lesson page has an assistant that answers about that lesson", async () => {
    const course = await makeCourse({ title: unique("AI lesson") });
    await signIn(b.driver, "learner");
    await go(b.driver, `/courses/${course.id}/materials/${course.materials[0].id}`);
    await waitText(b.driver, "Ask anything about this lesson");
    await click(b.driver, xText("Ask anything about this lesson", { tag: "button" }));
    const input = By.css("textarea[aria-label^='Ask']");
    await visible(b.driver, input);
    await type(b.driver, input, "Summarise this lesson", { enter: true });
    await waitText(b.driver, "Summarise this lesson");
    await waitText(b.driver, NOT_CONFIGURED);
  });
});
