// Interest icons: the name saved with an interest is any Lucide icon, shown wherever the interest is shown.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { By, apiOk, click, find, go, q, signIn, unique, useBrowser, visible, waitText, xText } from "../lib/browser.mjs";
import { makeUser, slugOf } from "../lib/factory.mjs";
import { modalField, openList, tabButton } from "../lib/admin.mjs";
import { type } from "../lib/browser.mjs";

async function makeInterest(icon) {
  const name = unique("Icon topic");
  await apiOk("admin", "frontend/admin/interest_categories", { method: "POST", body: { name, slug: slugOf(name), icon, submission_kind: "text", is_active: true } });
  return name;
}
const option = (name) => By.xpath(`//dialog[contains(@class,'interest-gate')]//button[contains(@class,'ig-option')][.//span[contains(@class,'ig-option-name')][normalize-space(.)=${q(name)}]]`);

describe("Interest icons", () => {
  const b = useBrowser();
  const gate = async (name) => {
    await signIn(b.driver, await makeUser({ role: "learner", tag: "icons" }));
    await go(b.driver, "/dashboard");
    await visible(b.driver, option(name));
  };

  it("any Lucide icon name is drawn", async () => {
    const name = await makeInterest("rocket");
    await gate(name);
    await visible(b.driver, By.xpath(`//dialog//button[contains(@class,'ig-option')][.//span[normalize-space(.)=${q(name)}]]//*[local-name()='svg'][contains(@class,'lucide-rocket')]`));
  });

  it("a name written as BookOpen or book_open is understood too", async () => {
    const [a, c] = [await makeInterest("BookOpen"), await makeInterest("book_open")];
    await signIn(b.driver, await makeUser({ role: "learner", tag: "icons2" }));
    await go(b.driver, "/dashboard");
    for (const name of [a, c]) await visible(b.driver, By.xpath(`//dialog//button[contains(@class,'ig-option')][.//span[normalize-space(.)=${q(name)}]]//*[local-name()='svg'][contains(@class,'lucide-book-open')]`));
  });

  it("the older names still work: palette and spline-pointer", async () => {
    const [a, c] = [await makeInterest("palette"), await makeInterest("spline-pointer")];
    await signIn(b.driver, await makeUser({ role: "learner", tag: "icons3" }));
    await go(b.driver, "/dashboard");
    await visible(b.driver, By.xpath(`//dialog//button[contains(@class,'ig-option')][.//span[normalize-space(.)=${q(a)}]]//*[local-name()='svg'][contains(@class,'lucide-palette')]`));
    await visible(b.driver, By.xpath(`//dialog//button[contains(@class,'ig-option')][.//span[normalize-space(.)=${q(c)}]]//*[local-name()='svg'][contains(@class,'lucide-spline')]`));
  });

  it("a name that is not an icon shows a star", async () => {
    const name = await makeInterest("definitely-not-an-icon");
    await gate(name);
    await visible(b.driver, By.xpath(`//dialog//button[contains(@class,'ig-option')][.//span[normalize-space(.)=${q(name)}]]//*[local-name()='svg'][contains(@class,'lucide-star')]`));
  });

  it("the admin form previews the icon as it is typed and says when the name is wrong", async () => {
    await openList(b.driver, "/admin?tab=interest_categories");
    await click(b.driver, tabButton("Interests"));
    await click(b.driver, xText("Add interest", { tag: "button" }));
    await visible(b.driver, modalField("icon"));
    await type(b.driver, modalField("icon"), "camera");
    await waitText(b.driver, "Icon found.");
    await visible(b.driver, By.css(".admin-icon-preview svg.lucide-camera"));
    await type(b.driver, modalField("icon"), "no-such-icon");
    await waitText(b.driver, "No icon has this name - a star is shown instead.");
    await visible(b.driver, By.css(".admin-icon-preview.unknown svg.lucide-star"));
  });
});
