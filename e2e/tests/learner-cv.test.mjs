// My CV on the profile, the CV Generator and "Your Current CV" when applying for a job.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { By, api, apiOk, click, exists, find, go, hasText, isShown, q, setValue, signIn, sleep, texts, type, unique, upload, useBrowser, visible, waitGone, waitText, waitUrl, xText } from "../lib/browser.mjs";
import { fixture } from "../lib/fixtures.mjs";
import { applyTo, makeHirer, makeJob, makeLearner } from "../lib/factory.mjs";
import { PASSWORD, urls } from "../lib/config.mjs";

const section = "//section[contains(@class,'pf-section')][.//h2[contains(normalize-space(.),'My CV')]]";
const pdfBlob = (label = "CV") => new Blob([`%PDF-1.4\n% ${label}\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n`], { type: "application/pdf" });
async function putCv(who, { label = "CV", name = "my-cv.pdf", source = "uploaded", extra = {} } = {}) {
  const form = new FormData();
  form.set("file", pdfBlob(label), name);
  form.set("source", source);
  for (const [key, value] of Object.entries(extra)) form.set(key, value);
  return api(who, "frontend/cv", { method: "PUT", form });
}
async function download(who, route) {
  const login = await fetch(`${urls.api}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ identifier: (who.username), password: PASSWORD }) });
  const { accessToken } = await login.json();
  return fetch(`${urls.api}/${route}`, { headers: { Authorization: `Bearer ${accessToken}` } });
}

describe("Learner · My CV on the profile", () => {
  const b = useBrowser();
  const open = async (who) => {
    await signIn(b.driver, who);
    await go(b.driver, "/profile");
    await visible(b.driver, By.xpath(section));
  };

  it("without a CV the section offers Upload CV and Generate CV", async () => {
    const me = await makeLearner("nocv");
    await open(me);
    await waitText(b.driver, "You have not added a CV yet.");
    await visible(b.driver, By.xpath(`${section}//button[normalize-space(.)='Upload CV']`));
    await visible(b.driver, By.xpath(`${section}//a[normalize-space(.)='Generate CV']`));
    assert.equal(await exists(b.driver, By.xpath(`${section}//a[contains(normalize-space(.),'Download CV')]`)), false);
    assert.equal(await exists(b.driver, By.xpath(`${section}//button[contains(normalize-space(.),'Change CV')]`)), false);
  });

  it("'Generate CV' opens the CV Generator", async () => {
    const me = await makeLearner("gotogen");
    await open(me);
    await click(b.driver, By.xpath(`${section}//a[normalize-space(.)='Generate CV']`));
    await waitUrl(b.driver, /^\/cv/);
    await waitText(b.driver, "CV Generator");
  });

  it("'Upload CV' asks for a PDF and saves it", async () => {
    const me = await makeLearner("uploader");
    await open(me);
    await click(b.driver, By.xpath(`${section}//button[normalize-space(.)='Upload CV']`));
    await waitText(b.driver, "Upload your CV");
    assert.equal(await (await find(b.driver, xText("Save CV", { tag: "button" }))).isEnabled(), false);
    await upload(b.driver, By.css(".modal .dropzone input[type=file]"), fixture("resume.pdf"));
    await click(b.driver, xText("Save CV", { tag: "button" }));
    await waitText(b.driver, "Your CV was uploaded.");
    await waitText(b.driver, "resume.pdf");
    await waitText(b.driver, "Uploaded by you");
  });

  it("with a CV the section shows Download CV and, below it, Change CV", async () => {
    const me = await makeLearner("hascv");
    assert.equal((await putCv(me, { name: "mine.pdf" })).status, 200);
    await open(me);
    await waitText(b.driver, "mine.pdf");
    const download = await visible(b.driver, By.xpath(`${section}//a[contains(normalize-space(.),'Download CV')]`));
    assert.match(await download.getAttribute("href"), /\/api\/backend\/frontend\/cv\/file\?download=1/);
    await visible(b.driver, By.xpath(`${section}//button[contains(normalize-space(.),'Change CV')]`));
    assert.equal(await exists(b.driver, By.xpath(`${section}//button[normalize-space(.)='Upload CV']`)), false);
    assert.equal(await exists(b.driver, By.xpath(`${section}//a[normalize-space(.)='Generate CV']`)), false);
    const y = (xpath) => b.driver.executeScript("return document.evaluate(arguments[0], document, null, 9, null).singleNodeValue.getBoundingClientRect().top", xpath);
    assert.ok((await y(`${section}//button[contains(normalize-space(.),'Change CV')]`)) > (await y(`${section}//a[contains(normalize-space(.),'Download CV')]`)));
  });

  it("the Download link returns the saved PDF", async () => {
    const me = await makeLearner("getfile");
    await putCv(me, { label: "my-own-bytes" });
    const response = await download(me, "frontend/cv/file?download=1");
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-disposition"), /attachment; filename\*=UTF-8''my-cv\.pdf/);
    assert.match(await response.text(), /my-own-bytes/);
  });

  it("'Change CV' offers a new upload and the generator", async () => {
    const me = await makeLearner("changer");
    await putCv(me);
    await open(me);
    await click(b.driver, By.xpath(`${section}//button[contains(normalize-space(.),'Change CV')]`));
    await visible(b.driver, By.xpath(`${section}//button[contains(normalize-space(.),'Upload a new CV')]`));
    await visible(b.driver, By.xpath(`${section}//a[contains(normalize-space(.),'Generate a new CV')]`));
  });

  it("uploading a new CV replaces the old one", async () => {
    const me = await makeLearner("replacer");
    await putCv(me, { name: "old-cv.pdf", label: "old" });
    await open(me);
    await click(b.driver, By.xpath(`${section}//button[contains(normalize-space(.),'Change CV')]`));
    await click(b.driver, By.xpath(`${section}//button[contains(normalize-space(.),'Upload a new CV')]`));
    await upload(b.driver, By.css(".modal .dropzone input[type=file]"), fixture("resume.pdf"));
    await click(b.driver, xText("Save CV", { tag: "button" }));
    await waitText(b.driver, "Your CV was uploaded.");
    await waitText(b.driver, "resume.pdf");
    assert.equal(await hasText(b.driver, "old-cv.pdf"), false);
  });

  it("a CV can be removed after confirming", async () => {
    const me = await makeLearner("remover");
    await putCv(me);
    await open(me);
    await click(b.driver, By.xpath(`${section}//button[contains(normalize-space(.),'Change CV')]`));
    await b.driver.executeScript("window.confirm = () => true");
    await click(b.driver, By.xpath(`${section}//button[contains(normalize-space(.),'Remove CV')]`));
    await waitText(b.driver, "Your CV was removed.");
    await visible(b.driver, By.xpath(`${section}//button[normalize-space(.)='Upload CV']`));
    assert.equal((await api(me, "frontend/cv")).data.has_cv, false);
  });

  it("a generated CV says it was made in the generator, with its template", async () => {
    const me = await makeLearner("generated");
    await putCv(me, { source: "generated", name: "gen.pdf", extra: { template: "modern", data: JSON.stringify({ personal: { name: "X" } }) } });
    await open(me);
    await waitText(b.driver, "Made in the CV Generator · Modern template");
    await click(b.driver, By.xpath(`${section}//button[contains(normalize-space(.),'Change CV')]`));
    await visible(b.driver, By.xpath(`${section}//a[contains(normalize-space(.),'Edit in CV Generator')]`));
  });

  it("other people do not see anyone's My CV section", async () => {
    const me = await makeLearner("private");
    await putCv(me);
    await signIn(b.driver, "learner");
    await go(b.driver, `/profile/${me.id}`);
    await waitText(b.driver, me.name);
    assert.equal(await exists(b.driver, By.xpath(section)), false);
  });

  it("hirers have no My CV section", async () => {
    const hirer = await makeHirer("nocvhirer");
    await signIn(b.driver, hirer);
    await go(b.driver, "/profile");
    await waitText(b.driver, hirer.name);
    assert.equal(await exists(b.driver, By.xpath(section)), false);
  });
});

