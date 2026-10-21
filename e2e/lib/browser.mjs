import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { after, afterEach, before } from "node:test";
import { Browser, Builder, By, Key, until } from "selenium-webdriver";
import chrome from "selenium-webdriver/chrome.js";
import edge from "selenium-webdriver/edge.js";
import firefox from "selenium-webdriver/firefox.js";
import { PASSWORD, accounts, paths, urls } from "./config.mjs";

export { By, Key, until };
export const WEB = urls.web;
export const TIMEOUT = Number(process.env.E2E_TIMEOUT || 12000);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
export { sleep };

// ------------------------------------------------------------------ browser
export async function openBrowser() {
  const headed = process.env.E2E_HEADED === "1";
  const name = (process.env.E2E_BROWSER || "chrome").toLowerCase();
  const builder = new Builder();
  let profile = null;
  if (name === "firefox") {
    const options = new firefox.Options().addArguments("-width=1440", "-height=900");
    if (!headed) options.addArguments("-headless");
    builder.forBrowser(Browser.FIREFOX).setFirefoxOptions(options);
  } else {
    // Left to itself Chrome puts each profile in a temp folder of its own and often leaves it behind.
    mkdirSync(paths.browserProfiles, { recursive: true });
    profile = mkdtempSync(path.join(paths.browserProfiles, `${name}-`));
    const args = ["--window-size=1440,900", "--lang=en-US", "--disable-gpu", "--no-sandbox", "--disable-dev-shm-usage", "--force-device-scale-factor=1", `--user-data-dir=${profile}`];
    if (!headed) args.push("--headless=new");
    if (name === "edge") builder.forBrowser(Browser.EDGE).setEdgeOptions(new edge.Options().addArguments(...args));
    else builder.forBrowser(Browser.CHROME).setChromeOptions(new chrome.Options().addArguments(...args));
  }
  const driver = await builder.build();
  await driver.manage().setTimeouts({ implicit: 0, pageLoad: 60000, script: 30000 });
  if (profile) {
    const quit = driver.quit.bind(driver);
    driver.quit = async () => {
      try {
        await quit();
      } finally {
        try {
          rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
        } catch {
          /* still locked: run.mjs clears the folder after the run */
        }
      }
    };
  }
  return driver;
}

/**
 * Registers hooks that give a test file its own browser. `b.driver` is ready inside tests,
 * and a screenshot is saved to e2e/artifacts/ whenever a test fails.
 */
export function useBrowser() {
  const b = { driver: null };
  before(async () => {
    b.driver = await openBrowser();
  });
  after(async () => {
    await b.driver?.quit().catch(() => {});
  });
  afterEach(async (t) => {
    if (!b.driver || t?.passed !== false) return;
    try {
      mkdirSync(paths.artifacts, { recursive: true });
      const name = String(t.name || "test").replace(/[^a-z0-9]+/gi, "-").slice(0, 80);
      writeFileSync(path.join(paths.artifacts, `FAIL-${name}.png`), await b.driver.takeScreenshot(), "base64");
    } catch {
      /* the browser may already be gone */
    }
  });
  return b;
}

// ------------------------------------------------------------------ navigation and waiting
export const go = async (driver, route = "/") => {
  await driver.get(route.startsWith("http") ? route : WEB + route);
  await settle(driver);
};
export const currentPath = async (driver) => {
  const url = new URL(await driver.getCurrentUrl());
  return url.pathname + url.search;
};
export async function waitUrl(driver, matcher, timeout = TIMEOUT) {
  const test = (value) => (matcher instanceof RegExp ? matcher.test(value) : value.includes(matcher));
  await driver.wait(async () => test(await currentPath(driver)), timeout, `URL never matched ${matcher} (is ${await currentPath(driver)})`);
}
/** Waits for the page to stop loading (document ready; client data requests are awaited by the tests' own waits). */
export async function settle(driver) {
  await driver.wait(async () => (await driver.executeScript("return document.readyState")) === "complete", 30000);
}

export const q = (text) => (text.includes("'") ? `concat('${text.split("'").join(`', "'", '`)}')` : `'${text}'`);
/** XPath for an element whose own visible text contains (or equals, with exact) the text. */
export const xText = (text, { tag = "*", exact = false } = {}) => {
  const match = exact ? `normalize-space(.)=${q(text)}` : `contains(normalize-space(.), ${q(text)})`;
  // Without a tag, prefer the innermost element holding the text (not its wrappers); with a tag the caller means that element.
  const innermost = !exact && tag === "*" ? `[not(.//*[contains(normalize-space(.), ${q(text)})])]` : "";
  return By.xpath(`//${tag}[${match}][not(self::script) and not(self::style)]${innermost}`);
};

/** Runs `fn` again when React replaced the element it was holding while the page re-rendered. */
export async function retryStale(fn, attempts = 5) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      if (attempt >= attempts - 1 || !/stale/i.test(String(error.message))) throw error;
      await sleep(150);
    }
  }
}

