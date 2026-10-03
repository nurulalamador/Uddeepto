import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { once } from "node:events";
import { createBalancer } from "../src/balancer.js";

const quiet = () => {};

/** A fake gateway that answers with its own name so tests can see who served a request. */
async function upstream(name, handler) {
  const server = http.createServer((req, res) => {
    if (handler?.(req, res)) return;
    if (req.url === "/health") return res.end("ok");
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      res.setHeader("x-instance", name);
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ name, method: req.method, url: req.url, forwarded: req.headers["x-forwarded-for"], body: Buffer.concat(chunks).toString() }));
    });
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  return { server, url: `http://127.0.0.1:${server.address().port}` };
}

async function front(options) {
  const balancer = createBalancer({ log: quiet, healthInterval: 100000, ...options });
  const server = http.createServer((req, res) => balancer.handle(req, res));
  server.on("upgrade", (req, socket, head) => balancer.upgrade(req, socket, head));
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}`;
  const close = async () => {
    balancer.stop();
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
  };
  return { balancer, base, close };
}

const closeAll = (...servers) => Promise.all(servers.map((s) => { s.closeAllConnections(); return new Promise((r) => s.close(r)); }));

test("round-robin alternates between healthy gateways", async () => {
  const a = await upstream("a");
  const b = await upstream("b");
  const lb = await front({ targets: [a.url, b.url] });
  const sockets = [];
  try {
    const seen = [];
    for (let i = 0; i < 6; i += 1) seen.push((await fetch(`${lb.base}/x`)).headers.get("x-instance"));
    assert.deepEqual(seen, ["a", "b", "a", "b", "a", "b"]);
    assert.equal((await fetch(`${lb.base}/x`)).headers.get("x-load-balancer"), "uddeepto-lb");
  } finally {
    await lb.close();
    await closeAll(a.server, b.server);
  }
});

test("a dead gateway is skipped and GET requests are retried on the other one", async () => {
  const a = await upstream("a");
  const b = await upstream("b");
  const lb = await front({ targets: [a.url, b.url] });
  try {
    await closeAll(a.server);
    for (let i = 0; i < 5; i += 1) {
      const res = await fetch(`${lb.base}/data`);
      assert.equal(res.status, 200);
      assert.equal(res.headers.get("x-instance"), "b");
    }
    assert.equal(lb.balancer.status().healthy, 1);
  } finally {
    await lb.close();
    await closeAll(b.server);
  }
});

test("health checks mark a gateway down and bring it back", async () => {
  let healthy = true;
  const a = await upstream("a", (req, res) => {
    if (req.url === "/health" && !healthy) { res.statusCode = 500; res.end(); return true; }
  });
  const b = await upstream("b");
  const lb = await front({ targets: [a.url, b.url], failThreshold: 2 });
  try {
    healthy = false;
    await lb.balancer.checkAll();
    assert.equal(lb.balancer.backends[0].healthy, true, "one failure is not enough");
    await lb.balancer.checkAll();
    assert.equal(lb.balancer.backends[0].healthy, false);
    for (let i = 0; i < 4; i += 1) assert.equal((await fetch(`${lb.base}/x`)).headers.get("x-instance"), "b");
    healthy = true;
    await lb.balancer.checkAll();
    assert.equal(lb.balancer.backends[0].healthy, true);
  } finally {
    await lb.close();
    await closeAll(a.server, b.server);
  }
});

test("returns 503 when every gateway is down", async () => {
  const a = await upstream("a");
  const lb = await front({ targets: [a.url] });
  try {
    await closeAll(a.server);
    const res = await fetch(`${lb.base}/x`);
    assert.equal(res.status, 503);
    assert.ok(res.headers.get("retry-after"));
    assert.match((await res.json()).error, /temporarily unavailable/i);
  } finally {
    await lb.close();
  }
});

test("request bodies, query strings and client address are forwarded", async () => {
  const a = await upstream("a");
  const lb = await front({ targets: [a.url] });
  try {
    const res = await fetch(`${lb.base}/items?x=1&y=2`, { method: "POST", headers: { "content-type": "text/plain" }, body: "hello world" });
    const data = await res.json();
    assert.equal(data.method, "POST");
    assert.equal(data.url, "/items?x=1&y=2");
    assert.equal(data.body, "hello world");
    assert.match(data.forwarded, /127\.0\.0\.1/);
  } finally {
    await lb.close();
    await closeAll(a.server);
  }
});

test("non-idempotent requests are not replayed on another gateway", async () => {
  const a = await upstream("a");
  const b = await upstream("b");
  const lb = await front({ targets: [a.url, b.url] });
  try {
    await closeAll(a.server);
    const res = await fetch(`${lb.base}/orders`, { method: "POST", body: "x" });
    assert.equal(res.status, 502);
    // The failed instance is now out of rotation, so the next call goes to the healthy one.
    const next = await fetch(`${lb.base}/orders`, { method: "POST", body: "x" });
    assert.equal(next.status, 200);
    assert.equal(next.headers.get("x-instance"), "b");
  } finally {
    await lb.close();
    await closeAll(b.server);
  }
});

test("least-connections prefers the idle gateway", async () => {
  let release;
  const gate = new Promise((r) => { release = r; });
  const slow = await upstream("slow", (req, res) => {
    if (req.url === "/slow") { gate.then(() => { res.setHeader("x-instance", "slow"); res.end("late"); }); return true; }
  });
  const fast = await upstream("fast");
  const lb = await front({ targets: [slow.url, fast.url], strategy: "least-connections" });
  try {
    const pending = fetch(`${lb.base}/slow`);
    await new Promise((r) => setTimeout(r, 100));
    for (let i = 0; i < 4; i += 1) assert.equal((await fetch(`${lb.base}/quick`)).headers.get("x-instance"), "fast");
    release();
    assert.equal((await pending).status, 200);
  } finally {
    await lb.close();
    await closeAll(slow.server, fast.server);
  }
});

test("large streamed uploads pass through intact", async () => {
  const a = await upstream("a", (req, res) => {
    if (req.method !== "PUT") return false;
    let size = 0;
    req.on("data", (c) => { size += c.length; });
    req.on("end", () => res.end(String(size)));
    return true;
  });
  const lb = await front({ targets: [a.url] });
  try {
    const body = Buffer.alloc(8 * 1024 * 1024, 7);
    const res = await fetch(`${lb.base}/upload`, { method: "PUT", body });
    assert.equal(await res.text(), String(body.length));
  } finally {
    await lb.close();
    await closeAll(a.server);
  }
});

/** A gateway stand-in that accepts Upgrade requests and echoes whatever it receives. */
async function echoUpstream(name) {
  const server = await upstream(name);
  server.server.on("upgrade", (req, socket) => {
    socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nx-instance: ${name}\r\n\r\n`);
    socket.on("data", (chunk) => socket.write(`${name}:${chunk}`));
    socket.on("end", () => socket.end());
    socket.on("error", () => {});
  });
  return server;
}
function connectUpgrade(base, path = "/socket.io/?EIO=4") {
  return new Promise((resolve, reject) => {
    const request = http.request(base + path, { headers: { Connection: "Upgrade", Upgrade: "websocket" } });
    request.on("upgrade", (response, socket) => resolve({ response, socket }));
    request.on("response", (response) => resolve({ response, socket: null }));
    request.on("error", reject);
    request.end();
  });
}