describe("Learner · CV rules on the server", () => {
  it("a file that is not a PDF is refused, whatever it is called", async () => {
    const me = await makeLearner("fakepdf");
    const form = new FormData();
    form.set("file", new Blob(["just some text"], { type: "application/pdf" }), "cv.pdf");
    form.set("source", "uploaded");
    assert.equal((await api(me, "frontend/cv", { method: "PUT", form })).status, 422);
  });

  it("a request without a file is refused", async () => {
    const me = await makeLearner("nofile");
    const form = new FormData();
    form.set("source", "uploaded");
    assert.equal((await api(me, "frontend/cv", { method: "PUT", form })).status, 422);
  });

  it("a generated CV must say which template it used and keep its details", async () => {
    const me = await makeLearner("gendetails");
    assert.equal((await putCv(me, { source: "generated", extra: { data: JSON.stringify({ a: 1 }) } })).status, 422);
    assert.equal((await putCv(me, { source: "generated", extra: { template: "classic" } })).status, 422);
    assert.equal((await putCv(me, { source: "generated", extra: { template: "nonsense", data: JSON.stringify({ a: 1 }) } })).status, 422);
    assert.equal((await putCv(me, { source: "generated", extra: { template: "classic", data: "not json" } })).status, 422);
  });

  it("a CV bigger than 10 MB is refused", async () => {
    const me = await makeLearner("bigcv");
    const form = new FormData();
    form.set("file", new Blob(["%PDF-1.4\n", new Uint8Array(10 * 1024 * 1024 + 10)], { type: "application/pdf" }), "big.pdf");
    form.set("source", "uploaded");
    const result = await api(me, "frontend/cv", { method: "PUT", form });
    assert.ok([413, 422].includes(result.status), String(result.status));
  });

  it("each person has one CV and only they can read it", async () => {
    const [one, two] = [await makeLearner("ownerone"), await makeLearner("ownertwo")];
    await putCv(one, { label: "one-secret" });
    await putCv(two, { label: "two-secret" });
    assert.match(await (await download(one, "frontend/cv/file")).text(), /one-secret/);
    assert.match(await (await download(two, "frontend/cv/file")).text(), /two-secret/);
  });

  it("hirers and admins cannot use CVs", async () => {
    for (const who of ["hirer", "admin"]) {
      assert.equal((await api(who, "frontend/cv")).status, 403, who);
      assert.equal((await putCv(who)).status, 403, who);
    }
  });

  it("a person without a CV gets has_cv false and no file", async () => {
    const me = await makeLearner("emptycv");
    assert.deepEqual((await api(me, "frontend/cv")).data, { has_cv: false });
    assert.equal((await api(me, "frontend/cv/file")).status, 404);
  });
});

