import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { By, Key, acceptConfirm, api, apiOk, click, clickButton, count, dismissConfirm, exists, find, go, hasText, hover, isShown, q, setValue, signIn, sleep, texts, type, unique, useBrowser, visible, waitGone, waitNoText, waitText, waitUrl, xText } from "../lib/browser.mjs";
import { makeCommunity, makeLearner, notificationsOf, slugOf } from "../lib/factory.mjs";
import { connectAs } from "../lib/live.mjs";

const tile = (name) => `//a[contains(@class,'community-tile')][.//h3[normalize-space(.)=${q(name)}]]`;
const composer = By.css("textarea[aria-label^='Message #']");
const messages = (driver) => texts(driver, By.css(".room-message .preserve"));
const message = (text) => `//article[contains(@class,'room-message')][.//p[normalize-space(.)=${q(text)}]]`;

async function listFind(driver, who, name, explore = true) {
  await signIn(driver, who);
  await go(driver, "/communities");
  await waitText(driver, "Create community");
  if (explore) await click(driver, xText("Explore communities", { tag: "button" }));
  await type(driver, By.css(explore ? "input[aria-label='Find a community…']" : "input[aria-label='Search your communities…']"), name);
  await waitText(driver, name);
}
async function openRoom(driver, who, community, channel = "general") {
  await signIn(driver, who);
  await go(driver, `/communities/${community.id}`);
  await click(driver, By.xpath(`//nav[@aria-label='Channels']//button[contains(normalize-space(.),'${channel}')]`));
  await visible(driver, composer);
}
/** Message actions (react, delete) only appear while the pointer is over the message. */
const hoverMessage = (driver, text) => hover(driver, By.xpath(message(text)));
const channelsNav = By.css("nav[aria-label='Channels']");
const requestsHeading = By.xpath("//aside//h2[normalize-space(.)='Requests']");
const send = async (driver, text) => {
  await type(driver, composer, text);
  await click(driver, By.css("button[aria-label='Send message']"));
  await waitText(driver, text);
};

describe("Learner · Finding communities", () => {
  const b = useBrowser();

  it("a learner with no communities sees an invitation to explore", async () => {
    const fresh = await makeLearner("lonely");
    await signIn(b.driver, fresh);
    await go(b.driver, "/communities");
    await waitText(b.driver, "My Communities");
    await waitText(b.driver, "You haven’t joined any community yet");
    await click(b.driver, By.xpath("//div[contains(@class,'courses-page')]//button[contains(normalize-space(.),'Explore communities') and contains(@class,'button')]"));
    await visible(b.driver, By.css("input[aria-label='Find a community…']"));
  });

  it("Explore lists communities the learner has not joined, with interests and member counts", async () => {
    const community = await makeCommunity({ name: unique("Explore me") });
    const fresh = await makeLearner("explorer2");
    await listFind(b.driver, fresh, community.name);
    const text = await (await find(b.driver, By.xpath(tile(community.name)))).getText();
    assert.match(text, /Web Development/);
    assert.match(text, /1 member/);
  });

  it("My communities lists the communities the learner belongs to, with their role", async () => {
    const community = await makeCommunity({ name: unique("Mine"), owner: "learner2" });
    await signIn(b.driver, "learner2");
    await go(b.driver, "/communities");
    await type(b.driver, By.css("input[aria-label='Search your communities…']"), community.name);
    await waitText(b.driver, community.name);
    const text = await (await find(b.driver, By.xpath(tile(community.name)))).getText();
    assert.match(text, /Owner/);
    assert.match(text, /1 channel/);
  });

  it("a community card opens its page", async () => {
    const community = await makeCommunity({ name: unique("Open card") });
    await listFind(b.driver, await makeLearner("opener"), community.name);
    await click(b.driver, By.xpath(tile(community.name)));
    await waitUrl(b.driver, `/communities/${community.id}`);
    await waitText(b.driver, community.name);
  });

  it("searching in Explore narrows the list", async () => {
    const hit = await makeCommunity({ name: unique("Searchable") });
    await makeCommunity({ name: unique("Different") });
    await listFind(b.driver, await makeLearner("searcher"), hit.name);
    assert.equal(await count(b.driver, By.css("a.community-tile")), 1);
  });
});