export async function find(driver, locator, timeout = TIMEOUT) {
  const loc = typeof locator === "string" ? By.css(locator) : locator;
  return driver.wait(until.elementLocated(loc), timeout, `Element not found: ${loc}`);
}
export async function visible(driver, locator, timeout = TIMEOUT) {
  return retryStale(async () => {
    const el = await find(driver, locator, timeout);
    await driver.wait(until.elementIsVisible(el), timeout, `Element not visible: ${locator}`);
    return el;
  });
}
export async function exists(driver, locator) {
  const loc = typeof locator === "string" ? By.css(locator) : locator;
  return (await driver.findElements(loc)).length > 0;
}
export async function isShown(driver, locator) {
  const loc = typeof locator === "string" ? By.css(locator) : locator;
  const items = await driver.findElements(loc);
  for (const item of items) if (await item.isDisplayed().catch(() => false)) return true;
  return false;
}
export async function all(driver, locator) {
  const loc = typeof locator === "string" ? By.css(locator) : locator;
  return driver.findElements(loc);
}
export async function count(driver, locator) {
  return (await all(driver, locator)).length;
}
/** Visible text of every match. Lists re-render as data arrives, so a stale element is simply read again. */
export async function texts(driver, locator) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      const items = await all(driver, locator);
      return await Promise.all(items.map((item) => item.getText()));
    } catch (error) {
      if (attempt >= 4 || !/stale/i.test(String(error.message))) throw error;
      await sleep(150);
    }
  }
}
export async function bodyText(driver) {
  return (await driver.findElement(By.css("body"))).getText();
}
/** Waits until the page text contains `text` (case-sensitive). */
export async function waitText(driver, text, timeout = TIMEOUT) {
  let last = "";
  await driver.wait(async () => ((last = await bodyText(driver)).includes(text)), timeout, `Text never appeared: "${text}"\n--- page text ---\n${last.slice(0, 600)}`);
}
/** Like waitText but ignores capitalisation (CSS often shows labels in capitals). */
export async function waitTextCI(driver, text, timeout = TIMEOUT) {
  let last = "";
  await driver.wait(async () => ((last = await bodyText(driver)).toLowerCase().includes(text.toLowerCase())), timeout, `Text never appeared (any case): "${text}"
--- page text ---
${last.slice(0, 600)}`);
}
export async function waitNoText(driver, text, timeout = TIMEOUT) {
  await driver.wait(async () => !(await bodyText(driver)).includes(text), timeout, `Text still on the page: "${text}"`);
}
export async function hasText(driver, text) {
  return (await bodyText(driver)).includes(text);
}
export async function waitGone(driver, locator, timeout = TIMEOUT) {
  await driver.wait(async () => !(await isShown(driver, locator)), timeout, `Element is still shown: ${locator}`);
}

// ------------------------------------------------------------------ actions
export async function click(driver, locator, timeout = TIMEOUT) {
  return retryStale(async () => {
    const el = await visible(driver, locator, timeout);
    await driver.executeScript("arguments[0].scrollIntoView({block:'center',inline:'nearest'})", el);
    try {
      await driver.wait(until.elementIsEnabled(el), timeout);
      await el.click();
    } catch (error) {
      // Sticky bars, floating buttons or animations can cover the element; a script click still fires the handler.
      if (/stale/i.test(String(error.message)) || !/intercepted|not interactable/i.test(String(error.message))) throw error;
      await sleep(250);
      await driver.executeScript("arguments[0].click()", await find(driver, locator, 2000));
    }
  });
}
export const clickText = (driver, text, options = {}) => click(driver, xText(text, options));
export const clickButton = (driver, text, { exact = true } = {}) => click(driver, xText(text, { tag: "button", exact }));
export const clickLink = (driver, text, { exact = false } = {}) => click(driver, xText(text, { tag: "a", exact }));

export async function type(driver, locator, text, { clear = true, enter = false } = {}) {
  const el = await visible(driver, locator);
  await driver.executeScript("arguments[0].scrollIntoView({block:'center'})", el);
  if (clear) {
    try {
      await el.click();
    } catch (error) {
      // Something (a preview, a sticky bar) covers the field: focusing it with a script is enough to type.
      if (!/intercepted|not interactable/i.test(String(error.message))) throw error;
      await driver.executeScript("arguments[0].focus()", el);
    }
    await el.sendKeys(Key.chord(Key.CONTROL, "a"), Key.BACK_SPACE);
  }
  if (text !== "") await el.sendKeys(text);
  if (enter) await el.sendKeys(Key.ENTER);
  return el;
}
/** Sets a controlled React input/textarea/select value in one go (for long text and date inputs). */
export async function setValue(driver, locator, value) {
  const el = await visible(driver, locator);
  await driver.executeScript(
    `const el = arguments[0], value = arguments[1];
     const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
     Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
     el.dispatchEvent(new Event('input', { bubbles: true }));
     el.dispatchEvent(new Event('change', { bubbles: true }));`,
    el,
    value,
  );
}
/** A form field found through its <label> text. */
export const field = (label, control = "input|textarea|select") =>
  By.xpath(`//label[contains(normalize-space(.), ${q(label)})]//*[${control.split("|").map((c) => `self::${c}`).join(" or ")}]`);
