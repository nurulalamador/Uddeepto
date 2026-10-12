import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { By, api, apiOk, click, clickButton, count, exists, find, go, hasText, isShown, q, setValue, signIn, sleep, texts, type, unique, useBrowser, visible, waitGone, waitNoText, waitText, waitUrl, xText } from "../lib/browser.mjs";
import { makeHirer, makeLearner, makeUser } from "../lib/factory.mjs";
import { PASSWORD, urls } from "../lib/config.mjs";
import { goSidebar, loginViaForm, waitWorkspace } from "../lib/flows.mjs";

const search = By.css(".admin-filters input[placeholder^='Search']");
const row = (text) => By.xpath(`//table[contains(@class,'admin-table')]//tbody/tr[.//*[contains(normalize-space(.), ${q(text)})]]`);
const rowAction = (text, label) => By.xpath(`//table[contains(@class,'admin-table')]//tbody/tr[.//*[contains(normalize-space(.), ${q(text)})]]//button[@aria-label=${q(label)}]`);
const rowCheck = (name) => By.css(`input[type=checkbox][aria-label=${JSON.stringify(`Select ${name}`)}]`);
const filter = (label) => By.xpath(`//label[contains(@class,'admin-filter-select')][./span[normalize-space(.)=${q(label)}]]//select`);
const modalField = (name) => By.css(`.modal [name=${name}]`);
const save = (label) => By.xpath(`//*[contains(@class,'modal')]//button[contains(normalize-space(.),${q(label)})]`);

async function openUsers(b, who = "admin") {
  await signIn(b.driver, who);
  await go(b.driver, "/admin");
  await waitText(b.driver, "Management");
  await visible(b.driver, search);
}
async function find_(b, text) {
  await type(b.driver, search, text);
  await sleep(700); // let the debounced search settle so a later click is not lost to the reload
  await visible(b.driver, row(text));
}
const login = async (account, password = PASSWORD) =>
  fetch(`${urls.api}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ identifier: account.username, password }) });

describe("Admin · Management page", () => {
  const b = useBrowser();

  it("opens on the Users tab with the heading, the add button and eight resource tabs", async () => {
    await openUsers(b);
    await waitText(b.driver, "ADMINISTRATION");
    await visible(b.driver, xText("Add user", { tag: "button" }));
    assert.deepEqual(await texts(b.driver, By.css(".admin-resource-tabs button")), ["Users", "Courses", "Instructors", "Contests", "Webinars", "Jobs", "Interests", "Communities"]);
    assert.equal(await (await find(b.driver, By.css(".admin-resource-tabs button.active"))).getText(), "Users");
  });

  for (const [tab, heading, add] of [
    ["Courses", "Courses management", "Add course"],
    ["Instructors", "Instructors management", "Add instructor"],
    ["Contests", "Contests management", "Add contest"],
    ["Webinars", "Webinars management", "Add webinar"],
    ["Jobs", "Jobs management", "Add job"],
    ["Interests", "Interests management", "Add interest"],
    ["Communities", "Communities management", "Add community"],
  ])
    it(`the ${tab} tab shows "${heading}" and "${add}"`, async () => {
      await openUsers(b);
      await click(b.driver, By.xpath(`//nav[@aria-label='Manage records']//button[normalize-space(.)='${tab}']`));
      await waitText(b.driver, heading);
      await visible(b.driver, xText(add, { tag: "button" }));
    });

  it("a deep link such as /admin?tab=jobs opens that tab", async () => {
    await signIn(b.driver, "admin");
    await go(b.driver, "/admin?tab=jobs");
    await waitText(b.driver, "Jobs management");
  });

  it("an unknown tab falls back to the users list", async () => {
    await signIn(b.driver, "admin");
    await go(b.driver, "/admin?tab=nonsense");
    await waitText(b.driver, "Management");
    await visible(b.driver, xText("Add user", { tag: "button" }));
  });

  it("switching tabs clears the search box", async () => {
    await openUsers(b);
    await type(b.driver, search, "lena");
    await click(b.driver, By.xpath("//nav[@aria-label='Manage records']//button[normalize-space(.)='Courses']"));
    await waitText(b.driver, "Courses management");
    assert.equal(await (await find(b.driver, search)).getAttribute("value"), "");
  });

  it("the moderation shortcut leads to the Moderation page", async () => {
    await openUsers(b);
    await click(b.driver, xText("Moderation queue", { tag: "a" }));
    await waitUrl(b.driver, /^\/moderation/);
  });
});