describe("Learner · CV Generator", () => {
  const b = useBrowser();
  const label = (text) => By.xpath(`//label[contains(@class,'cvg-field')][./span[normalize-space(.)=${q(text)}]]//*[self::input or self::textarea]`);
  const saveBtn = xText("Save as my CV", { tag: "button" });
  async function learnerWithProfile(tag) {
    const me = await makeLearner(tag, "web", "data");
    await apiOk(me, "frontend/profile/experience", { method: "POST", body: { title: "Frontend Developer", workplace: "Acme Ltd", category_id: null, start_date: "2020-03", end_date: "2022-06", description: "Built dashboards" } });
    await apiOk(me, "frontend/profile/education", { method: "POST", body: { institution: "Dhaka University", degree: "BSc", field_of_study: "Computer Science", start_date: "2016-01", end_date: "2020-01" } });
    return me;
  }
  async function openGenerator(me) {
    await signIn(b.driver, me);
    await go(b.driver, "/cv");
    await waitText(b.driver, "CV Generator");
    await visible(b.driver, By.css(".cvg-template"));
  }
  const details = () => click(b.driver, By.xpath("//div[@role='tablist']//button[normalize-space(.)='Details']"));
  const openGroup = async (title) => {
    const group = By.xpath(`//details[contains(@class,'cvg-group')][.//strong[normalize-space(.)='${title}']]`);
    if (!(await (await find(b.driver, group)).getAttribute("open"))) await click(b.driver, By.xpath(`//details[contains(@class,'cvg-group')]/summary[.//strong[normalize-space(.)='${title}']]`));
  };
  const saved = async (me) => (await api(me, "frontend/cv")).data;

  it("offers five templates and six accent colours", async () => {
    await openGenerator(await makeLearner("tpl"));
    assert.deepEqual((await texts(b.driver, By.css(".cvg-template strong"))), ["Classic", "Modern", "Minimal", "Executive", "Creative"]);
    assert.equal((await b.driver.findElements(By.css(".cvg-swatches button"))).length, 6);
  });

  it("starts with Classic selected, and a click picks another", async () => {
    await openGenerator(await makeLearner("pick"));
    assert.equal(await (await find(b.driver, By.xpath("//button[@role='radio'][.//strong[normalize-space(.)='Classic']]"))).getAttribute("aria-checked"), "true");
    await click(b.driver, By.xpath("//button[@role='radio'][.//strong[normalize-space(.)='Executive']]"));
    assert.equal(await (await find(b.driver, By.xpath("//button[@role='radio'][.//strong[normalize-space(.)='Executive']]"))).getAttribute("aria-checked"), "true");
    assert.equal(await (await find(b.driver, By.xpath("//button[@role='radio'][.//strong[normalize-space(.)='Classic']]"))).getAttribute("aria-checked"), "false");
  });

  it("fills the details from the profile", async () => {
    const me = await learnerWithProfile("prefill");
    await openGenerator(me);
    await details();
    assert.equal(await (await find(b.driver, label("Full name"))).getAttribute("value"), me.name);
    assert.equal(await (await find(b.driver, label("Email"))).getAttribute("value"), me.email);
    assert.equal(await (await find(b.driver, label("Job title"))).getAttribute("value"), "Frontend Developer");
    assert.equal(await (await find(b.driver, label("Company or organisation"))).getAttribute("value"), "Acme Ltd");
    assert.equal(await (await find(b.driver, label("School or university"))).getAttribute("value"), "Dhaka University");
    await waitText(b.driver, "Web Development");
    await waitText(b.driver, "Data Science");
  });

  it("shows a live preview of the CV", async () => {
    const me = await learnerWithProfile("preview");
    await openGenerator(me);
    await visible(b.driver, By.css(".cvg-frame iframe"));
    assert.match(await (await find(b.driver, By.css(".cvg-frame iframe"))).getAttribute("src"), /^blob:/);
  });

  it("without a name there is nothing to preview, save or download", async () => {
    const me = await makeLearner("noname");
    await openGenerator(me);
    await details();
    await type(b.driver, label("Full name"), "");
    await waitText(b.driver, "Add your name to see your CV here.");
    assert.equal(await (await find(b.driver, saveBtn)).isEnabled(), false);
    assert.equal(await (await find(b.driver, xText("Download PDF", { tag: "button" }))).isEnabled(), false);
  });

  it("personal details, summary and a new experience can be edited", async () => {
    const me = await learnerWithProfile("edit");
    await openGenerator(me);
    await details();
    await type(b.driver, label("Professional title"), "Senior engineer");
    await type(b.driver, label("Phone"), "01700000000");
    await type(b.driver, label("Professional summary"), "I build things that last.");
    await click(b.driver, By.xpath("//details[.//strong[normalize-space(.)='Experience']]//button[contains(normalize-space(.),'Add experience')]"));
    await b.driver.wait(async () => (await b.driver.findElements(label("Job title"))).length === 2, 5000);
    const titles = await b.driver.findElements(label("Job title"));
    await titles[1].sendKeys("Tech lead");
    await click(b.driver, saveBtn);
    await waitText(b.driver, "CV saved.");
    const cv = await saved(me);
    assert.equal(cv.data.personal.headline, "Senior engineer");
    assert.equal(cv.data.personal.phone, "01700000000");
    assert.equal(cv.data.summary, "I build things that last.");
    assert.equal(cv.data.experience.length, 2);
    assert.equal(cv.data.experience[1].title, "Tech lead");
  });

  it("items can be moved and removed", async () => {
    const me = await learnerWithProfile("reorder");
    await apiOk(me, "frontend/profile/experience", { method: "POST", body: { title: "Intern", workplace: "Startup", category_id: null, start_date: "2019-01", end_date: "2019-06" } });
    await openGenerator(me);
    await details();
    const first = async () => (await (await find(b.driver, label("Job title"))).getAttribute("value"));
    const before = await first();
    await click(b.driver, By.css("button[aria-label='Move experience 1 down']"));
    await b.driver.wait(async () => (await first()) !== before, 5000);
    await click(b.driver, By.css("button[aria-label='Remove experience 1']"));
    await b.driver.wait(async () => (await b.driver.findElements(label("Job title"))).length === 1, 5000);
  });

  it("skills and languages are added with Enter and removed with the cross", async () => {
    const me = await makeLearner("tags");
    await openGenerator(me);
    await details();
    await type(b.driver, By.css("input[aria-label='Add a skill']"), "Teamwork, Public speaking", { enter: true });
    await visible(b.driver, By.xpath("//span[contains(@class,'cvg-chip')][contains(normalize-space(.),'Teamwork')]"));
    await visible(b.driver, By.xpath("//span[contains(@class,'cvg-chip')][contains(normalize-space(.),'Public speaking')]"));
    await click(b.driver, By.css("button[aria-label='Remove Teamwork']"));
    await b.driver.wait(async () => !(await exists(b.driver, By.css("button[aria-label='Remove Teamwork']"))), 5000);
    await openGroup("Languages");
    await type(b.driver, By.css("input[aria-label='Add a language']"), "Bangla (native)", { enter: true });
    await visible(b.driver, By.xpath("//span[contains(@class,'cvg-chip')][contains(normalize-space(.),'Bangla')]"));
  });

  it("projects and certifications can be added", async () => {
    const me = await makeLearner("extras");
    await openGenerator(me);
    await details();
    await openGroup("Projects");
    await click(b.driver, By.xpath("//details[.//strong[normalize-space(.)='Projects']]//button[contains(normalize-space(.),'Add project')]"));
    await type(b.driver, label("Project name"), "Portfolio site");
    await openGroup("Certifications");
    await click(b.driver, By.xpath("//details[.//strong[normalize-space(.)='Certifications']]//button[contains(normalize-space(.),'Add certification')]"));
    await type(b.driver, label("Certificate"), "AWS Cloud Practitioner");
    await click(b.driver, saveBtn);
    await waitText(b.driver, "CV saved.");
    const cv = await saved(me);
    assert.equal(cv.data.projects[0].name, "Portfolio site");
    assert.equal(cv.data.certifications[0].title, "AWS Cloud Practitioner");
  });

  it("'Save as my CV' stores a real PDF as the current CV and it shows on the profile", async () => {
    const me = await learnerWithProfile("savecv");
    await openGenerator(me);
    await click(b.driver, saveBtn);
    await waitText(b.driver, "CV saved.");
    const cv = await saved(me);
    assert.equal(cv.has_cv, true);
    assert.equal(cv.source, "generated");
    assert.equal(cv.template, "classic");
    assert.match(cv.file_name, /-CV\.pdf$/);
    const file = await download(me, "frontend/cv/file");
    const bytes = Buffer.from(await file.arrayBuffer());
    assert.equal(bytes.subarray(0, 5).toString("latin1"), "%PDF-");
    assert.ok(bytes.length > 1500, `the PDF is only ${bytes.length} bytes`);
    await click(b.driver, xText("View on your profile", { tag: "a" }));
    await waitUrl(b.driver, /^\/profile/);
    await waitText(b.driver, "Made in the CV Generator · Classic template");
  });

  for (const [id, name] of [["classic", "Classic"], ["modern", "Modern"], ["minimal", "Minimal"], ["executive", "Executive"], ["creative", "Creative"]])
    it(`the ${name} template makes a valid PDF`, async () => {
      const me = await learnerWithProfile(`tpl${id}`);
      await openGenerator(me);
      await click(b.driver, By.xpath(`//button[@role='radio'][.//strong[normalize-space(.)='${name}']]`));
      await click(b.driver, By.css("button[aria-label='Crimson']"));
      await click(b.driver, saveBtn);
      await waitText(b.driver, "CV saved.");
      const cv = await saved(me);
      assert.equal(cv.template, id);
      assert.equal(cv.data.accent, "#be123c");
      const bytes = Buffer.from(await (await download(me, "frontend/cv/file")).arrayBuffer());
      assert.equal(bytes.subarray(0, 5).toString("latin1"), "%PDF-");
      assert.ok(bytes.length > 1500);
    });

  it("opening the generator again restores the saved CV, not the profile", async () => {
    const me = await learnerWithProfile("restore");
    await openGenerator(me);
    await details();
    await type(b.driver, label("Professional title"), "Restored title");
    await click(b.driver, By.xpath("//div[@role='tablist']//button[normalize-space(.)='Template']"));
    await click(b.driver, By.xpath("//button[@role='radio'][.//strong[normalize-space(.)='Creative']]"));
    await click(b.driver, saveBtn);
    await waitText(b.driver, "CV saved.");
    await b.driver.executeScript("localStorage.clear()");
    await go(b.driver, "/cv");
    await visible(b.driver, By.css(".cvg-template"));
    assert.equal(await (await find(b.driver, By.xpath("//button[@role='radio'][.//strong[normalize-space(.)='Creative']]"))).getAttribute("aria-checked"), "true");
    await details();
    assert.equal(await (await find(b.driver, label("Professional title"))).getAttribute("value"), "Restored title");
  });

  it("an unsaved edit survives a reload as a draft, and 'Reset from profile' goes back", async () => {
    const me = await learnerWithProfile("draft");
    await openGenerator(me);
    await details();
    await type(b.driver, label("Professional title"), "Draft title");
    await sleep(300);
    await b.driver.navigate().refresh();
    await visible(b.driver, By.css(".cvg-template"));
    await details();
    assert.equal(await (await find(b.driver, label("Professional title"))).getAttribute("value"), "Draft title");
    await b.driver.executeScript("window.confirm = () => true");
    await click(b.driver, xText("Reset from profile", { tag: "button" }));
    await b.driver.wait(async () => (await (await find(b.driver, label("Professional title"))).getAttribute("value")) !== "Draft title", 5000);
  });

  it("the top bar names the page and the page has no big heading of its own", async () => {
    await openGenerator(await makeLearner("cvheader"));
    assert.equal(await (await find(b.driver, By.css(".post-detail-topbar-title strong"))).getText(), "CV Generator");
    assert.equal(await exists(b.driver, By.css(".cvg h1, .cvg .eyebrow")), false);
  });

  it("'Back to profile' returns to the profile", async () => {
    await openGenerator(await makeLearner("backlink"));
    await click(b.driver, By.css("a[aria-label='Back to profile']"));
    await waitUrl(b.driver, /^\/profile/);
  });

  it("the generator is for learners only", async () => {
    for (const who of ["hirer", "admin"]) {
      await signIn(b.driver, who);
      await go(b.driver, "/cv");
      await waitText(b.driver, "Access restricted");
    }
  });

  it("the generator is not a menu item", async () => {
    await signIn(b.driver, "learner");
    await go(b.driver, "/dashboard");
    await visible(b.driver, By.css(".sidebar nav a"));
    assert.equal(await exists(b.driver, By.xpath("//aside//nav//a[contains(normalize-space(.),'CV Generator')]")), false);
  });
});

