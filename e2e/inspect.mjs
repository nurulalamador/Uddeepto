// Developer helper: shows what a signed-in role sees on a page (text, buttons, links, fields).
//   node inspect.mjs learner /courses
//   node inspect.mjs hirer /job-management --shot       (also saves artifacts/inspect.png)
import { By, bodyText, go, openBrowser, signIn, sleep } from "./lib/browser.mjs";
import { screenshot } from "./lib/browser.mjs";

const [role, rawRoute = "/dashboard", ...flags] = process.argv.slice(2);
// Git Bash rewrites "/courses" into "C:/Program Files/Git/courses"; undo that.
const route = rawRoute.replace(/^[A-Za-z]:\/Program Files\/Git/, "");
const driver = await openBrowser();
try {
  if (role !== "anon") await signIn(driver, role);
  await go(driver, route);
  await sleep(1800);
  console.log("URL:", await driver.getCurrentUrl());
  console.log("---- text ----\n" + (await bodyText(driver)).slice(0, 2500));
  const dump = await driver.executeScript(`
    const vis = (e) => !!(e.offsetWidth || e.offsetHeight || e.getClientRects().length);
    const label = (e) => (e.getAttribute('aria-label') || e.innerText || e.value || e.placeholder || e.name || '').trim().replace(/\\s+/g, ' ').slice(0, 60);
    return {
      buttons: [...document.querySelectorAll('button')].filter(vis).map(label),
      links: [...document.querySelectorAll('a[href]')].filter(vis).map((a) => label(a) + ' -> ' + a.getAttribute('href')),
      fields: [...document.querySelectorAll('input,textarea,select')].filter(vis).map((e) => e.tagName.toLowerCase() + '[' + (e.type || '') + '] name=' + (e.name || '') + ' aria=' + (e.getAttribute('aria-label') || '') + ' ph=' + (e.placeholder || '')),
    };`);
  console.log("---- buttons ----\n" + dump.buttons.join(" | "));
  console.log("---- links ----\n" + dump.links.join("\n"));
  console.log("---- fields ----\n" + dump.fields.join("\n"));
  if (flags.includes("--shot")) await screenshot(driver, "inspect");
} finally {
  await driver.quit();
}
