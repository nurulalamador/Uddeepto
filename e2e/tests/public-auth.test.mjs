import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { By, WEB, api, bodyText, click, clickButton, clickLink, currentPath, exists, find, go, hasText, isShown, setValue, signIn, texts, type, unique, useBrowser, waitText, waitUrl, xText } from "../lib/browser.mjs";
import { accounts, PASSWORD } from "../lib/config.mjs";
import { loginViaForm, logout, openProfileMenu, sidebarItems, waitWorkspace } from "../lib/flows.mjs";

describe("Public site", () => {
  const b = useBrowser();

  it("landing page shows the headline, the sign-in links and the call to action", async () => {
    await go(b.driver, "/");
    await waitText(b.driver, "Big ambitions.");
    await waitText(b.driver, "Endless possibilities.");
    assert.ok(await isShown(b.driver, xText("Log in", { tag: "a", exact: true })));
    assert.ok(await isShown(b.driver, xText("Get started", { tag: "a", exact: true })));
    assert.ok(await isShown(b.driver, xText("Start your journey", { tag: "a" })));
  });

  it("landing page lists the four ways to grow", async () => {
    await go(b.driver, "/");
    for (const title of ["Learn at your pace", "Put skills into action", "Find your people", "Make your next move"]) await waitText(b.driver, title);
  });

  it("'Start your journey' opens the sign-up page", async () => {
    await go(b.driver, "/");
    await clickLink(b.driver, "Start your journey");
    await waitUrl(b.driver, "/signup");
    await waitText(b.driver, "Your next chapter.");
  });

  it("'Log in' in the header opens the login page", async () => {
    await go(b.driver, "/");
    await clickLink(b.driver, "Log in", { exact: true });
    await waitUrl(b.driver, "/login");
    await waitText(b.driver, "Welcome back.");
  });

  it("the About page opens from the header and has its own heading", async () => {
    await go(b.driver, "/");
    await clickLink(b.driver, "About us");
    await waitUrl(b.driver, "/about");
    await waitText(b.driver, "ABOUT UDDEEPTO");
    await waitText(b.driver, "Growth is better");
  });

  it("a deep unknown address shows the friendly 404 and 'Go home' returns to the landing page", async () => {
    await go(b.driver, "/no/such/page/at-all");
    await waitText(b.driver, "Page not found.");
    await clickLink(b.driver, "Go home");
    await waitUrl(b.driver, /^\/$/);
    await waitText(b.driver, "Big ambitions.");
  });

  it("an unknown workspace address sends a signed-out visitor to the login page", async () => {
    await b.driver.manage().deleteAllCookies();
    await go(b.driver, "/this-page-does-not-exist");
    await waitUrl(b.driver, /^\/login/);
  });

  it("the theme button switches between light and dark mode", async () => {
    await go(b.driver, "/");
    await b.driver.executeScript("localStorage.removeItem('ud-theme')");
    await go(b.driver, "/");
    const mode = () => b.driver.executeScript("return document.documentElement.dataset.theme");
    const before = await mode();
    await click(b.driver, By.css("button[aria-label^='Switch to']"));
    await b.driver.wait(async () => (await mode()) !== before, 5000);
    const after = await mode();
    assert.notEqual(after, before);
    await click(b.driver, By.css("button[aria-label^='Switch to']"));
    await b.driver.wait(async () => (await mode()) === before, 5000);
  });
});

