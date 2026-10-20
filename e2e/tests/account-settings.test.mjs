// The account Settings page (profile menu): change the password and delete the account, for every role.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { By, api, apiOk, click, exists, find, go, hasText, signIn, sleep, texts, type, unique, useBrowser, visible, waitGone, waitText, waitUrl, xText } from "../lib/browser.mjs";
import { makeAdmin, makeHirer, makeJob, makeLearner, makePost } from "../lib/factory.mjs";
import { PASSWORD, urls } from "../lib/config.mjs";
import { openProfileMenu, waitWorkspace } from "../lib/flows.mjs";

const NEW_PASSWORD = "Brand-new-Pass-77";
const login = (identifier, password) =>
  fetch(`${urls.api}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ identifier, password }) });
const field = (name) => By.css(`input[name=${name}]`);
const submitPassword = By.xpath("//section[@aria-labelledby='acct-password']//button[normalize-space(.)='Change password' or contains(normalize-space(.),'Changing')]");
async function fillPasswords(b, current, next, again = next) {
  await type(b.driver, field("current_password"), current);
  await type(b.driver, field("new_password"), next);
  await type(b.driver, field("confirm_password"), again);
}

describe("Settings · Reaching the page", () => {
  const b = useBrowser();

  for (const [who, label] of [["learner", "Settings"], ["hirer", "Settings"], ["admin", "Account settings"]])
    it(`the profile menu of a ${who} has "${label}", which opens the page`, async () => {
      await signIn(b.driver, who);
      await go(b.driver, "/dashboard");
      await waitWorkspace(b.driver);
      await openProfileMenu(b.driver);
      await click(b.driver, By.xpath(`//div[contains(@class,'floating-menu')]//a[normalize-space(.)='${label}']`));
      await waitUrl(b.driver, /^\/account/);
      await waitText(b.driver, "Change password");
      await waitText(b.driver, "Delete account");
    });

  it("the menu keeps Profile and Sign out", async () => {
    await signIn(b.driver, "learner");
    await go(b.driver, "/dashboard");
    await openProfileMenu(b.driver);
    assert.deepEqual((await texts(b.driver, By.css(".floating-menu .item"))).map((t) => t.trim()), ["Profile", "Settings", "Sign out"]);
  });

  it("the page says who is signed in", async () => {
    await signIn(b.driver, "learner");
    await go(b.driver, "/account");
    await waitText(b.driver, "Signed in as Lena Learner");
  });

  it("the top bar has a back button, the page title and no heading in the page itself", async () => {
    await signIn(b.driver, "learner");
    await go(b.driver, "/account");
    await visible(b.driver, By.css(".post-detail-topbar a[aria-label='Back to profile']"));
    assert.equal(await (await find(b.driver, By.css(".post-detail-topbar-title strong"))).getText(), "Settings");
    assert.equal(await exists(b.driver, By.css(".acct .eyebrow, .acct > header, .acct h1")), false);
    await click(b.driver, By.css(".post-detail-topbar a[aria-label='Back to profile']"));
    await waitUrl(b.driver, /^\/profile/);
  });

  it("the cards use the full width of the page", async () => {
    await signIn(b.driver, "learner");
    await go(b.driver, "/account");
    await visible(b.driver, By.css(".acct-card"));
    const [card, container] = await b.driver.executeScript("return [document.querySelector('.acct-card').getBoundingClientRect().width, document.querySelector('.content-container').getBoundingClientRect().width]");
    assert.ok(card > container * 0.85, `the card is ${card}px in a ${container}px page`);
  });

  it("signed-out visitors are sent to the sign-in page", async () => {
    await b.driver.manage().deleteAllCookies();
    await go(b.driver, "/account");
    await waitUrl(b.driver, /^\/login/);
  });

  it("Settings is not a sidebar item", async () => {
    await signIn(b.driver, "learner");
    await go(b.driver, "/dashboard");
    await visible(b.driver, By.css(".sidebar nav a"));
    assert.equal(await exists(b.driver, By.xpath("//aside//nav//a[normalize-space(.)='Settings']")), false);
  });
});

