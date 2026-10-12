import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { By, Key, apiOk, click, count, exists, find, go, hasText, isShown, q, signIn, sleep, texts, type, unique, useBrowser, visible, waitGone, waitText, waitUrl, xText } from "../lib/browser.mjs";
import { makeLearner } from "../lib/factory.mjs";
import { connectAs } from "../lib/live.mjs";

const compose = By.css("textarea[aria-label='Message']");
const sendButton = By.xpath("//div[contains(@class,'message-compose')]//button");
const bubbles = (driver) => texts(driver, By.css(".message-stream article.bubble p"));
const conversation = (name) => By.xpath(`//aside//button[contains(@class,'conversation')][.//strong[normalize-space(.)=${q(name)}]]`);
const startWith = async (from, to) => (await apiOk(from, "frontend/messages", { method: "POST", body: { user_id: to.id } })).id;
const say = (from, id, content) => apiOk(from, `frontend/messages/${id}`, { method: "POST", body: { content } });
async function openChat(driver, who, other) {
  await signIn(driver, who);
  await go(driver, "/messages");
  await click(driver, conversation(other.name));
  await visible(driver, compose);
}

describe("Learner · Messages", () => {
  const b = useBrowser();

  it("a learner with no conversations sees an invitation", async () => {
    const lonely = await makeLearner("quiet");
    await signIn(b.driver, lonely);
    await go(b.driver, "/messages");
    await waitText(b.driver, "No conversations yet");
    await waitText(b.driver, "Your conversations live here");
  });

  it("the 'New message' button finds a person by name and opens a conversation", async () => {
    const me = await makeLearner("starter");
    const friend = await makeLearner("friend");
    await signIn(b.driver, me);
    await go(b.driver, "/messages");
    await click(b.driver, By.css("button.fab"));
    await waitText(b.driver, "Start a conversation");
    await type(b.driver, By.css(".modal input"), friend.name);
    await click(b.driver, By.xpath(`//div[contains(@class,'list-row')][.//strong[normalize-space(.)=${q(friend.name)}]]//button[contains(normalize-space(.),'Select')]`));
    await waitGone(b.driver, By.css(".modal"));
    await visible(b.driver, compose);
    assert.equal(await (await find(b.driver, By.css(".messenger section header h3"))).getText(), friend.name);
  });

  it("people are only searched once two letters are typed", async () => {
    const me = await makeLearner("searcher2");
    await signIn(b.driver, me);
    await go(b.driver, "/messages");
    await click(b.driver, By.css("button.fab"));
    await type(b.driver, By.css(".modal input"), "L");
    await sleep(600);
    assert.equal(await exists(b.driver, By.css(".modal .list-row")), false);
    await type(b.driver, By.css(".modal input"), "Liam");
    await visible(b.driver, By.css(".modal .list-row"));
  });

  it("the conversation list shows each person with their last message", async () => {
    const me = await makeLearner("lister");
    const friend = await makeLearner("buddy");
    const id = await startWith(me, friend);
    await say(friend, id, "See you tomorrow!");
    await signIn(b.driver, me);
    await go(b.driver, "/messages");
    await waitText(b.driver, friend.name);
    await waitText(b.driver, "See you tomorrow!");
  });

  it("a conversation opens with its earlier messages, mine on one side", async () => {
    const me = await makeLearner("history");
    const friend = await makeLearner("pal");
    const id = await startWith(me, friend);
    await say(me, id, "Hello pal");
    await say(friend, id, "Hello me");
    await openChat(b.driver, me, friend);
    await b.driver.wait(async () => (await bubbles(b.driver)).length === 2, 8000);
    assert.deepEqual(await bubbles(b.driver), ["Hello pal", "Hello me"]);
    assert.equal(await count(b.driver, By.css("article.bubble.mine")), 1);
  });

  it("a message is sent with the button, shown as mine and saved", async () => {
    const me = await makeLearner("sender");
    const friend = await makeLearner("receiver");
    await startWith(me, friend);
    const text = unique("Hi there");
    await openChat(b.driver, me, friend);
    await type(b.driver, compose, text);
    await click(b.driver, sendButton);
    await b.driver.wait(async () => (await bubbles(b.driver)).includes(text), 8000);
    assert.equal(await (await find(b.driver, compose)).getAttribute("value"), "");
    await b.driver.navigate().refresh();
    await click(b.driver, conversation(friend.name));
    await b.driver.wait(async () => (await bubbles(b.driver)).includes(text), 8000);
  });

  it("the Send button needs some text", async () => {
    const me = await makeLearner("blank");
    const friend = await makeLearner("blankpal");
    await startWith(me, friend);
    await openChat(b.driver, me, friend);
    assert.equal(await (await find(b.driver, sendButton)).isEnabled(), false);
    await type(b.driver, compose, "x");
    assert.equal(await (await find(b.driver, sendButton)).isEnabled(), true);
  });

  it("sending updates the conversation preview", async () => {
    const me = await makeLearner("previewer");
    const friend = await makeLearner("previewed");
    await startWith(me, friend);
    const text = unique("Preview line");
    await openChat(b.driver, me, friend);
    await type(b.driver, compose, text);
    await click(b.driver, sendButton);
    await b.driver.wait(async () => (await (await find(b.driver, conversation(friend.name))).getText()).includes(text), 8000);
  });

  it("a reply from the other person arrives live", async () => {
    const me = await makeLearner("waiter");
    const friend = await makeLearner("replier");
    const id = await startWith(me, friend);
    await openChat(b.driver, me, friend);
    const text = unique("Live reply");
    await say(friend, id, text);
    await b.driver.wait(async () => (await bubbles(b.driver)).includes(text), 10000, "the reply never appeared");
  });

  it("a brand new conversation started by someone else appears in the list live", async () => {
    const me = await makeLearner("contacted");
    const stranger = await makeLearner("reachingout");
    await signIn(b.driver, me);
    await go(b.driver, "/messages");
    await waitText(b.driver, "No conversations yet");
    const id = await startWith(stranger, me);
    await say(stranger, id, "Hello, new friend!");
    await visible(b.driver, conversation(stranger.name));
    await waitText(b.driver, "Hello, new friend!");
  });

  it("the other person sees 'is typing…' while a message is being written", async () => {
    const me = await makeLearner("typist");
    const friend = await makeLearner("watching");
    await startWith(me, friend);
    await openChat(b.driver, me, friend);
    const other = await connectAs(friend);
    try {
      await (await find(b.driver, compose)).sendKeys("writing something");
      const signal = await other.next("typing");
      assert.equal(signal.name, me.name);
    } finally {
      other.close();
    }
  });

  it("'is typing…' shows when the other person types", async () => {
    const me = await makeLearner("viewer2");
    const friend = await makeLearner("typing2");
    const id = await startWith(me, friend);
    await openChat(b.driver, me, friend);
    const other = await connectAs(friend);
    try {
      other.typing({ scope: "dm", conversation_id: id });
      await waitText(b.driver, `${friend.name} is typing…`);
    } finally {
      other.close();
    }
  });

  it("choosing another conversation switches the thread", async () => {
    const me = await makeLearner("switcher");
    const one = await makeLearner("onefriend");
    const two = await makeLearner("twofriend");
    const first = await startWith(me, one);
    const second = await startWith(me, two);
    await say(one, first, "message from one");
    await say(two, second, "message from two");
    await openChat(b.driver, me, one);
    await b.driver.wait(async () => (await bubbles(b.driver)).includes("message from one"), 8000);
    await click(b.driver, conversation(two.name));
    await b.driver.wait(async () => (await bubbles(b.driver)).includes("message from two"), 8000);
    assert.ok(!(await bubbles(b.driver)).includes("message from one"));
  });

  it("the 'Send message' button on someone's profile opens a conversation with them", async () => {
    const me = await makeLearner("visitor");
    const person = await makeLearner("profileowner");
    await signIn(b.driver, me);
    await go(b.driver, `/profile/${person.id}`);
    await waitText(b.driver, person.name);
    await click(b.driver, xText("Send message", { tag: "a" }));
    await waitUrl(b.driver, /^\/messages/);
    await visible(b.driver, compose);
    assert.equal(await (await find(b.driver, By.css(".messenger section header h3"))).getText(), person.name);
  });

  it("your own profile has no 'Send message' button", async () => {
    await signIn(b.driver, "learner");
    await go(b.driver, "/profile");
    await waitText(b.driver, "Lena Learner");
    assert.equal(await exists(b.driver, xText("Send message", { tag: "a" })), false);
  });

  it("the Messages menu item has no unread badge but Notifications can have one", async () => {
    const me = await makeLearner("badges");
    await signIn(b.driver, me);
    await go(b.driver, "/messages");
    await waitText(b.driver, "Messages");
    const badges = await texts(b.driver, By.css(".sidebar nav a .nav-badge"));
    assert.deepEqual(badges, ["1"], "only the welcome notification is unread");
  });
});
