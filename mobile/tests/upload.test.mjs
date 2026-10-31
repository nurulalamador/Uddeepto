import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import { request as httpRequest } from "node:http";
import { createRequire } from "node:module";
import { once } from "node:events";
import ts from "typescript";

const require = createRequire(import.meta.url);
const { transformSync } = require("@babel/core");
const express = require("../../backendSimple/node_modules/express");
const multer = require("../../backendSimple/node_modules/multer");
const dataUrl = (code) => `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
const compile = (source) => ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const source = (path) => readFile(new URL(path, import.meta.url), "utf8");

// Use the installed RN FormData and Expo serializer: the old upload fails here
// before a network request is possible, exactly as it does in SDK 58.
const rnSource = await source("../node_modules/react-native/Libraries/Network/FormData.js");
const { default: RNFormData } = await import(dataUrl(transformSync(rnSource, {
  babelrc: false, configFile: false, plugins: ["@babel/plugin-transform-flow-strip-types"],
}).code));
const { installFormDataPatch } = await import(dataUrl(compile(await source("../node_modules/expo/src/winter/FormData.ts"))));
const NativeFormData = installFormDataPatch(RNFormData);
const blobUtils = dataUrl(compile(await source("../node_modules/expo/src/utils/blobUtils.ts")));
const serializerSource = compile(await source("../node_modules/expo/src/winter/fetch/convertFormData.ts"))
  .replace("../../utils/blobUtils", blobUtils);
const { convertFormDataAsync } = await import(dataUrl(serializerSource));
const multipartModule = dataUrl(compile(await source("../src/lib/multipart.ts")));

const originalXHR = globalThis.XMLHttpRequest;
const originalFetch = globalThis.fetch;
const pixels = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=", "base64");
const attachments = new Map([
  ["file:///cache/photo-1.jpg", pixels],
  ["file:///cache/photo-2.png", pixels],
]);
const uploads = [];
let server, base, api, saveTokens, refreshes = 0;

// Only native I/O is substituted. Multipart parts come from the real RN encoder
// and travel over HTTP to the same Multer parser used by the backends.
class NativeXHR {
  headers = {};
  open(method, url) { this.method = method; this.url = url; }
  setRequestHeader(name, value) { this.headers[name] = value; }
  send(form) {
    uploads.push({ form, headers: this.headers });
    const boundary = "----NativeUploadRegression";
    const chunks = [];
    try {
      for (const part of form.getParts()) {
        chunks.push(Buffer.from(`--${boundary}\r\n`));
        for (const [name, value] of Object.entries(part.headers)) chunks.push(Buffer.from(`${name}: ${value}\r\n`));
        chunks.push(Buffer.from("\r\n"));
        if (part.uri) {
          if (!attachments.has(part.uri)) throw new Error("Missing local attachment");
          chunks.push(attachments.get(part.uri));
        } else chunks.push(Buffer.from(part.string));
        chunks.push(Buffer.from("\r\n"));
      }
    } catch {
      queueMicrotask(() => this.onerror?.());
      return;
    }
    chunks.push(Buffer.from(`--${boundary}--\r\n`));
    this.connection = httpRequest(this.url, {
      method: this.method,
      headers: { ...this.headers, "Content-Type": `multipart/form-data; boundary=${boundary}` },
    }, (response) => {
      const body = [];
      response.on("data", (chunk) => body.push(chunk));
      response.on("end", () => {
        this.status = response.statusCode;
        this.responseText = Buffer.concat(body).toString();
        this.onload?.();
      });
    });
    this.connection.on("error", () => this.onerror?.());
    this.connection.end(Buffer.concat(chunks));
  }
  abort() { this.connection?.destroy(); this.onabort?.(); }
}

before(async () => {
  const app = express();
  app.use(express.json());
  app.post("/api/v1/auth/refresh", (_req, res) => {
    refreshes++;
    res.json({ accessToken: "fresh-access", refreshToken: "fresh-refresh" });
  });
  app.use((req, res, next) => {
    if (req.headers.authorization === "Bearer expired-access") return res.status(401).json({ error: "Expired" });
    if (req.headers.authorization !== "Bearer fresh-access") return res.status(401).json({ error: "Please sign in" });
    next();
  });
  app.use(multer().any());
  app.use((req, res) => {
    if (req.path.endsWith("/too-large")) return res.status(413).json({ error: "File too large" });
    if (req.path.endsWith("/json")) return res.json(req.body);
    res.status(201).json({ fields: req.body, files: req.files.map((file) => ({
      field: file.fieldname, name: decodeURIComponent(file.originalname), type: file.mimetype,
      data: file.buffer.toString("base64"),
    })) });
  });
  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  base = `http://127.0.0.1:${server.address().port}/api/v1`;
  globalThis.XMLHttpRequest = NativeXHR;
  globalThis.fetch = (url, init) => {
    assert.ok(!(init?.body instanceof RNFormData), "URI attachments must bypass Expo fetch");
    return originalFetch(url, init);
  };
  const apiSource = compile(await source("../src/lib/api.ts"))
    .replace(/import \* as SecureStore from "expo-secure-store";/, "const SecureStore={setItemAsync:async()=>{},deleteItemAsync:async()=>{}};")
    .replace(/import \{ API_URL \} from "\.\/config";/, `const API_URL=${JSON.stringify(base)};`)
    .replace('"./multipart"', JSON.stringify(multipartModule));
  ({ api, saveTokens } = await import(dataUrl(apiSource)));
  await saveTokens({ accessToken: "fresh-access", refreshToken: "refresh" });
});