describe("Learner · Starting a community", () => {
  const b = useBrowser();
  const openForm = async (who) => {
    await signIn(b.driver, who);
    await go(b.driver, "/communities");
    await click(b.driver, xText("Create community", { tag: "button" }));
    await waitText(b.driver, "Start a community");
  };
  const submit = () => click(b.driver, By.xpath("//form//button[contains(@class,'button')][contains(normalize-space(.),'Create community')]"));

  it("the slug is suggested from the name", async () => {
    await openForm(await makeLearner("namer"));
    await type(b.driver, By.css("input[name=name]"), "Creative Coders Club");
    assert.equal(await (await find(b.driver, By.css("input[name=slug]"))).getAttribute("value"), "creative-coders-club");
  });

  it("the slug only accepts lowercase words joined by hyphens", async () => {
    await openForm(await makeLearner("slugger"));
    await type(b.driver, By.css("input[name=name]"), "Anything");
    await type(b.driver, By.css("input[name=slug]"), "Not Valid!");
    assert.equal(await b.driver.executeScript("return document.querySelector('input[name=slug]').validity.patternMismatch"), true);
  });

  it("a community needs at least one interest", async () => {
    await openForm(await makeLearner("picky"));
    await type(b.driver, By.css("input[name=name]"), unique("No interest"));
    await type(b.driver, By.css("textarea[name=description]"), "Missing an interest");
    await submit();
    await sleep(1000);
    assert.match(await b.driver.getCurrentUrl(), /\/communities$/, "stays on the list");
    assert.ok(await isShown(b.driver, By.css(".modal")));
  });

  it("interests are chosen as chips and can be removed again", async () => {
    await openForm(await makeLearner("chips"));
    await waitText(b.driver, "0 selected");
    await click(b.driver, By.xpath("//button[contains(@class,'interest-chip') and contains(@class,'available')][.//span[normalize-space(.)='Music']]"));
    await waitText(b.driver, "1 selected");
    await click(b.driver, By.css("button[aria-label='Remove Music']"));
    await waitText(b.driver, "0 selected");
  });

  it("creating a community opens it with a general channel and the learner as owner", async () => {
    const name = unique("Brand new");
    const owner = await makeLearner("founder");
    await openForm(owner);
    await type(b.driver, By.css("input[name=name]"), name);
    await type(b.driver, By.css("textarea[name=description]"), "A freshly created community");
    await click(b.driver, By.xpath("//button[contains(@class,'interest-chip') and contains(@class,'available')][.//span[normalize-space(.)='Web Development']]"));
    await submit();
    await waitUrl(b.driver, /^\/communities\/[0-9a-f-]{36}/);
    await waitText(b.driver, name);
    await waitText(b.driver, "Owner");
    await waitText(b.driver, "1 member");
    assert.ok(await isShown(b.driver, By.xpath("//nav[@aria-label='Channels']//button[contains(normalize-space(.),'general')]")));
  });

  it("a slug that is already taken is refused", async () => {
    const taken = await makeCommunity({ name: unique("Taken") });
    await openForm(await makeLearner("copycat"));
    await type(b.driver, By.css("input[name=name]"), "Another name");
    await type(b.driver, By.css("input[name=slug]"), slugOf(taken.name));
    await type(b.driver, By.css("textarea[name=description]"), "Same slug");
    await click(b.driver, By.xpath("//button[contains(@class,'interest-chip') and contains(@class,'available')][.//span[normalize-space(.)='Web Development']]"));
    await submit();
    await waitText(b.driver, "Already exists");
  });

  it("the form can be closed without creating anything", async () => {
    await openForm(await makeLearner("closer"));
    await click(b.driver, By.css("button[aria-label='Close dialog']"));
    await waitGone(b.driver, By.css(".modal"));
  });
});

