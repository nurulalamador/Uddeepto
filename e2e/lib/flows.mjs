// Reusable user journeys (the things many tests do as a first step).
import { By, bodyText, click, clickButton, exists, find, go, isShown, sleep, texts, type, waitText, waitUrl, xText } from "./browser.mjs";
import { PASSWORD, accounts } from "./config.mjs";

/** Fills in and submits the login form like a person would. */
export async function loginViaForm(driver, identifier, password = PASSWORD) {
  await go(driver, "/login");
  await type(driver, By.css("input[name=identifier]"), identifier);
  await type(driver, By.css("input[name=password]"), password);
  await clickButton(driver, "Sign in", { exact: false });
}
export const loginAs = (driver, who) => loginViaForm(driver, (typeof who === "string" ? accounts[who] : who).username);

export async function openProfileMenu(driver) {
  await click(driver, By.css("[aria-label='Open profile menu']"));
  await find(driver, By.css(".sidebar .floating-menu"));
}
export async function logout(driver) {
  await openProfileMenu(driver);
  await click(driver, xText("Sign out", { tag: "button" }));
  await waitUrl(driver, /^\/login/);
}

/** Sidebar link labels, in order. */
export async function sidebarItems(driver) {
  await find(driver, By.css(".sidebar nav a"));
  const items = await texts(driver, By.css(".sidebar nav a"));
  // A nav item may end with a notification count; keep only the label.
  return items.map((text) => text.replace(/\s*\d+\+?$/, "").trim());
}
export async function sidebarCaptions(driver) {
  return texts(driver, By.css(".sidebar .nav-caption"));
}
export async function goSidebar(driver, label) {
  await click(driver, By.xpath(`//aside[contains(@class,'sidebar')]//nav//a[contains(normalize-space(.), "${label}")]`));
}
export async function pageTitle(driver) {
  return (await find(driver, By.css(".topbar .title"))).getText();
}
/** True when the workspace shell (sidebar + topbar) has rendered for a signed-in user. */
export async function inWorkspace(driver) {
  return isShown(driver, By.css(".sidebar")) && exists(driver, By.css(".topbar"));
}
export async function waitWorkspace(driver) {
  await find(driver, By.css(".sidebar .profile"));
}
export { bodyText, sleep, waitText };