describe("Admin · Users list", () => {
  const b = useBrowser();

  it("lists accounts with name, email, role, status, created and last sign-in", async () => {
    await openUsers(b);
    assert.deepEqual(await texts(b.driver, By.css(".admin-table thead th")), ["", "NAME", "EMAIL", "ROLE", "ACCOUNT STATUS", "CREATED", "LAST SIGN-IN", "ACTIONS"].map((t) => t) .map((t) => t));
  });

  it("shows a person's details in their row", async () => {
    await openUsers(b);
    await find_(b, "Lena Learner");
    const text = await (await find(b.driver, row("Lena Learner"))).getText();
    assert.match(text, /learner1@e2e\.test/);
    assert.match(text.toLowerCase(), /learner/);
    assert.match(text.toLowerCase(), /active/);
  });

  it("search finds people by name", async () => {
    await openUsers(b);
    await find_(b, "Hana Hirer");
    assert.equal(await count(b.driver, By.css(".admin-table tbody tr")), 1);
  });

  it("search finds people by email", async () => {
    await openUsers(b);
    await type(b.driver, search, "hirer2@e2e.test");
    await visible(b.driver, row("Hugo Hirer"));
    await b.driver.wait(async () => (await count(b.driver, By.css(".admin-table tbody tr"))) === 1, 8000);
  });

  it("search finds people by username", async () => {
    await openUsers(b);
    await type(b.driver, search, "admin1");
    await visible(b.driver, row("Ada Admin"));
  });

  it("a search with no match shows the empty state", async () => {
    await openUsers(b);
    await type(b.driver, search, "zzzz-nobody-zzzz");
    await waitText(b.driver, "No matching records");
    await waitText(b.driver, "Change your filters or create the first record in this section.");
  });

  it("clearing the search brings the list back", async () => {
    await openUsers(b);
    await type(b.driver, search, "zzzz-nobody-zzzz");
    await waitText(b.driver, "No matching records");
    await type(b.driver, search, "");
    await b.driver.wait(async () => (await count(b.driver, By.css(".admin-table tbody tr"))) > 3, 8000);
  });

  it("the status filter keeps only suspended accounts", async () => {
    await openUsers(b);
    await setValue(b.driver, filter("Status"), "suspended");
    await visible(b.driver, row("Bob Banned"));
    await b.driver.wait(async () => !(await exists(b.driver, row("Lena Learner"))), 8000);
    const badges = await texts(b.driver, By.css(".admin-table tbody tr td:nth-child(5)"));
    assert.ok(badges.length > 0 && badges.every((t) => /suspended/i.test(t)), badges.join(","));
  });

  it("the status filter lists All, Active, Suspended and Deactivated", async () => {
    await openUsers(b);
    assert.deepEqual(await texts(b.driver, By.xpath("//label[./span[normalize-space(.)='Status']]//option")), ["All statuses", "Active", "Suspended", "Deactivated"]);
  });

  it("sorting by name A to Z puts names in alphabetical order", async () => {
    await openUsers(b);
    await setValue(b.driver, By.xpath("//label[./span[normalize-space(.)='Sort']]//select"), "name");
    await b.driver.wait(async () => {
      const names = (await texts(b.driver, By.css(".admin-table tbody tr td:nth-child(2) strong"))).map((n) => n.toLowerCase());
      return names.length > 3 && names[0] === [...names].sort()[0] && names[0] < names.at(-1);
    }, 8000);
  });

  it("the direction button reverses the order", async () => {
    await openUsers(b);
    await setValue(b.driver, By.xpath("//label[./span[normalize-space(.)='Sort']]//select"), "name");
    await click(b.driver, By.css("button.admin-sort-direction"));
    await b.driver.wait(async () => {
      const names = (await texts(b.driver, By.css(".admin-table tbody tr td:nth-child(2) strong"))).map((n) => n.toLowerCase());
      return names.length > 3 && names[0] === [...names].sort().at(-1) && names[0] > names.at(-1);
    }, 8000);
    assert.equal(await (await find(b.driver, By.css("button.admin-sort-direction"))).getAttribute("aria-label"), "Newest first");
  });

  it("sorting by role groups accounts of the same role", async () => {
    await openUsers(b);
    await setValue(b.driver, By.xpath("//label[./span[normalize-space(.)='Sort']]//select"), "role");
    await b.driver.wait(async () => {
      const roles = (await texts(b.driver, By.css(".admin-table tbody tr td:nth-child(4)"))).map((t) => t.toLowerCase());
      return roles.length > 3 && roles.every((r, i) => i === 0 || roles[i - 1] <= r || roles[i - 1] >= r);
    }, 8000);
  });

  it("the newest account is first by default", async () => {
    const person = await makeLearner("newest");
    await openUsers(b);
    await b.driver.wait(async () => (await texts(b.driver, By.css(".admin-table tbody tr td:nth-child(2) strong")))[0] === person.name, 8000);
  });

  it("a 'From' date in the future leaves no accounts", async () => {
    await openUsers(b);
    await setValue(b.driver, By.xpath("//label[./span[normalize-space(.)='From']]//input"), "2999-01-01");
    await waitText(b.driver, "No matching records");
  });

  it("a 'To' date in the past leaves no accounts", async () => {
    await openUsers(b);
    await setValue(b.driver, By.xpath("//label[./span[normalize-space(.)='To']]//input"), "2000-01-01");
    await waitText(b.driver, "No matching records");
  });

  it("the pager shows the range and disables Previous on the first page", async () => {
    await openUsers(b);
    await waitText(b.driver, "Showing 1-");
    assert.equal(await (await find(b.driver, xText("Previous", { tag: "button" }))).isEnabled(), false);
  });

  it("the pager's Next button moves on when there are more than twenty accounts", async () => {
    for (let i = 0; i < 22; i++) await makeUser({ role: "learner", tag: "bulkp" });
    await openUsers(b);
    await waitText(b.driver, "more records available");
    await click(b.driver, xText("Next", { tag: "button" }));
    await waitText(b.driver, "Page 2");
    await waitText(b.driver, "Showing 21-");
    await click(b.driver, xText("Previous", { tag: "button" }));
    await waitText(b.driver, "Page 1");
  });

  it("an account an admin created, who has not signed in yet, shows a dash for last sign-in", async () => {
    const key = unique("dashy").replace(/[^a-z0-9]/gi, "").toLowerCase().slice(0, 20);
    const made = await apiOk("admin", "frontend/admin/users", { method: "POST", body: { name: `Dashy ${key.slice(-5)}`, email: `${key}@e2e.test`, username: key, password: PASSWORD, role: "learner" } });
    await openUsers(b);
    await find_(b, made.name);
    const cells = await texts(b.driver, By.css(".admin-table tbody tr td:nth-child(7)"));
    assert.equal(cells[0], "-");
  });

  it("a person who signs in gets a last sign-in date", async () => {
    const person = await makeLearner("signedin");
    assert.equal((await login(person)).status, 200);
    await openUsers(b);
    await find_(b, person.name);
    const cells = await texts(b.driver, By.css(".admin-table tbody tr td:nth-child(7)"));
    assert.notEqual(cells[0], "-");
  });
});