after(async () => {
  globalThis.XMLHttpRequest = originalXHR;
  globalThis.fetch = originalFetch;
  server?.closeAllConnections();
  if (server) await new Promise((resolve) => server.close(resolve));
});

function showcaseForm() {
  const form = new NativeFormData();
  form.append("category_id", "category-1");
  form.append("content", "আমার কাজের ছবি");
  form.append("visibility", "public");
  form.append("media", { uri: "file:///cache/photo-1.jpg", name: "আমার ছবি.jpg", type: "image/jpeg" });
  form.append("media", { uri: "file:///cache/photo-2.png", name: "second.png", type: "image/png" });
  return form;
}

test("reproduces SDK 58 rejecting the old URI attachment before networking", async () => {
  await assert.rejects(convertFormDataAsync(showcaseForm()), /Unsupported FormDataPart implementation/);
});

test("showcase photos, Bangla text, filenames and repeated media fields reach Multer", async () => {
  const form = showcaseForm();
  const result = await api("frontend/showcase", { method: "POST", form });
  assert.equal(result.fields.content, "আমার কাজের ছবি");
  assert.equal(result.fields.category_id, "category-1");
  assert.deepEqual(result.files.map((file) => [file.field, file.name, file.type]), [
    ["media", "আমার ছবি.jpg", "image/jpeg"], ["media", "second.png", "image/png"],
  ]);
  assert.ok(result.files.every((file) => file.data === pixels.toString("base64")));
  assert.equal(uploads.at(-1).form, form);
  assert.equal(uploads.at(-1).headers["Content-Type"], undefined, "native encoder must set its boundary");
});

test("an expired token refreshes once and retries the same file attachments", async () => {
  await saveTokens({ accessToken: "expired-access", refreshToken: "refresh" });
  const count = uploads.length;
  const result = await api("frontend/showcase", { method: "POST", form: showcaseForm() });
  assert.equal(refreshes, 1);
  assert.equal(uploads.length - count, 2);
  assert.equal(uploads.at(-1).headers.Authorization, "Bearer fresh-access");
  assert.equal(result.files.length, 2);
});

test("shared uploads preserve different field names and PATCH/PUT methods", async () => {
  for (const [path, method, field] of [["frontend/profile", "PATCH", "picture"], ["frontend/cv", "PUT", "file"], ["frontend/contests/test/submit", "POST", "file"]]) {
    const form = new NativeFormData();
    form.append(field, { uri: "file:///cache/photo-1.jpg", name: "attachment.jpg", type: "image/jpeg" });
    const result = await api(path, { method, form });
    assert.equal(result.files[0].field, field);
  }
});

test("HTTP upload errors retain the server status and message", async () => {
  await assert.rejects(api("too-large", { method: "POST", form: showcaseForm() }), (error) => error.status === 413 && error.message === "File too large");
});

test("upload cancellation stays an AbortError and pre-cancelled uploads are not sent", async () => {
  const cancelled = new AbortController();
  cancelled.abort();
  const count = uploads.length;
  await assert.rejects(api("frontend/showcase", { method: "POST", form: showcaseForm(), signal: cancelled.signal }), { name: "AbortError" });
  assert.equal(uploads.length, count);
  const controller = new AbortController();
  const uploading = api("frontend/showcase", { method: "POST", form: showcaseForm(), signal: controller.signal });
  controller.abort();
  await assert.rejects(uploading, { name: "AbortError" });
});

test("normal JSON requests still use fetch", async () => {
  assert.deepEqual(await api("json", { method: "POST", body: { content: "text-only request" } }), { content: "text-only request" });
});