describe("Settings · Change password", () => {
  const b = useBrowser();
  const open = async (who) => {
    await signIn(b.driver, who);
    await go(b.driver, "/account");
    await visible(b.driver, field("current_password"));
  };

  it("the button waits for a complete, matching form", async () => {
    await open(await makeLearner("pwform"));
    const button = By.xpath("//section[@aria-labelledby='acct-password']//button[contains(@class,'button')]");
    assert.equal(await (await find(b.driver, button)).isEnabled(), false);
    await fillPasswords(b, PASSWORD, "short");
    assert.equal(await (await find(b.driver, button)).isEnabled(), false, "under 8 characters");
    await fillPasswords(b, PASSWORD, NEW_PASSWORD, "something-else-1");
    await waitText(b.driver, "The two passwords do not match.");
    assert.equal(await (await find(b.driver, button)).isEnabled(), false);
    await type(b.driver, field("confirm_password"), NEW_PASSWORD);
    assert.equal(await (await find(b.driver, button)).isEnabled(), true);
  });

  it("a wrong current password is refused and the person stays signed in", async () => {
    const me = await makeLearner("pwwrong");
    await open(me);
    await fillPasswords(b, "not-my-password", NEW_PASSWORD);
    await click(b.driver, submitPassword);
    await waitText(b.driver, "Your current password is not correct");
    assert.equal((await login(me.username, PASSWORD)).status, 200, "the old password still works");
    await go(b.driver, "/dashboard");
    await waitWorkspace(b.driver);
  });

  it("the new password cannot be the same as the current one", async () => {
    await open(await makeLearner("pwsame"));
    await fillPasswords(b, PASSWORD, PASSWORD);
    await click(b.driver, submitPassword);
    await waitText(b.driver, "different from the current one");
  });

  it("a learner can change the password: the old one stops working, the new one works", async () => {
    const me = await makeLearner("pwlearner");
    await open(me);
    await fillPasswords(b, PASSWORD, NEW_PASSWORD);
    await click(b.driver, submitPassword);
    await waitText(b.driver, "Password changed.");
    await waitUrl(b.driver, /^\/login/);
    assert.equal((await login(me.username, PASSWORD)).status, 401);
    assert.equal((await login(me.username, NEW_PASSWORD)).status, 200);
  });

  it("a hirer can change the password", async () => {
    const me = await makeHirer("pwhirer");
    await open(me);
    await fillPasswords(b, PASSWORD, NEW_PASSWORD);
    await click(b.driver, submitPassword);
    await waitUrl(b.driver, /^\/login/);
    assert.equal((await login(me.username, NEW_PASSWORD)).status, 200);
  });

  it("an admin can change the password", async () => {
    const me = await makeAdmin("pwadmin");
    await open(me);
    await fillPasswords(b, PASSWORD, NEW_PASSWORD);
    await click(b.driver, submitPassword);
    await waitUrl(b.driver, /^\/login/);
    assert.equal((await login(me.username, NEW_PASSWORD)).status, 200);
  });

  it("after the change the person can sign in again through the form", async () => {
    const me = await makeLearner("pwagain");
    await open(me);
    await fillPasswords(b, PASSWORD, NEW_PASSWORD);
    await click(b.driver, submitPassword);
    await waitUrl(b.driver, /^\/login/);
    await type(b.driver, By.css("input[name=identifier]"), me.username);
    await type(b.driver, By.css("input[name=password]"), NEW_PASSWORD);
    await click(b.driver, xText("Sign in", { tag: "button" }));
    await waitUrl(b.driver, /^\/dashboard/);
  });

  it("every other session is ended: an old refresh token no longer works", async () => {
    const me = await makeLearner("pwsessions");
    const first = await (await login(me.username, PASSWORD)).json();
    await open(me);
    await fillPasswords(b, PASSWORD, NEW_PASSWORD);
    await click(b.driver, submitPassword);
    await waitUrl(b.driver, /^\/login/);
    const refreshed = await fetch(`${urls.api}/auth/refresh`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ refreshToken: first.refreshToken }) });
    assert.equal(refreshed.status, 401);
  });

  it("the server insists on 8 characters and the current password", async () => {
    const me = await makeLearner("pwserver");
    assert.equal((await api(me, "frontend/account/password", { method: "POST", body: { currentPassword: PASSWORD, newPassword: "short" } })).status, 422);
    assert.equal((await api(me, "frontend/account/password", { method: "POST", body: { currentPassword: "wrong-wrong", newPassword: NEW_PASSWORD } })).status, 403);
    assert.equal((await api(me, "frontend/account/password", { method: "POST", body: { newPassword: NEW_PASSWORD } })).status, 422);
  });
});