export const named = (name) => By.css(`[name="${name}"]`);

export async function upload(driver, locator, filePath) {
  const el = await find(driver, locator);
  await driver.executeScript("arguments[0].style.display='block';arguments[0].style.visibility='visible';arguments[0].style.opacity=1;arguments[0].style.position='static'", el);
  await el.sendKeys(filePath);
}
export async function scrollTo(driver, locator) {
  const el = await find(driver, locator);
  await driver.executeScript("arguments[0].scrollIntoView({block:'center'})", el);
  return el;
}
export async function press(driver, key) {
  await driver.actions().sendKeys(key).perform();
}
export async function hover(driver, locator) {
  const el = await visible(driver, locator);
  await driver.actions().move({ origin: el }).perform();
}
/** Accepts a window.confirm() dialog raised by the click that `action` performs. */
export async function acceptConfirm(driver, action) {
  await action();
  await driver.wait(until.alertIsPresent(), TIMEOUT, "No confirm dialog appeared");
  const alert = await driver.switchTo().alert();
  const message = await alert.getText();
  await alert.accept();
  return message;
}
export async function dismissConfirm(driver, action) {
  await action();
  await driver.wait(until.alertIsPresent(), TIMEOUT, "No confirm dialog appeared");
  const alert = await driver.switchTo().alert();
  await alert.dismiss();
}
/** Opens the site's custom dropdown (its trigger has the aria-label) and picks an option by its text. */
export async function chooseOption(driver, ariaLabel, optionText) {
  await click(driver, By.css(`button[aria-label="${ariaLabel}"]`));
  const lower = optionText.toLowerCase();
  await click(driver, By.xpath(`//*[@role='listbox'][@aria-label=${q(ariaLabel)}]//*[@role='option'][translate(normalize-space(.),'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz')=${q(lower)}]`));
}
/** The text currently shown on a custom dropdown's trigger. */
export async function dropdownValue(driver, ariaLabel) {
  return (await find(driver, By.css(`button[aria-label="${ariaLabel}"]`))).getText();
}
export async function screenshot(driver, name) {
  mkdirSync(paths.artifacts, { recursive: true });
  writeFileSync(path.join(paths.artifacts, `${name}.png`), await driver.takeScreenshot(), "base64");
}

// ------------------------------------------------------------------ accounts and the API
const tokens = new Map();
/** Logs an account in through the website's own endpoint and returns its cookies. */
export async function loginCookies(who) {
  const account = typeof who === "string" ? accounts[who] : who;
  const response = await fetch(`${WEB}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: new URL(WEB).origin },
    body: JSON.stringify({ identifier: account.username, password: PASSWORD }),
  });
  if (!response.ok) throw new Error(`Login failed for ${account.username}: ${response.status} ${await response.text()}`);
  const cookies = {};
  for (const line of response.headers.getSetCookie()) {
    const [pair] = line.split(";");
    const [name, ...value] = pair.split("=");
    cookies[name.trim()] = value.join("=");
  }
  return cookies;
}
/** Starts a browser session as `who` without going through the login form (fast). */
export async function signIn(driver, who) {
  const cookies = await loginCookies(who);
  await driver.get(`${WEB}/login`);
  await driver.manage().deleteAllCookies();
  for (const [name, value] of Object.entries(cookies)) {
    if (name.startsWith("ud_")) await driver.manage().addCookie({ name, value, path: "/", httpOnly: true, sameSite: "Lax" });
  }
}
export async function signOutCookies(driver) {
  await driver.manage().deleteAllCookies();
}
/** Calls the backend API directly (not through the browser) as `who`: for set-up and for checking results. */
export async function api(who, route, { method = "GET", body, form } = {}) {
  const account = typeof who === "string" ? accounts[who] : who;
  let access = tokens.get(account.username);
  if (!access) {
    const login = await fetch(`${urls.api}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: account.username, password: PASSWORD }),
    });
    if (!login.ok) throw new Error(`API login failed for ${account.username}: ${login.status}`);
    access = (await login.json()).accessToken;
    tokens.set(account.username, access);
    setTimeout(() => tokens.delete(account.username), 10 * 60 * 1000).unref();
  }
  const response = await fetch(`${urls.api}/${route.replace(/^\//, "")}`, {
    method,
    headers: { Authorization: `Bearer ${access}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: form ?? (body ? JSON.stringify(body) : undefined),
  });
  const data = await response.json().catch(() => null);
  return { status: response.status, ok: response.ok, data };
}
export async function apiOk(who, route, options) {
  const result = await api(who, route, options);
  if (!result.ok) throw new Error(`${options?.method || "GET"} ${route} as ${who}: ${result.status} ${JSON.stringify(result.data)}`);
  return result.data;
}

let counter = 0;
/** A name nobody else is using: the base for records a test creates. */
export const unique = (prefix) => `${prefix} ${Date.now().toString(36)}${(counter++).toString(36)}`;
export const accountsList = accounts;
export const seedIds = async () => (await import("node:fs")).promises.readFile(path.join(paths.artifacts, "seed.json"), "utf8").then(JSON.parse);