describe("Learner · Applying with a CV", () => {
  const b = useBrowser();
  const openJob = async (me, job) => {
    await signIn(b.driver, me);
    await go(b.driver, `/jobs/${job.id}`);
    await waitText(b.driver, job.title);
    await waitText(b.driver, "Apply for this job");
  };
  const cover = (text) => type(b.driver, By.css("textarea[name=cover_letter]"), text);
  const send = xText("Send application", { tag: "button" });

  it("without a saved CV only the upload is offered", async () => {
    const me = await makeLearner("applynocv");
    const job = await makeJob({ title: unique("No CV job") });
    await openJob(me, job);
    await waitText(b.driver, "CV (PDF)");
    assert.equal(await exists(b.driver, By.css(".cv-choice")), false);
    await find(b.driver, By.css(".dropzone input[type=file]"));
    await cover("Please consider me.");
    assert.equal(await (await find(b.driver, send)).isEnabled(), false);
  });

  it("with a saved CV 'Your Current CV' is the default and needs no file", async () => {
    const me = await makeLearner("applycv");
    await putCv(me, { name: "current.pdf", label: "current-bytes" });
    const job = await makeJob({ title: unique("Current CV job") });
    await openJob(me, job);
    await visible(b.driver, By.css(".cv-choice"));
    await waitText(b.driver, "Your Current CV");
    await waitText(b.driver, "current.pdf");
    assert.equal(await (await find(b.driver, By.css("input[name=cv_choice][value=current]"))).isSelected(), true);
    assert.equal(await exists(b.driver, By.css(".dropzone")), false);
    await cover("Using my saved CV.");
    assert.equal(await (await find(b.driver, send)).isEnabled(), true);
    await click(b.driver, send);
    await waitText(b.driver, "Your application");
    const response = await download({ username: "hirer1" }, `frontend/jobs/${job.id}/applications/${me.id}/resume`);
    assert.equal(response.status, 200);
    assert.match(await response.text(), /current-bytes/);
  });

  it("choosing 'Upload CV' shows the file box and needs a file", async () => {
    const me = await makeLearner("applyupload");
    await putCv(me, { name: "saved.pdf", label: "saved-bytes" });
    const job = await makeJob({ title: unique("Upload instead job") });
    await openJob(me, job);
    await click(b.driver, By.css("input[name=cv_choice][value=upload]"));
    await find(b.driver, By.css(".dropzone input[type=file]"));
    await cover("Sending a different CV.");
    assert.equal(await (await find(b.driver, send)).isEnabled(), false);
    await upload(b.driver, By.css(".dropzone input[type=file]"), fixture("resume.pdf"));
    assert.equal(await (await find(b.driver, send)).isEnabled(), true);
    await click(b.driver, send);
    await waitText(b.driver, "Your application");
    const response = await download({ username: "hirer1" }, `frontend/jobs/${job.id}/applications/${me.id}/resume`);
    assert.equal(response.status, 200);
    assert.doesNotMatch(await response.text(), /saved-bytes/);
  });

  it("the 'View' link opens the current CV", async () => {
    const me = await makeLearner("applyview");
    await putCv(me, { name: "viewable.pdf" });
    const job = await makeJob({ title: unique("View CV job") });
    await openJob(me, job);
    const view = await visible(b.driver, By.xpath("//div[contains(@class,'cv-choice')]//a[normalize-space(.)='View']"));
    assert.match(await view.getAttribute("href"), /\/api\/backend\/frontend\/cv\/file$/);
  });

  it("an application keeps its copy when the CV changes afterwards", async () => {
    const me = await makeLearner("keepcopy");
    await putCv(me, { label: "first-version" });
    const job = await makeJob({ title: unique("Copy job") });
    const form = new FormData();
    form.set("cover_letter", "Hello");
    form.set("use_current_cv", "true");
    await apiOk(me, `jobs/${job.id}/apply`, { method: "POST", form });
    await putCv(me, { label: "second-version" });
    const response = await download({ username: "hirer1" }, `frontend/jobs/${job.id}/applications/${me.id}/resume`);
    assert.match(await response.text(), /first-version/);
  });

  it("asking for the current CV when there is none is refused", async () => {
    const me = await makeLearner("applyempty");
    const job = await makeJob({ title: unique("Empty CV job") });
    const form = new FormData();
    form.set("cover_letter", "Hello");
    form.set("use_current_cv", "true");
    const result = await api(me, `jobs/${job.id}/apply`, { method: "POST", form });
    assert.equal(result.status, 409);
  });

  it("the hirer sees the resume of an application that used the current CV", async () => {
    const me = await makeLearner("hirerseescv");
    await putCv(me, { label: "seen-by-hirer" });
    const hirer = await makeHirer("cvowner");
    const job = await makeJob({ owner: hirer, title: unique("Hirer sees CV") });
    const form = new FormData();
    form.set("cover_letter", "Hello");
    form.set("use_current_cv", "true");
    await apiOk(me, `jobs/${job.id}/apply`, { method: "POST", form });
    const applicants = await apiOk(hirer, `frontend/jobs/${job.id}/applications`);
    assert.equal(applicants[0].has_resume, true);
  });
});
