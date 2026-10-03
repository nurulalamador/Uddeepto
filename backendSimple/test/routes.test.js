import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";

// No database is needed: these checks stop at routing, auth and validation.
process.env.JWT_ACCESS_SECRET = "test-access";
process.env.JWT_REFRESH_SECRET = "test-refresh";
process.env.DATABASE_URL = "postgres://nobody:nothing@127.0.0.1:1/none";
process.env.CORS_ORIGINS = "http://localhost:3000";
process.env.RATE_LIMIT_PER_MINUTE = "10000";

console.error = () => {}; // expected failures are logged by the error handler
const { createServerApp } = await import("../src/app.js");
const server = createServerApp().listen(0, "127.0.0.1");
await once(server, "listening");
const base = `http://127.0.0.1:${server.address().port}`;
const call = (path, options = {}) =>
  fetch(base + path, {
    ...options,
    headers: { "content-type": "application/json", ...options.headers },
  });

test.after(() => server.closeAllConnections() || server.close());

test("health endpoint answers without touching the database", async () => {
  const res = await call("/health");
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { service: "backend-simple", status: "ok" });
});

test("unknown paths get the gateway 404 and unknown routes inside an area name the route", async () => {
  const outside = await call("/api/v1");
  assert.equal(outside.status, 404);
  assert.deepEqual(await outside.json(), { error: "Route not found" });
  const inside = await call("/api/v1/auth/nope");
  assert.equal(inside.status, 404);
  assert.match((await inside.json()).error, /Route not found: GET \/nope/);
});

test("every old gateway path is mounted and enforces authentication", async () => {
  // Each module has /health, which needs the (absent) database: anything but 404 proves the mount.
  for (const area of ["auth", "users", "courses", "communities", "contests", "webinars", "jobs", "messages", "payments"]) {
    const res = await call(`/api/v1/${area}/health`);
    assert.notEqual(res.status, 404, `${area} should be mounted`);
  }
  for (const path of ["/api/v1/frontend/dashboard", "/api/v1/frontend/notifications", "/api/v1/frontend/notifications/unread-count", "/api/v1/messages", "/api/v1/payments"]) {
    const res = await call(path);
    assert.equal(res.status, 401, path);
  }
});

test("request bodies are validated by the auth module", async () => {
  const res = await call("/api/v1/auth/login", { method: "POST", body: "{}" });
  assert.equal(res.status, 422);
  const body = await res.json();
  assert.equal(body.error, "Validation failed");
  assert.ok(body.details.fieldErrors.identifier);
});

test("showcase is rewritten to the community module's /showcase routes", async () => {
  const res = await call("/api/v1/showcase", { method: "POST", body: "{}" });
  assert.equal(res.status, 401, "reached POST /showcase, which requires login");
});

test("malformed JSON is a client error, not a crash", async () => {
  const res = await call("/api/v1/auth/login", { method: "POST", body: "{oops" });
  assert.equal(res.status, 400);
});

test("CORS only allows configured origins", async () => {
  const ok = await call("/health", { headers: { origin: "http://localhost:3000" } });
  assert.equal(ok.headers.get("access-control-allow-origin"), "http://localhost:3000");
  const bad = await call("/health", { headers: { origin: "http://evil.example" } });
  assert.equal(bad.status, 500);
});