describe("Login", () => {
  const b = useBrowser();

  it("the form asks for an email or username and a password", async () => {
    await go(b.driver, "/login");
    await waitText(b.driver, "Welcome back.");
    assert.ok(await isShown(b.driver, By.css("input[name=identifier]")));
    assert.ok(await isShown(b.driver, By.css("input[name=password]")));
    assert.ok(await isShown(b.driver, xText("Sign in", { tag: "button" })));
    assert.ok(await isShown(b.driver, xText("Create an account", { tag: "a" })));
  });

  it("empty fields are stopped by the browser and nothing is sent", async () => {
    await go(b.driver, "/login");
    await clickButton(b.driver, "Sign in", { exact: false });
    assert.equal(await currentPath(b.driver), "/login");
    const missing = await b.driver.executeScript("return document.querySelector('input[name=identifier]').validity.valueMissing");
    assert.equal(missing, true);
  });

  it("a wrong password shows 'Invalid credentials' and stays on the page", async () => {
    await loginViaForm(b.driver, accounts.learner.username, "definitely-wrong-password");
    await waitText(b.driver, "Invalid credentials");
    assert.equal(await currentPath(b.driver), "/login");
  });

  it("an unknown account shows the same 'Invalid credentials' message", async () => {
    await loginViaForm(b.driver, "nobody-here-at-all");
    await waitText(b.driver, "Invalid credentials");
  });

  it("the password can be revealed and hidden again", async () => {
    await go(b.driver, "/login");
    const input = By.css("input[name=password]");
    await type(b.driver, input, "secret-value");
    assert.equal(await (await find(b.driver, input)).getAttribute("type"), "password");
    await click(b.driver, By.css("button[aria-label='Show password']"));
    assert.equal(await (await find(b.driver, input)).getAttribute("type"), "text");
    await click(b.driver, By.css("button[aria-label='Hide password']"));
    assert.equal(await (await find(b.driver, input)).getAttribute("type"), "password");
  });

  it("a suspended account is refused", async () => {
    await loginViaForm(b.driver, accounts.banned.username);
    await waitText(b.driver, "Account is suspended");
    assert.equal(await currentPath(b.driver), "/login");
  });

  it("a learner can sign in with a username and lands on the dashboard", async () => {
    await loginViaForm(b.driver, accounts.learner.username);
    await waitUrl(b.driver, "/dashboard");
    await waitWorkspace(b.driver);
    await waitText(b.driver, "Lena");
  });

  it("signing in with the email address works too", async () => {
    await loginViaForm(b.driver, accounts.learner2.email);
    await waitUrl(b.driver, "/dashboard");
    await waitWorkspace(b.driver);
    await waitText(b.driver, "Liam");
  });

  it("a hirer is taken to the hirer dashboard", async () => {
    await loginViaForm(b.driver, accounts.hirer.username);
    await waitUrl(b.driver, "/dashboard");
    await waitText(b.driver, "Hana");
    await waitText(b.driver, "Open positions");
  });

  it("an admin is taken to the admin console", async () => {
    await loginViaForm(b.driver, accounts.admin.username);
    await waitUrl(b.driver, "/dashboard");
    await waitText(b.driver, "Platform overview");
    await waitText(b.driver, "ADMIN CONSOLE");
  });

  it("the session survives a page reload and the landing page offers 'Go to dashboard'", async () => {
    await signIn(b.driver, "learner");
    await go(b.driver, "/dashboard");
    await waitWorkspace(b.driver);
    await b.driver.navigate().refresh();
    await waitWorkspace(b.driver);
    await go(b.driver, "/");
    assert.ok(await isShown(b.driver, xText("Go to dashboard", { tag: "a" })));
  });

  it("signing out returns to the login page and protects the workspace again", async () => {
    await signIn(b.driver, "learner");
    await go(b.driver, "/dashboard");
    await waitWorkspace(b.driver);
    await logout(b.driver);
    await go(b.driver, "/dashboard");
    await waitUrl(b.driver, /^\/login/);
  });

  it("every workspace page sends a signed-out visitor to the login page", async () => {
    await b.driver.manage().deleteAllCookies();
    for (const route of ["/dashboard", "/courses", "/contests", "/webinars", "/communities", "/jobs", "/messages", "/notifications", "/profile", "/admin", "/showcase"]) {
      await go(b.driver, route);
      await waitUrl(b.driver, /^\/login/);
    }
  });
});