test("WebSocket upgrades are tunnelled to a gateway and bytes flow both ways", async () => {
  const a = await echoUpstream("a");
  const b = await echoUpstream("b");
  const lb = await front({ targets: [a.url, b.url] });
  const sockets = [];
  try {
    const seen = [];
    for (let i = 0; i < 4; i += 1) {
      const { response, socket } = await connectUpgrade(lb.base);
      sockets.push(socket);
      assert.equal(response.statusCode, 101);
      assert.equal(response.headers["x-load-balancer"], "uddeepto-lb");
      socket.write("ping");
      const [reply] = await once(socket, "data");
      seen.push(String(reply));
      socket.destroy();
    }
    assert.deepEqual(seen, ["a:ping", "b:ping", "a:ping", "b:ping"], "connections are spread over the gateways");
  } finally {
    sockets.forEach((socket) => socket?.destroy());
    await lb.close();
    await closeAll(a.server, b.server);
  }
});

test("an upgrade to a dead gateway is retried elsewhere once it is marked down, and 503 when none are left", async () => {
  const a = await echoUpstream("a");
  const lb = await front({ targets: [a.url] });
  try {
    await closeAll(a.server);
    let refused = await connectUpgrade(lb.base).catch((error) => ({ error }));
    const status = refused.response?.statusCode;
    assert.ok(status === 502 || status === 503 || refused.error, `unexpected ${status}`);
    refused = await connectUpgrade(lb.base).catch((error) => ({ error }));
    assert.ok(refused.response?.statusCode === 503 || refused.error);
  } finally {
    await lb.close();
  }
});