describe("Learner · Joining a community", () => {
  const b = useBrowser();

  it("a community anyone can join lets the learner in straight away", async () => {
    const community = await makeCommunity({ name: unique("Open door") });
    const learner = await makeLearner("walkin");
    await signIn(b.driver, learner);
    await go(b.driver, `/communities/${community.id}`);
    await waitText(b.driver, community.name);
    await click(b.driver, xText("Join community", { tag: "button" }));
    await visible(b.driver, channelsNav);
    const mine = await apiOk(learner, "frontend/communities/mine");
    assert.ok(mine.some((item) => item.id === community.id));
  });

  it("the owner is told when someone joins", async () => {
    const community = await makeCommunity({ name: unique("Owner news") });
    const learner = await makeLearner("newcomer");
    await signIn(b.driver, learner);
    await go(b.driver, `/communities/${community.id}`);
    await click(b.driver, xText("Join community", { tag: "button" }));
    await visible(b.driver, channelsNav);
    const note = (await notificationsOf("learner2")).find((n) => n.type === "community_member_joined" && n.title.includes(community.name));
    assert.equal(note?.title, `${learner.name} joined ${community.name}`);
  });

  it("a community with approval shows 'Request to join' and then a waiting message", async () => {
    const community = await makeCommunity({ name: unique("By invitation"), approval: true });
    const learner = await makeLearner("applicant");
    await signIn(b.driver, learner);
    await go(b.driver, `/communities/${community.id}`);
    await waitText(b.driver, community.name);
    await click(b.driver, xText("Request to join", { tag: "button" }));
    await waitText(b.driver, "Your request is waiting for approval.");
    assert.equal(await exists(b.driver, By.css("nav[aria-label='Channels']")), false, "no access yet");
  });

  it("a moderator approves the request and the learner is let in and told", async () => {
    const community = await makeCommunity({ name: unique("Approve me"), approval: true });
    const learner = await makeLearner("hopeful");
    await apiOk(learner, `communities/${community.id}/join`, { method: "POST" });
    await signIn(b.driver, "learner2");
    await go(b.driver, `/communities/${community.id}`);
    await visible(b.driver, requestsHeading);
    await click(b.driver, By.css(`button[aria-label='Approve ${learner.name}']`));
    await waitGone(b.driver, requestsHeading);
    const note = (await notificationsOf(learner)).find((n) => n.type === "community_membership");
    assert.equal(note.title, `Your request to join ${community.name} was approved`);
    await signIn(b.driver, learner);
    await go(b.driver, `/communities/${community.id}`);
    await visible(b.driver, channelsNav);
  });

  it("the moderators hear about a join request", async () => {
    const community = await makeCommunity({ name: unique("Needs approval"), approval: true });
    const learner = await makeLearner("asker");
    await apiOk(learner, `communities/${community.id}/join`, { method: "POST" });
    const note = (await notificationsOf("learner2")).find((n) => n.type === "community_join_request" && n.title.includes(community.name));
    assert.equal(note?.title, `${learner.name} asked to join ${community.name}`);
  });

  it("a declined request is explained to the learner", async () => {
    const community = await makeCommunity({ name: unique("Decline me"), approval: true });
    const learner = await makeLearner("declined");
    await apiOk(learner, `communities/${community.id}/join`, { method: "POST" });
    await signIn(b.driver, "learner2");
    await go(b.driver, `/communities/${community.id}`);
    await click(b.driver, By.css(`button[aria-label='Reject ${learner.name}']`));
    await waitGone(b.driver, requestsHeading);
    await signIn(b.driver, learner);
    await go(b.driver, `/communities/${community.id}`);
    await waitText(b.driver, "Your request to join was declined.");
    const note = (await notificationsOf(learner)).find((n) => n.type === "community_membership");
    assert.equal(note.title, `Your request to join ${community.name} was declined`);
  });

  it("someone who was blocked cannot join again", async () => {
    const community = await makeCommunity({ name: unique("Blocked") });
    const learner = await makeLearner("blocked");
    await apiOk(learner, `communities/${community.id}/join`, { method: "POST" });
    await apiOk("learner2", `frontend/communities/${community.id}/members/${learner.id}`, { method: "PATCH", body: { status: "blocked" } });
    await signIn(b.driver, learner);
    await go(b.driver, `/communities/${community.id}`);
    await waitText(b.driver, "You can’t join this community.");
  });
});