describe("Sign up", () => {
  const b = useBrowser();
  const fill = async (fields) => {
    await go(b.driver, "/signup");
    await waitText(b.driver, "Your next chapter.");
    for (const [name, value] of Object.entries(fields)) {
      if (name === "role") await setValue(b.driver, By.css("select[name=role]"), value);
      else await type(b.driver, By.css(`[name=${name}]`), value);
    }
  };
  const newAccount = (tag) => {
    const key = unique(tag).replace(/[^a-z0-9]/gi, "").toLowerCase().slice(0, 18);
    return { name: `Test ${tag}`, email: `${key}@e2e.test`, username: key, password: PASSWORD };
  };

  it("the form has a name, email, username, password and role", async () => {
    await go(b.driver, "/signup");
    for (const name of ["name", "email", "username", "password", "role"]) assert.ok(await exists(b.driver, By.css(`[name=${name}]`)), name);
    assert.deepEqual(await texts(b.driver, By.css("select[name=role] option")), ["Learn, create and find opportunities", "Hire talented people"]);
  });

  it("a password shorter than eight characters is rejected by the browser", async () => {
    const account = newAccount("short");
    await fill({ ...account, password: "short" });
    await clickButton(b.driver, "Create account", { exact: false });
    assert.equal(await currentPath(b.driver), "/signup");
    assert.equal(await b.driver.executeScript("return document.querySelector('input[name=password]').validity.tooShort"), true);
  });

  it("a username with spaces or symbols is rejected by the browser", async () => {
    const account = newAccount("badname");
    await fill({ ...account, username: "bad name!" });
    await clickButton(b.driver, "Create account", { exact: false });
    assert.equal(await currentPath(b.driver), "/signup");
    assert.equal(await b.driver.executeScript("return document.querySelector('input[name=username]').validity.patternMismatch"), true);
  });

  it("an email address that is already registered is refused", async () => {
    const account = newAccount("dupemail");
    await fill({ ...account, email: accounts.learner.email });
    await clickButton(b.driver, "Create account", { exact: false });
    await waitText(b.driver, "Already exists");
    assert.equal(await currentPath(b.driver), "/signup");
  });

  it("a username that is already taken is refused", async () => {
    const account = newAccount("dupuser");
    await fill({ ...account, username: accounts.hirer.username });
    await clickButton(b.driver, "Create account", { exact: false });
    await waitText(b.driver, "Already exists");
  });

  it("a new learner is signed in at once and must choose interests first", async () => {
    const account = newAccount("learner");
    await fill(account);
    await clickButton(b.driver, "Create account", { exact: false });
    await waitUrl(b.driver, "/dashboard");
    await waitWorkspace(b.driver);
    await waitText(b.driver, "Choose your interest");
    const items = await sidebarItems(b.driver);
    assert.ok(items.includes("Courses") && items.includes("Contests"), `learner menu: ${items}`);
  });

  it("a new learner also gets a welcome notification", async () => {
    const account = newAccount("welcome");
    await fill(account);
    await clickButton(b.driver, "Create account", { exact: false });
    await waitUrl(b.driver, "/dashboard");
    await waitWorkspace(b.driver);
    const me = await api({ username: account.username }, "frontend/notifications");
    assert.equal(me.status, 200);
    assert.ok(me.data.items.some((item) => item.type === "welcome" && item.title.startsWith("Welcome to Uddeepto")), JSON.stringify(me.data));
  });

  it("a new hirer goes straight to a hirer workspace without the interest question", async () => {
    const account = newAccount("hirer");
    await fill({ ...account, role: "hirer" });
    await clickButton(b.driver, "Create account", { exact: false });
    await waitUrl(b.driver, "/dashboard");
    await waitWorkspace(b.driver);
    await waitText(b.driver, "Post your first job");
    assert.equal(await hasText(b.driver, "Choose your interest"), false);
    const items = await sidebarItems(b.driver);
    assert.ok(items.includes("Job Management") && !items.includes("Courses"), `hirer menu: ${items}`);
  });

  it("admins are told when a new hirer registers", async () => {
    const account = newAccount("alert");
    await fill({ ...account, role: "hirer" });
    await clickButton(b.driver, "Create account", { exact: false });
    await waitUrl(b.driver, "/dashboard");
    const list = await api("admin", "frontend/notifications?category=admin");
    assert.ok(list.data.items.some((item) => item.type === "hirer_registered" && item.title.includes(account.name)), JSON.stringify(list.data.items.map((i) => i.title)));
  });

  it("the sign-up page links to login and back", async () => {
    await go(b.driver, "/signup");
    await clickLink(b.driver, "Sign in");
    await waitUrl(b.driver, "/login");
    await clickLink(b.driver, "Create an account");
    await waitUrl(b.driver, "/signup");
  });
});

describe("Registration switch", () => {
  const b = useBrowser();

  it("when an admin pauses sign-ups, the form explains it", async () => {
    const before = await api("admin", "frontend/admin/settings");
    assert.equal(before.status, 200);
    const off = await api("admin", "frontend/admin/settings", { method: "PATCH", body: { registration_open: false } });
    assert.equal(off.status, 200, JSON.stringify(off.data));
    try {
      await go(b.driver, "/signup");
      const key = unique("closed").replace(/[^a-z0-9]/gi, "").toLowerCase().slice(0, 18);
      await type(b.driver, By.css("[name=name]"), "Closed Door");
      await type(b.driver, By.css("[name=email]"), `${key}@e2e.test`);
      await type(b.driver, By.css("[name=username]"), key);
      await type(b.driver, By.css("[name=password]"), PASSWORD);
      await clickButton(b.driver, "Create account", { exact: false });
      await waitText(b.driver, "Public registration is currently paused");
    } finally {
      await api("admin", "frontend/admin/settings", { method: "PATCH", body: { registration_open: before.data.registration_open } });
    }
  });
});