describe("Admin · Add and edit users", () => {
  const b = useBrowser();
  const fresh = (tag) => {
    const key = unique(tag).replace(/[^a-z0-9]/gi, "").toLowerCase().slice(0, 20);
    return { name: `Made ${key.slice(-6)}`, email: `${key}@e2e.test`, username: key };
  };
  async function fillAdd(account, { role = "learner", password = PASSWORD } = {}) {
    await click(b.driver, xText("Add user", { tag: "button" }));
    await waitText(b.driver, "Add user");
    await type(b.driver, modalField("name"), account.name);
    await type(b.driver, modalField("email"), account.email);
    await type(b.driver, modalField("username"), account.username);
    await type(b.driver, modalField("password"), password);
    await setValue(b.driver, modalField("role"), role);
  }

  it("'Add user' opens a form with name, email, username, password and role", async () => {
    await openUsers(b);
    await click(b.driver, xText("Add user", { tag: "button" }));
    for (const name of ["name", "email", "username", "password", "role"]) await visible(b.driver, modalField(name));
    assert.equal(await exists(b.driver, modalField("account_status")), false, "status is only for existing accounts");
    assert.deepEqual(await texts(b.driver, By.css(".modal select[name=role] option")), ["Learner", "Hirer", "Admin"]);
  });

  it("the modal can be closed without saving", async () => {
    await openUsers(b);
    await click(b.driver, xText("Add user", { tag: "button" }));
    await visible(b.driver, modalField("name"));
    await click(b.driver, By.css(".modal [aria-label='Close'], .modal button.icon-button"));
    await waitGone(b.driver, By.css(".modal"));
  });

  it("an admin can create a learner who can then sign in", async () => {
    const account = fresh("newlearner");
    await openUsers(b);
    await fillAdd(account);
    await click(b.driver, save("Create user"));
    await waitText(b.driver, "User created.");
    await waitGone(b.driver, By.css(".modal"));
    await find_(b, account.name);
    assert.equal((await login(account)).status, 200);
  });

  it("an admin can create a hirer who lands on the hiring workspace", async () => {
    const account = fresh("newhirer");
    await openUsers(b);
    await fillAdd(account, { role: "hirer" });
    await click(b.driver, save("Create user"));
    await waitText(b.driver, "User created.");
    await signIn(b.driver, account);
    await go(b.driver, "/dashboard");
    await waitText(b.driver, "Open positions");
  });

  it("an admin can create another admin who sees the admin console", async () => {
    const account = fresh("newadmin");
    await openUsers(b);
    await fillAdd(account, { role: "admin" });
    await click(b.driver, save("Create user"));
    await waitText(b.driver, "User created.");
    await signIn(b.driver, account);
    await go(b.driver, "/dashboard");
    await waitText(b.driver, "Platform overview");
  });

  it("a duplicate email is refused with a message", async () => {
    const account = fresh("dupemail");
    await openUsers(b);
    await fillAdd({ ...account, email: "learner1@e2e.test" });
    await click(b.driver, save("Create user"));
    await b.driver.wait(async () => exists(b.driver, By.css(".modal [role=alert]")), 8000);
    assert.ok(await isShown(b.driver, By.css(".modal")));
  });

  it("a duplicate username is refused with a message", async () => {
    const account = fresh("dupname");
    await openUsers(b);
    await fillAdd({ ...account, username: "learner1" });
    await click(b.driver, save("Create user"));
    await b.driver.wait(async () => exists(b.driver, By.css(".modal [role=alert]")), 8000);
  });

  it("a password shorter than eight characters is rejected by the browser", async () => {
    await openUsers(b);
    await fillAdd(fresh("shortpw"), { password: "short" });
    await click(b.driver, save("Create user"));
    assert.equal(await b.driver.executeScript("return document.querySelector('.modal input[name=password]').validity.tooShort"), true);
    assert.ok(await isShown(b.driver, By.css(".modal")));
  });

  it("a username with symbols is rejected by the browser", async () => {
    await openUsers(b);
    await fillAdd({ ...fresh("badsym"), username: "bad name!" });
    await click(b.driver, save("Create user"));
    assert.equal(await b.driver.executeScript("return document.querySelector('.modal input[name=username]').validity.patternMismatch"), true);
  });

  it("an invalid email is rejected by the browser", async () => {
    await openUsers(b);
    await fillAdd({ ...fresh("bademail"), email: "not-an-email" });
    await click(b.driver, save("Create user"));
    assert.equal(await b.driver.executeScript("return document.querySelector('.modal input[name=email]').validity.typeMismatch"), true);
  });

  it("'Edit user' shows the current details, without a password field", async () => {
    const person = await makeLearner("editme");
    await openUsers(b);
    await find_(b, person.name);
    await click(b.driver, rowAction(person.name, "Edit user"));
    await waitText(b.driver, "Edit user");
    assert.equal(await (await find(b.driver, modalField("name"))).getAttribute("value"), person.name);
    assert.equal(await (await find(b.driver, modalField("email"))).getAttribute("value"), person.email);
    assert.equal(await (await find(b.driver, modalField("username"))).getAttribute("value"), person.username);
    assert.equal(await exists(b.driver, modalField("password")), false);
    assert.deepEqual(await texts(b.driver, By.css(".modal select[name=account_status] option")), ["Active", "Suspended", "Deactivated"]);
  });

  it("an admin can rename a user", async () => {
    const person = await makeLearner("renamed");
    const newName = unique("Renamed Person");
    await openUsers(b);
    await find_(b, person.name);
    await click(b.driver, rowAction(person.name, "Edit user"));
    await type(b.driver, modalField("name"), newName);
    await click(b.driver, save("Save changes"));
    await waitText(b.driver, "User updated.");
    await find_(b, newName);
    assert.equal((await apiOk(person, "users/me")).name, newName);
  });

  it("an admin can change a learner into a hirer", async () => {
    const person = await makeLearner("promoted");
    await openUsers(b);
    await find_(b, person.name);
    await click(b.driver, rowAction(person.name, "Edit user"));
    await setValue(b.driver, modalField("role"), "hirer");
    await click(b.driver, save("Save changes"));
    await waitText(b.driver, "User updated.");
    await b.driver.wait(async () => /hirer/i.test(await (await find(b.driver, row(person.name))).getText()), 8000);
    await signIn(b.driver, person);
    await go(b.driver, "/dashboard");
    await waitText(b.driver, "Open positions");
  });

  it("an admin can promote a hirer to admin", async () => {
    const person = await makeHirer("climber");
    await openUsers(b);
    await find_(b, person.name);
    await click(b.driver, rowAction(person.name, "Edit user"));
    await setValue(b.driver, modalField("role"), "admin");
    await click(b.driver, save("Save changes"));
    await waitText(b.driver, "User updated.");
    await signIn(b.driver, person);
    await go(b.driver, "/dashboard");
    await waitText(b.driver, "Platform overview");
  });

  it("suspending an account stops that person signing in", async () => {
    const person = await makeLearner("suspendme");
    assert.equal((await login(person)).status, 200);
    await openUsers(b);
    await find_(b, person.name);
    await click(b.driver, rowAction(person.name, "Edit user"));
    await setValue(b.driver, modalField("account_status"), "suspended");
    await click(b.driver, save("Save changes"));
    await waitText(b.driver, "User updated.");
    await b.driver.wait(async () => /suspended/i.test(await (await find(b.driver, row(person.name))).getText()), 8000);
    assert.equal((await login(person)).status, 403);
  });

  it("a suspended person sees an error on the login form", async () => {
    const person = await makeLearner("blocked");
    await apiOk("admin", `frontend/admin/users/${person.id}`, { method: "PATCH", body: { account_status: "suspended" } });
    await loginViaForm(b.driver, person.username);
    await waitText(b.driver, "suspended");
    assert.match(await b.driver.getCurrentUrl(), /\/login/);
  });

  it("an account that is already signed in loses access when suspended", async () => {
    const person = await makeLearner("kickedout");
    await signIn(b.driver, person);
    await go(b.driver, "/dashboard");
    await waitWorkspace(b.driver);
    await apiOk("admin", `frontend/admin/users/${person.id}`, { method: "PATCH", body: { account_status: "suspended" } });
    await b.driver.wait(async () => {
      await go(b.driver, "/courses");
      return /\/login/.test(await b.driver.getCurrentUrl()) || (await hasText(b.driver, "suspended")) || (await hasText(b.driver, "Sign in"));
    }, 30000);
  });

  it("reactivating an account lets the person sign in again", async () => {
    const person = await makeLearner("backagain");
    await apiOk("admin", `frontend/admin/users/${person.id}`, { method: "PATCH", body: { account_status: "suspended" } });
    assert.equal((await login(person)).status, 403);
    await openUsers(b);
    await find_(b, person.name);
    await click(b.driver, rowAction(person.name, "Edit user"));
    await setValue(b.driver, modalField("account_status"), "active");
    await click(b.driver, save("Save changes"));
    await waitText(b.driver, "User updated.");
    assert.equal((await login(person)).status, 200);
  });

  it("a deactivated account cannot sign in either", async () => {
    const person = await makeLearner("deactivated");
    await openUsers(b);
    await find_(b, person.name);
    await click(b.driver, rowAction(person.name, "Edit user"));
    await setValue(b.driver, modalField("account_status"), "deactivated");
    await click(b.driver, save("Save changes"));
    await waitText(b.driver, "User updated.");
    assert.equal((await login(person)).status, 403);
  });

  it("users cannot be deleted from the table", async () => {
    const person = await makeLearner("nodelete");
    await openUsers(b);
    await find_(b, person.name);
    assert.equal(await exists(b.driver, rowAction(person.name, "Delete user")), false);
    const refused = await api("admin", `frontend/admin/users/${person.id}`, { method: "DELETE" });
    assert.equal(refused.status, 409);
  });

  it("an admin can open someone's profile from search and see their public details", async () => {
    const person = await makeLearner("viewed");
    await signIn(b.driver, "admin");
    await go(b.driver, `/profile/${person.id}`);
    await waitText(b.driver, person.name);
  });
});

