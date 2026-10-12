// Shared helpers for the admin "Management" page (/admin, /courses, /contests, /webinars, /jobs).
import { By, click, go, q, setValue, signIn, sleep, texts, type, visible, waitText, xText } from "./browser.mjs";

export const search = By.css(".admin-filters input[placeholder^='Search']");
export const rows = By.css(".admin-table tbody tr");
export const row = (text) => By.xpath(`//table[contains(@class,'admin-table')]//tbody/tr[.//*[contains(normalize-space(.), ${q(text)})]]`);
export const rowAction = (text, label) => By.xpath(`//table[contains(@class,'admin-table')]//tbody/tr[.//*[contains(normalize-space(.), ${q(text)})]]//*[@aria-label=${q(label)}]`);
export const rowCheck = (name) => By.css(`input[type=checkbox][aria-label=${JSON.stringify(`Select ${name}`)}]`);
export const filter = (label) => By.xpath(`//label[contains(@class,'admin-filter-select')][./span[normalize-space(.)=${q(label)}]]//select`);
export const modalField = (name) => By.css(`.modal [name=${name}]`);
export const saveButton = (label) => By.xpath(`//*[contains(@class,'modal')]//button[contains(normalize-space(.),${q(label)})]`);
export const tabButton = (title) => By.xpath(`//nav[@aria-label='Manage records']//button[normalize-space(.)=${q(title)}]`);

/** Opens an admin list as the admin, waiting until its search box is there. */
export async function openList(driver, route = "/admin", who = "admin") {
  await signIn(driver, who);
  await go(driver, route);
  await visible(driver, search);
}

/** Types in the search box and waits for the debounced reload to settle, then for the row. */
export async function findRow(driver, text) {
  await type(driver, search, text);
  await sleep(700);
  await visible(driver, row(text));
}

/** The text of one cell of the first row (1 = checkbox column). */
export async function cells(driver, column) {
  return texts(driver, By.css(`.admin-table tbody tr td:nth-child(${column})`));
}

/** Picks an option in a native <select> inside the open modal. */
export const choose = (driver, name, value) => setValue(driver, modalField(name), value);

/** Tick the interest chip with this name in the interest picker. */
export async function addInterest(driver, name) {
  await click(driver, By.xpath(`//fieldset[contains(@class,'interest-picker')]//button[contains(@class,'available')][.//span[normalize-space(.)=${q(name)}]]`));
}

/** Picks an instructor in the course form's search-as-you-type field. */
export async function pickInstructor(driver, name) {
  const input = By.css("#course-instructor-search");
  await type(driver, input, name);
  await click(driver, By.xpath(`//div[@id='course-instructor-options']//button[@role='option'][.//strong[normalize-space(.)=${q(name)}]]`));
}

/** Adds a speaker in the webinar form. */
export async function addSpeaker(driver, name) {
  const input = By.css("#webinar-speaker-search");
  await type(driver, input, name);
  await click(driver, By.xpath(`//div[@role='listbox']//button[@role='option'][.//strong[normalize-space(.)=${q(name)}]]`));
}

/** datetime-local value (local time) for a moment `days` from now. */
export function localDateTime(days = 0, hours = 0) {
  const date = new Date(Date.now() + days * 864e5 + hours * 36e5);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

export { waitText, xText };