describe("Learner · Chatting in a community", () => {
  const b = useBrowser();

  async function memberOf(opts = {}) {
    const community = await makeCommunity({ name: unique("Chat room"), ...opts });
    const learner = await makeLearner("chatter");
    await apiOk(learner, `communities/${community.id}/join`, { method: "POST" });
    return { community, learner };
  }

  it("the room shows its channels, the members' messages and a message box", async () => {
    const { community, learner } = await memberOf();
    await apiOk("learner2", `frontend/communities/${community.id}/chats/${community.chat}`, { method: "POST", body: { content: "Hello from the owner" } });
    await openRoom(b.driver, learner, community);
    await waitText(b.driver, "Hello from the owner");
    assert.ok(await isShown(b.driver, By.css("button[aria-label='Send message']")));
    await waitText(b.driver, "Liam Learner");
  });

  it("a channel with no messages welcomes the first one", async () => {
    const { community, learner } = await memberOf();
    await openRoom(b.driver, learner, community);
    await waitText(b.driver, "Welcome to #general");
  });

  it("a sent message appears at once and is saved", async () => {
    const { community, learner } = await memberOf();
    const text = unique("My message");
    await openRoom(b.driver, learner, community);
    await send(b.driver, text);
    assert.ok((await messages(b.driver)).includes(text));
    const stored = await apiOk(learner, `frontend/communities/${community.id}/chats/${community.chat}`);
    assert.ok(stored.some((item) => item.content === text));
  });

  it("Enter sends the message and Shift+Enter starts a new line", async () => {
    const { community, learner } = await memberOf();
    const text = unique("Enter sends");
    await openRoom(b.driver, learner, community);
    await (await visible(b.driver, composer)).sendKeys("line one", Key.chord(Key.SHIFT, Key.ENTER), "line two");
    assert.match(await (await find(b.driver, composer)).getAttribute("value"), /line one\nline two/);
    await type(b.driver, composer, text);
    await (await find(b.driver, composer)).sendKeys(Key.ENTER);
    await waitText(b.driver, text);
    assert.equal(await (await find(b.driver, composer)).getAttribute("value"), "", "the box is emptied");
  });

  it("the send button needs some text", async () => {
    const { community, learner } = await memberOf();
    await openRoom(b.driver, learner, community);
    assert.equal(await (await find(b.driver, By.css("button[aria-label='Send message']"))).isEnabled(), false);
    await type(b.driver, composer, "   ");
    assert.equal(await (await find(b.driver, By.css("button[aria-label='Send message']"))).isEnabled(), false);
  });

  it("messages from other members arrive live without a reload", async () => {
    const { community, learner } = await memberOf();
    await openRoom(b.driver, learner, community);
    await waitText(b.driver, "Welcome to #general");
    const text = unique("Live arrival");
    await apiOk("learner2", `frontend/communities/${community.id}/chats/${community.chat}`, { method: "POST", body: { content: text } });
    await waitText(b.driver, text);
  });

  it("a member's own message can be deleted after confirming", async () => {
    const { community, learner } = await memberOf();
    const text = unique("Delete me");
    await openRoom(b.driver, learner, community);
    await send(b.driver, text);
    await hoverMessage(b.driver, text);
    const asked = await acceptConfirm(b.driver, () => click(b.driver, By.xpath(message(text) + "//button[@aria-label='Delete message']")));
    assert.equal(asked, "Delete this message?");
    await waitNoText(b.driver, text);
  });

  it("a member cannot delete someone else's message but a moderator can", async () => {
    const { community, learner } = await memberOf();
    const text = unique("Owner says");
    await apiOk("learner2", `frontend/communities/${community.id}/chats/${community.chat}`, { method: "POST", body: { content: text } });
    await openRoom(b.driver, learner, community);
    await waitText(b.driver, text);
    assert.equal(await exists(b.driver, By.xpath(message(text) + "//button[@aria-label='Delete message']")), false);
    await openRoom(b.driver, "learner2", community);
    await waitText(b.driver, text);
    assert.ok(await exists(b.driver, By.xpath(message(text) + "//button[@aria-label='Delete message']")));
  });

  it("a reaction is added from the picker, counted, and taken back with a click", async () => {
    const { community, learner } = await memberOf();
    const text = unique("React to me");
    await apiOk("learner2", `frontend/communities/${community.id}/chats/${community.chat}`, { method: "POST", body: { content: text } });
    await openRoom(b.driver, learner, community);
    await waitText(b.driver, text);
    await hoverMessage(b.driver, text);
    await click(b.driver, By.xpath(message(text) + "//button[@aria-label='Add reaction']"));
    await click(b.driver, By.css(".reaction-picker button[aria-label='Celebrate']"));
    const chip = By.xpath(message(text) + "//button[contains(@class,'reaction-chip')]");
    await b.driver.wait(async () => (await (await find(b.driver, chip)).getText()).includes("1"), 6000);
    assert.equal(await (await find(b.driver, chip)).getAttribute("aria-pressed"), "true");
    await click(b.driver, chip);
    await b.driver.wait(async () => !(await exists(b.driver, chip)), 6000);
  });

  it("reactions from other people show up live", async () => {
    const { community, learner } = await memberOf();
    const text = unique("Others react");
    const posted = await apiOk(learner, `frontend/communities/${community.id}/chats/${community.chat}`, { method: "POST", body: { content: text } });
    await openRoom(b.driver, learner, community);
    await waitText(b.driver, text);
    await apiOk("learner2", `frontend/communities/${community.id}/chats/${community.chat}/messages/${posted.id}/reaction`, { method: "PUT", body: { reaction: "love" } });
    await visible(b.driver, By.xpath(message(text) + "//button[contains(@class,'reaction-chip')]"));
  });

  it("a moderator can add a channel and members then see it", async () => {
    const { community, learner } = await memberOf();
    const name = unique("topic").replace(/ /g, "-").toLowerCase();
    await signIn(b.driver, "learner2");
    await go(b.driver, `/communities/${community.id}`);
    await click(b.driver, By.css("button[aria-label='Create channel']"));
    await type(b.driver, By.css(".room-add-channel input[placeholder='Channel name']"), name);
    await click(b.driver, xText("Create channel", { tag: "button" }));
    await waitText(b.driver, name);
    await signIn(b.driver, learner);
    await go(b.driver, `/communities/${community.id}`);
    await waitText(b.driver, name);
  });

  it("an ordinary member has no 'Create channel' button", async () => {
    const { community, learner } = await memberOf();
    await signIn(b.driver, learner);
    await go(b.driver, `/communities/${community.id}`);
    await visible(b.driver, channelsNav);
    assert.equal(await exists(b.driver, By.css("button[aria-label='Create channel']")), false);
  });

  it("switching channels shows each channel's own conversation", async () => {
    const { community, learner } = await memberOf();
    const second = await apiOk("learner2", `frontend/communities/${community.id}/chats`, { method: "POST", body: { name: "random" } });
    await apiOk("learner2", `frontend/communities/${community.id}/chats/${second.id}`, { method: "POST", body: { content: "only in random" } });
    await openRoom(b.driver, learner, community, "general");
    await waitText(b.driver, "Welcome to #general");
    await click(b.driver, By.xpath("//nav[@aria-label='Channels']//button[contains(normalize-space(.),'random')]"));
    await waitText(b.driver, "only in random");
  });

  it("the member list can be shown and marks the owner", async () => {
    const { community, learner } = await memberOf();
    await signIn(b.driver, learner);
    await go(b.driver, `/communities/${community.id}`);
    await click(b.driver, By.xpath("//button[contains(@class,'room-collapse')]"));
    await waitText(b.driver, "Liam Learner");
    await waitText(b.driver, learner.name);
    assert.ok(await isShown(b.driver, By.css("[aria-label='Owner']")));
  });

  it("other members see 'is typing…' while someone types", async () => {
    const { community, learner } = await memberOf();
    await openRoom(b.driver, learner, community);
    await waitText(b.driver, "Welcome to #general");
    const owner = await connectAs("learner2");
    try {
      await owner.joinCommunity(community.id);
      owner.typing({ scope: "community", community_id: community.id, chat_id: community.chat });
      await waitText(b.driver, "Liam Learner is typing…");
    } finally {
      owner.close();
    }
  });

  it("a member can leave after confirming and the community moves out of 'My communities'", async () => {
    const { community, learner } = await memberOf();
    await signIn(b.driver, learner);
    await go(b.driver, `/communities/${community.id}`);
    await waitText(b.driver, "Leave community");
    const asked = await acceptConfirm(b.driver, () => click(b.driver, xText("Leave community", { tag: "button" })));
    assert.equal(asked, `Leave ${community.name}?`);
    await waitUrl(b.driver, /^\/communities($|\?)/);
    const mine = await apiOk(learner, "frontend/communities/mine");
    assert.ok(!mine.some((item) => item.id === community.id));
  });

  it("cancelling the leave confirmation keeps the membership", async () => {
    const { community, learner } = await memberOf();
    await signIn(b.driver, learner);
    await go(b.driver, `/communities/${community.id}`);
    await dismissConfirm(b.driver, () => click(b.driver, xText("Leave community", { tag: "button" })));
    await sleep(600);
    assert.ok(await isShown(b.driver, By.css("nav[aria-label='Channels']")));
  });
});