describe("Admin · Selecting and bulk-changing users", () => {
  const b = useBrowser();

  it("ticking a row shows the bulk bar with the count", async () => {
    const person = await makeLearner("picked");
    await openUsers(b);
    await find_(b, person.name);
    await click(b.driver, rowCheck(person.name));
    await waitText(b.driver, "1 selected");
    assert.ok(await isShown(b.driver, By.css("select[aria-label='New status for selected records']")));
  });

  it("the bulk bar offers no 'Delete selected' for users", async () => {
    const person = await makeLearner("nobulkdel");
    await openUsers(b);
    await find_(b, person.name);
    await click(b.driver, rowCheck(person.name));
    await waitText(b.driver, "1 selected");
    assert.equal(await exists(b.driver, xText("Delete selected", { tag: "button" })), false);
  });

  it("'Apply status' stays disabled until a status is chosen", async () => {
    const person = await makeLearner("needstatus");
    await openUsers(b);
    await find_(b, person.name);
    await click(b.driver, rowCheck(person.name));
    assert.equal(await (await find(b.driver, xText("Apply status", { tag: "button" }))).isEnabled(), false);
    await setValue(b.driver, By.css("select[aria-label='New status for selected records']"), "suspended");
    assert.equal(await (await find(b.driver, xText("Apply status", { tag: "button" }))).isEnabled(), true);
  });

  it("the clear button empties the selection", async () => {
    const person = await makeLearner("cleared");
    await openUsers(b);
    await find_(b, person.name);
    await click(b.driver, rowCheck(person.name));
    await waitText(b.driver, "1 selected");
    await click(b.driver, By.css("button[aria-label='Clear selection']"));
    await waitGone(b.driver, By.css(".admin-bulk-bar"));
  });

  it("'select all' ticks every row on the page", async () => {
    await openUsers(b);
    await click(b.driver, By.css("input[aria-label='Select all records on this page']"));
    const rows = await count(b.driver, By.css(".admin-table tbody tr"));
    await waitText(b.driver, `${rows} selected`);
  });

  it("changing the search drops the selection", async () => {
    const person = await makeLearner("dropsel");
    await openUsers(b);
    await find_(b, person.name);
    await click(b.driver, rowCheck(person.name));
    await waitText(b.driver, "1 selected");
    await type(b.driver, search, "Lena");
    await waitGone(b.driver, By.css(".admin-bulk-bar"));
  });

  it("two people can be suspended together and are then locked out", async () => {
    const [one, two] = [await makeLearner("bulkone"), await makeLearner("bulktwo")];
    const stamp = one.username.slice(0, 7);
    await openUsers(b);
    await find_(b, "Person");
    await click(b.driver, rowCheck(one.name));
    await click(b.driver, rowCheck(two.name));
    await waitText(b.driver, "2 selected");
    await setValue(b.driver, By.css("select[aria-label='New status for selected records']"), "suspended");
    await click(b.driver, xText("Apply status", { tag: "button" }));
    await waitText(b.driver, "2 record(s) updated.");
    assert.equal((await login(one)).status, 403, stamp);
    assert.equal((await login(two)).status, 403);
  });

  it("a bulk 'Active' puts them back", async () => {
    const [one, two] = [await makeLearner("backone"), await makeLearner("backtwo")];
    for (const person of [one, two]) await apiOk("admin", `frontend/admin/users/${person.id}`, { method: "PATCH", body: { account_status: "suspended" } });
    await openUsers(b);
    await setValue(b.driver, filter("Status"), "suspended");
    await visible(b.driver, row(one.name));
    await click(b.driver, rowCheck(one.name));
    await click(b.driver, rowCheck(two.name));
    await setValue(b.driver, By.css("select[aria-label='New status for selected records']"), "active");
    await click(b.driver, xText("Apply status", { tag: "button" }));
    await waitText(b.driver, "record(s) updated.");
    assert.equal((await login(one)).status, 200);
    assert.equal((await login(two)).status, 200);
  });

  it("the notice can be dismissed", async () => {
    const person = await makeLearner("dismiss");
    await openUsers(b);
    await find_(b, person.name);
    await click(b.driver, rowCheck(person.name));
    await setValue(b.driver, By.css("select[aria-label='New status for selected records']"), "active");
    await click(b.driver, xText("Apply status", { tag: "button" }));
    await waitText(b.driver, "record(s) updated.");
    await click(b.driver, By.css("button[aria-label='Dismiss message']"));
    await waitGone(b.driver, By.css(".admin-operation-notice"));
  });
});