describe("Settings · Delete account", () => {
  const b = useBrowser();
  const open = async (who) => {
    await signIn(b.driver, who);
    await go(b.driver, "/account");
    await visible(b.driver, xText("Delete my account", { tag: "button" }));
  };
  const openModal = async () => {
    await click(b.driver, xText("Delete my account", { tag: "button" }));
    await visible(b.driver, By.css(".modal input[name=delete_password]"));
  };
  const confirmButton = By.xpath("//*[contains(@class,'modal')]//button[contains(normalize-space(.),'Delete my account forever') or contains(normalize-space(.),'Deleting')]");
  const answer = async (password, word = "DELETE") => {
    await type(b.driver, By.css(".modal input[name=delete_password]"), password);
    await type(b.driver, By.css(".modal input[name=delete_confirm]"), word);
  };

  it("explains what happens before asking for anything", async () => {
    await open(await makeLearner("delinfo"));
    await waitText(b.driver, "Permanently remove your account. This cannot be undone.");
    await waitText(b.driver, "shows “Deleted user” instead of your name");
  });

  it("a hirer is also told that open jobs are closed", async () => {
    await open(await makeHirer("delhirerinfo"));
    await waitText(b.driver, "Your open job posts are closed.");
  });

  it("the confirmation needs the password and the word DELETE", async () => {
    await open(await makeLearner("delguard"));
    await openModal();
    assert.equal(await (await find(b.driver, confirmButton)).isEnabled(), false);
    await answer(PASSWORD, "delete");
    assert.equal(await (await find(b.driver, confirmButton)).isEnabled(), false, "the word must be DELETE exactly");
    await type(b.driver, By.css(".modal input[name=delete_confirm]"), "DELETE");
    assert.equal(await (await find(b.driver, confirmButton)).isEnabled(), true);
  });

  it("the dialog can be closed without deleting anything", async () => {
    const me = await makeLearner("delcancel");
    await open(me);
    await openModal();
    await b.driver.actions().sendKeys("").perform();
    await waitGone(b.driver, By.css(".modal[open]"));
    assert.equal((await login(me.username, PASSWORD)).status, 200);
  });

  it("a wrong password does not delete the account", async () => {
    const me = await makeLearner("delwrong");
    await open(me);
    await openModal();
    await answer("not-my-password");
    await click(b.driver, confirmButton);
    await waitText(b.driver, "Your password is not correct");
    assert.equal((await login(me.username, PASSWORD)).status, 200);
  });

  it("an account with no history is removed completely", async () => {
    const me = await makeLearner("delclean");
    await open(me);
    await openModal();
    await answer(PASSWORD);
    await click(b.driver, confirmButton);
    await waitUrl(b.driver, /^\/login/);
    assert.equal((await login(me.username, PASSWORD)).status, 401);
    const found = await apiOk("admin", `frontend/admin/users?q=${encodeURIComponent(me.username)}`);
    assert.equal(found.length, 0);
  });

  it("an account with history is emptied: it can never sign in and shows as Deleted user", async () => {
    const me = await makeLearner("delhistory");
    await apiOk(me, "frontend/profile/experience", { method: "POST", body: { title: "Secret job", workplace: "Hidden Ltd", category_id: null, start_date: "2020-01", end_date: "2021-01" } });
    const post = await makePost({ author: me, content: unique("Words that will go") });
    await open(me);
    await openModal();
    await answer(PASSWORD);
    await click(b.driver, confirmButton);
    await waitUrl(b.driver, /^\/login/);
    assert.equal((await login(me.username, PASSWORD)).status, 401);
    assert.equal((await login(`deleted-${me.id.replace(/-/g, "").slice(0, 12)}`, PASSWORD)).status, 401);
    const found = await apiOk("admin", `frontend/admin/users?q=${encodeURIComponent(me.id.replace(/-/g, "").slice(0, 12))}`);
    assert.equal(found.length, 1);
    assert.equal(found[0].name, "Deleted user");
    assert.equal(found[0].account_status, "deactivated");
    assert.doesNotMatch(found[0].email, /e2e\.test/);
    const profile = await api("learner", `frontend/profile/${me.id}`);
    assert.equal(profile.status, 404, "the profile is gone");
    const feed = await apiOk("learner", "frontend/showcase?limit=100");
    assert.ok(!JSON.stringify(feed).includes(post.content), "their post is gone from the showcase");
  });

  it("a deleted person's old session stops working", async () => {
    const me = await makeLearner("delsession");
    const session = await (await login(me.username, PASSWORD)).json();
    const removed = await api(me, "frontend/account", { method: "DELETE", body: { password: PASSWORD } });
    assert.equal(removed.status, 200);
    const refreshed = await fetch(`${urls.api}/auth/refresh`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ refreshToken: session.refreshToken }) });
    assert.equal(refreshed.status, 401);
  });

  it("a hirer who deletes the account closes the open jobs", async () => {
    const me = await makeHirer("delhirer");
    const job = await makeJob({ owner: me, title: unique("Soon closed job") });
    await open(me);
    await openModal();
    await answer(PASSWORD);
    await click(b.driver, confirmButton);
    await waitUrl(b.driver, /^\/login/);
    const jobs = await apiOk("admin", `frontend/admin/jobs?q=${encodeURIComponent(job.title)}`);
    assert.equal(jobs[0].status, "closed");
  });

  it("an administrator can delete their own account when another administrator exists", async () => {
    await makeAdmin("keepone");
    const me = await makeAdmin("delme");
    await open(me);
    await openModal();
    await answer(PASSWORD);
    await click(b.driver, confirmButton);
    await waitUrl(b.driver, /^\/login/);
    assert.equal((await login(me.username, PASSWORD)).status, 401);
  });

  it("the server needs the password and refuses a wrong one", async () => {
    const me = await makeLearner("delapi");
    assert.equal((await api(me, "frontend/account", { method: "DELETE", body: {} })).status, 422);
    assert.equal((await api(me, "frontend/account", { method: "DELETE", body: { password: "nope-nope-1" } })).status, 403);
    assert.equal((await login(me.username, PASSWORD)).status, 200);
  });

  it("signed-out requests cannot touch accounts", async () => {
    const response = await fetch(`${urls.api}/frontend/account`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: "x" }) });
    assert.equal(response.status, 401);
  });
});
