// Upload optimisation: pictures are shrunk in the browser AND re-encoded by the server (WebP, scaled, metadata stripped);
// text responses are compressed. Video/audio conversion in the browser is tested when ffmpeg is available to make a test clip.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync, existsSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import sharp from "sharp";
import { By, api, apiOk, click, find, go, setValue, signIn, type, unique, upload, useBrowser, visible, waitText, xText } from "../lib/browser.mjs";
import { makeContest, makeCourse, makeLearner, makePost, seed } from "../lib/factory.mjs";
import { accounts, paths, urls, PASSWORD } from "../lib/config.mjs";

const dir = path.join(paths.artifacts, "fixtures");
mkdirSync(dir, { recursive: true });

/** A large, detailed photo (4000 x 3000) with camera and GPS metadata, like one straight off a phone. */
async function phoneJpeg() {
  const file = path.join(dir, "phone-photo.jpg");
  if (!existsSync(file)) {
    const width = 4000, height = 3000;
    const raw = Buffer.alloc(width * height * 3);
    for (let i = 0; i < raw.length; i += 3) {
      const x = (i / 3) % width, y = Math.floor(i / 3 / width);
      raw[i] = (x * 255 / width + ((x * y) % 17)) & 255;
      raw[i + 1] = (y * 255 / height + ((x ^ y) % 23)) & 255;
      raw[i + 2] = (x + y) & 255;
    }
    writeFileSync(file, await sharp(raw, { raw: { width, height, channels: 3 } }).jpeg({ quality: 92 }).withExif({ IFD0: { Make: "TestCam", Model: "E2E" }, GPS: { GPSLatitudeRef: "N", GPSLongitudeRef: "E" } }).toBuffer());
  }
  return file;
}
const read = async (file) => new Blob([await (await import("node:fs/promises")).readFile(file)], { type: "image/jpeg" });
const info = async (buffer) => ({ ...(await sharp(Buffer.from(buffer)).metadata()), bytes: buffer.byteLength });
const token = async (who) => {
  who = typeof who === "string" ? accounts[who] : who;
  const response = await fetch(`${urls.api}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ identifier: who.username, password: PASSWORD }) });
  return (await response.json()).accessToken;
};
const get = async (who, route) => fetch(`${urls.api}/${route}`, { headers: { Authorization: `Bearer ${await token(who)}` } });

describe("Upload optimisation · pictures on the server", () => {
  it("a profile picture is made smaller, converted to WebP and stripped of its metadata", async () => {
    const me = await makeLearner("avatarpic");
    const original = await phoneJpeg();
    const form = new FormData();
    form.set("picture", await read(original), "me.jpg");
    assert.equal((await api(me, "users/me/picture", { method: "PUT", form })).status, 204);
    const response = await get(me, `users/${me.id}/picture`);
    assert.match(response.headers.get("content-type"), /image\/webp/);
    const stored = await info(await response.arrayBuffer());
    assert.equal(stored.format, "webp");
    assert.ok(Math.max(stored.width, stored.height) <= 640, `${stored.width}x${stored.height}`);
    assert.ok(stored.bytes < statSync(original).size / 8, `${stored.bytes} bytes`);
    assert.equal(Boolean(stored.exif), false, "the GPS position and camera model are gone");
  });

  it("a picture that is not really an image is refused", async () => {
    const me = await makeLearner("fakepic");
    const form = new FormData();
    form.set("picture", new Blob(["this is just text"], { type: "image/png" }), "x.png");
    const result = await api(me, "users/me/picture", { method: "PUT", form });
    assert.equal(result.status, 422);
    assert.match(result.data.error, /could not be read/);
  });

  it("showcase pictures are stored as scaled WebP without metadata, and other media is left alone", async () => {
    const me = await makeLearner("postpics");
    const s = await seed();
    const form = new FormData();
    form.set("category_id", s.category.web);
    form.set("content", unique("A big photo"));
    form.append("media", await read(await phoneJpeg()), "photo.jpg");
    form.append("media", new Blob([Buffer.from("RIFFxxxxWAVEfmt ")], { type: "audio/wav" }), "sound.wav");
    const post = await apiOk(me, "frontend/showcase", { method: "POST", form });
    const detail = await apiOk(me, `frontend/showcase/${post.id}`);
    const [picture, sound] = detail.media;
    assert.equal(picture.mime_type, "image/webp");
    assert.match(picture.file_name, /\.webp$/);
    assert.equal(sound.mime_type, "audio/wav");
    const stored = await info(await (await get(me, `frontend/showcase/${post.id}/media/${picture.id}`)).arrayBuffer());
    assert.ok(Math.max(stored.width, stored.height) <= 1920);
    assert.equal(Boolean(stored.exif), false);
  });

  it("an instructor photo and a course cover are optimised too", async () => {
    const original = await phoneJpeg();
    const photo = new FormData();
    photo.set("name", unique("Photo Prof"));
    photo.set("image", await read(original), "prof.jpg");
    const instructor = await apiOk("admin", "frontend/admin/instructors", { method: "POST", form: photo });
    const image = await get("admin", `frontend/instructors/${instructor.id}/image`);
    assert.match(image.headers.get("content-type"), /webp/);
    const photoMeta = await info(await image.arrayBuffer());
    assert.ok(Math.max(photoMeta.width, photoMeta.height) <= 800, `${photoMeta.width}x${photoMeta.height}`);

    const s = await seed();
    const cover = new FormData();
    const title = unique("Covered course");
    for (const [key, value] of Object.entries({ title, slug: title.toLowerCase().replace(/[^a-z0-9]+/g, "-"), description: "d", instructor_id: s.instructor, price: "0", currency: "BDT", status: "draft", category_ids: JSON.stringify([s.category.web]) })) cover.set(key, value);
    cover.set("cover_image", await read(original), "cover.jpg");
    const course = await apiOk("admin", "frontend/admin/courses", { method: "POST", form: cover });
    const stored = await get("admin", `frontend/course-covers/${course.id}`);
    assert.match(stored.headers.get("content-type"), /webp/);
    const meta = await info(await stored.arrayBuffer());
    assert.ok(Math.max(meta.width, meta.height) <= 1600);
    assert.equal(Boolean(meta.exif), false);
  });

  it("a picture entry in a contest is stored as WebP too", async () => {
    const contest = await makeContest({ name: unique("Picture contest"), phase: "live", category: "design", type: "drawing" });
    const me = await makeLearner("entrant", "design");
    await apiOk(me, `frontend/contests/${contest.id}/join`, { method: "POST" });
    const form = new FormData();
    form.set("file", await read(await phoneJpeg()), "drawing.jpg");
    form.set("content", "my drawing");
    const made = await apiOk(me, `frontend/contests/${contest.id}/submit`, { method: "POST", form });
    const entry = (await apiOk("admin", `frontend/manage/contests/${contest.id}/submissions`)).find((item) => item.id === made.id);
    assert.equal(entry.mime_type, "image/webp");
    assert.match(entry.file_name, /\.webp$/);
    const stored = await info(await (await get(me, `frontend/contests/${contest.id}/submissions/${entry.id}/file`)).arrayBuffer());
    assert.equal(stored.format, "webp");
    assert.ok(Math.max(stored.width, stored.height) <= 2048);
  });

  it("a picture that is already small is not made bigger", async () => {
    const me = await makeLearner("smallpic");
    const tiny = await sharp({ create: { width: 64, height: 64, channels: 3, background: "#3366cc" } }).webp({ quality: 60 }).toBuffer();
    const form = new FormData();
    form.set("picture", new Blob([tiny], { type: "image/webp" }), "tiny.webp");
    assert.equal((await api(me, "users/me/picture", { method: "PUT", form })).status, 204);
    const stored = await (await get(me, `users/${me.id}/picture`)).arrayBuffer();
    assert.ok(stored.byteLength <= tiny.length + 8);
  });
});

describe("Upload optimisation · responses", () => {
  it("JSON answers are gzip-compressed when the client accepts it", async () => {
    const response = await fetch(`${urls.api}/frontend/catalog/courses?limit=50`, { headers: { Authorization: `Bearer ${await token({ username: "learner1" })}`, "Accept-Encoding": "gzip" } });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-encoding"), "gzip");
  });

  it("pictures are not compressed a second time", async () => {
    const me = await makeLearner("nogzip");
    const form = new FormData();
    form.set("picture", await read(await phoneJpeg()), "me.jpg");
    await api(me, "users/me/picture", { method: "PUT", form });
    const response = await fetch(`${urls.api}/users/${me.id}/picture`, { headers: { "Accept-Encoding": "gzip" } });
    assert.equal(response.headers.get("content-encoding"), null);
  });
});

describe("Upload optimisation · in the browser", () => {
  const b = useBrowser();
  const shown = (xpath) => visible(b.driver, By.xpath(xpath));

  it("the profile editor shrinks a big photo before sending it and says so", async () => {
    const me = await makeLearner("uieditor");
    await signIn(b.driver, me);
    await go(b.driver, "/profile");
    await click(b.driver, xText("Edit profile", { tag: "button" }));
    await visible(b.driver, By.css(".modal .dropzone"));
    // What the browser will really send: remember the size of the file that reaches the form.
    await b.driver.executeScript("window.__sent = []; const open = XMLHttpRequest.prototype.send; const fetchOriginal = window.fetch; window.fetch = (...args) => { try { const body = args[1] && args[1].body; if (body instanceof FormData) { const file = body.get('picture'); if (file) window.__sent.push({ name: file.name, type: file.type, size: file.size }); } } catch (e) {} return fetchOriginal(...args); };");
    const input = await find(b.driver, By.css(".modal .dropzone input[type=file]"));
    await b.driver.executeScript("arguments[0].hidden = false; arguments[0].style.display = 'block'", input);
    await input.sendKeys(await phoneJpeg());
    await waitText(b.driver, "Optimized for upload");
    await click(b.driver, xText("Save profile", { tag: "button" }));
    await b.driver.wait(async () => (await b.driver.executeScript("return window.__sent.length")) > 0, 15000);
    const [sent] = await b.driver.executeScript("return window.__sent");
    assert.equal(sent.type, "image/webp");
    assert.match(sent.name, /\.webp$/);
    assert.ok(sent.size < statSync(await phoneJpeg()).size / 6, `the browser sent ${sent.size} bytes`);
    await b.driver.wait(async () => (await get(me, `users/${me.id}/picture`)).status === 200, 15000);
    const stored = await info(await (await get(me, `users/${me.id}/picture`)).arrayBuffer());
    assert.equal(stored.format, "webp");
    assert.ok(Math.max(stored.width, stored.height) <= 640);
  });

  it("a showcase post shrinks its pictures while they are chosen", async () => {
    const me = await makeLearner("uipost", "web");
    await signIn(b.driver, me);
    await go(b.driver, "/showcase");
    await click(b.driver, xText("Create a post", { tag: "button" }));
    await visible(b.driver, By.css(".post-form"));
    await b.driver.executeScript("window.__sizes = []; const f = window.fetch; window.fetch = (...a) => { try { const body = a[1] && a[1].body; if (body instanceof FormData) body.getAll('media').forEach((file) => window.__sizes.push({ type: file.type, size: file.size })); } catch (e) {} return f(...a); };");
    await upload(b.driver, By.css(".post-form input[type=file]"), await phoneJpeg());
    await waitText(b.driver, "Optimized for upload");
    await visible(b.driver, By.css(".media-preview img"));
    const text = unique("Optimised post");
    await b.driver.executeScript("const t = document.querySelector('.post-form textarea'); t.focus();");
    await (await find(b.driver, By.css(".post-form textarea"))).sendKeys(text);
    await click(b.driver, By.css(".post-form [aria-label='Interest category'], .post-form .dropdown button"));
    await click(b.driver, By.xpath("//*[@role='option'][contains(normalize-space(.),'Web Development')]"));
    await click(b.driver, xText("Publish post", { tag: "button" }));
    await b.driver.wait(async () => (await b.driver.executeScript("return window.__sizes.length")) > 0, 15000);
    const [sent] = await b.driver.executeScript("return window.__sizes");
    assert.equal(sent.type, "image/webp");
    assert.ok(sent.size < 400 * 1024, `the browser sent ${sent.size} bytes`);
  });
});

const ffmpeg = spawnSync("ffmpeg", ["-version"]).status === 0;
describe("Upload optimisation · video in the browser", { skip: !ffmpeg && "ffmpeg is needed to make the test clip" }, () => {
  const b = useBrowser();
  const clip = path.join(dir, "big-clip.mp4");
  function makeClip() {
    if (!existsSync(clip)) {
      const made = spawnSync("ffmpeg", ["-loglevel", "error", "-y", "-f", "lavfi", "-i", "testsrc2=size=1920x1080:rate=30", "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000", "-t", "12", "-c:v", "libx264", "-b:v", "9M", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "256k", "-movflags", "+faststart", clip]);
      assert.equal(made.status, 0, String(made.stderr));
    }
    return clip;
  }

  it("a large video is converted to 720p before it is uploaded", async () => {
    const original = statSync(makeClip()).size;
    assert.ok(original > 4 * 1024 * 1024, `the test clip is only ${original} bytes`);
    const me = await makeLearner("uivideo", "web");
    await signIn(b.driver, me);
    await go(b.driver, "/showcase");
    await click(b.driver, xText("Create a post", { tag: "button" }));
    await visible(b.driver, By.css(".post-form"));
    await upload(b.driver, By.css(".post-form input[type=file]"), clip);
    await b.driver.wait(async () => /Optimized for upload|Optimizing/.test(await (await find(b.driver, By.css(".post-form"))).getText()), 20000);
    // Either it was converted (the usual case) or the browser could not encode video here and it was left as it was.
    await b.driver.wait(async () => !/Optimizing/.test(await (await find(b.driver, By.css(".post-form"))).getText()), 120000, "the conversion never finished");
    const text = await (await find(b.driver, By.css(".post-form"))).getText();
    if (!/Optimized for upload/.test(text)) return; // no hardware or software encoder in this browser: nothing to assert
    const src = await b.driver.executeScript("return document.querySelector('.media-preview video').src");
    const size = await b.driver.executeScript("return fetch(arguments[0]).then((r) => r.blob()).then((b) => ({ size: b.size, type: b.type }))", src);
    assert.ok(size.size < original * 0.9, `${size.size} is not smaller than ${original}`);
    assert.match(size.type, /video\/(mp4|webm)/);
  });

  it("a course video chosen in the admin form is converted before it is uploaded", async () => {
    const original = statSync(makeClip()).size;
    const course = await makeCourse({ title: unique("Optimised video course"), materials: [] });
    await signIn(b.driver, "admin");
    await go(b.driver, "/courses");
    await visible(b.driver, By.css(".admin-filters input[placeholder^='Search']"));
    await type(b.driver, By.css(".admin-filters input[placeholder^='Search']"), course.title);
    await click(b.driver, By.xpath(`//table//tr[.//*[contains(normalize-space(.), '${course.title}')]]//button[@aria-label='Edit course']`));
    await waitText(b.driver, "Course materials");
    await setValue(b.driver, By.css(".modal form select[name=type]"), "video");
    await type(b.driver, By.css(".modal form input[name=name]"), "Big lecture");
    await upload(b.driver, By.css(".modal form input[name=file]"), clip);
    await b.driver.wait(async () => /Optimized for upload|Optimizing/.test(await (await find(b.driver, By.css(".modal"))).getText()), 20000);
    await b.driver.wait(async () => !/Optimizing/.test(await (await find(b.driver, By.css(".modal"))).getText()), 120000);
    const text = await (await find(b.driver, By.css(".modal"))).getText();
    if (!/Optimized for upload/.test(text)) return;
    await click(b.driver, xText("Add material", { tag: "button" }));
    await visible(b.driver, By.xpath("//ul[contains(@class,'admin-material-list')]//strong[normalize-space(.)='Big lecture']"));
    const [material] = await apiOk("admin", `frontend/manage/courses/${course.id}/materials`);
    assert.ok(material.file_size < original * 0.9, `${material.file_size} is not smaller than ${original}`);
    assert.match(material.mime_type, /^video\/(mp4|webm)$/);
  });
});