describe("Admin · Account safety", () => {
  const b = useBrowser();

  it("an admin cannot sign in with a wrong password", async () => {
    assert.equal((await login({ username: "admin1" }, "not-the-password")).status, 401);
  });

  it("learners and hirers cannot create accounts through the admin API", async () => {
    for (const who of ["learner", "hirer"]) {
      const refused = await api(who, "frontend/admin/users", { method: "POST", body: { name: "Sneaky", email: "sneaky@e2e.test", username: "sneaky", password: PASSWORD, role: "admin" } });
      assert.equal(refused.status, 403, who);
    }
  });

  it("learners cannot promote themselves to admin", async () => {
    const person = await makeLearner("sneakyrole");
    const refused = await api(person, `frontend/admin/users/${person.id}`, { method: "PATCH", body: { role: "admin" } });
    assert.equal(refused.status, 403);
    assert.equal((await apiOk(person, "users/me")).role, "learner");
  });

  it("an unknown record id returns not found, not a crash", async () => {
    const missing = await api("admin", "frontend/admin/users/00000000-0000-4000-8000-000000000000", { method: "PATCH", body: { name: "Ghost Person" } });
    assert.equal(missing.status, 404);
  });

  it("an invalid role is refused", async () => {
    const person = await makeLearner("badrole");
    const refused = await api("admin", `frontend/admin/users/${person.id}`, { method: "PATCH", body: { role: "superuser" } });
    assert.ok([400, 422].includes(refused.status), String(refused.status));
  });

  it("unknown admin tables are refused", async () => {
    const refused = await api("admin", "frontend/admin/secrets");
    assert.ok([400, 404, 422].includes(refused.status), String(refused.status));
  });
});
