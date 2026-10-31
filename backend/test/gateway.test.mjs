import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { once } from "node:events";
import { createGatewayApp } from "../infrastructure/gateway/src/app.js";
import { createBalancer } from "../infrastructure/loadbalancer/src/balancer.js";

const areas = ["auth", "users", "courses", "communities", "showcase", "contests", "webinars", "jobs", "messages", "payments"];
const start = async server => {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  return `http://127.0.0.1:${server.address().port}`;
};
const close = server => new Promise(resolve => {
  server.closeAllConnections();
  server.close(resolve);
});

test("load balancer and both gateways retain all public API paths and streamed bodies", async () => {
  const upstream = http.createServer((req, res) => {
    const chunks = [];
    req.on("data", chunk => chunks.push(chunk));
    req.on("end", () => {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ method: req.method, path: req.url, authorization: req.headers.authorization, body: Buffer.concat(chunks).toString() }));
    });
  });
  const upstreamUrl = await start(upstream);
  const gateways = [];
  let front, balancer;
  try {
    const targets = [];
    for (const instance of ["gateway-1", "gateway-2"]) {
      const { app, upgrade } = createGatewayApp({
        instance,
        origins: ["http://localhost:3000"],
        services: Object.fromEntries(areas.map(area => [area, upstreamUrl])),
        frontendApiUrl: upstreamUrl,
      });
      const server = http.createServer(app);
      server.on("upgrade", upgrade);
      gateways.push(server);
      targets.push(await start(server));
    }
    balancer = createBalancer({ targets, log: () => {} });
    front = http.createServer((req, res) => balancer.handle(req, res));
    front.on("upgrade", (req, socket, head) => balancer.upgrade(req, socket, head));
    const base = await start(front);
    const instances = new Set();
    for (const area of [...areas, "frontend"]) {
      const response = await fetch(`${base}/api/v1/${area}/sample?limit=3`, {
        method: "POST",
        headers: { Authorization: "Bearer unchanged-token", "Content-Type": "application/json", Origin: "http://localhost:3000" },
        body: JSON.stringify({ area }),
      });
      assert.equal(response.status, 200, area);
      instances.add(response.headers.get("x-gateway-instance"));
      assert.equal(response.headers.get("x-load-balancer"), "uddeepto-lb");
      assert.equal(response.headers.get("access-control-allow-origin"), "http://localhost:3000");
      assert.deepEqual(await response.json(), {
        method: "POST",
        path: `${area === "showcase" ? "/showcase" : ""}/sample?limit=3`,
        authorization: "Bearer unchanged-token",
        body: JSON.stringify({ area }),
      });
    }
    assert.deepEqual([...instances].sort(), ["gateway-1", "gateway-2"]);
    const unknown = await fetch(`${base}/api/v1/unknown`);
    assert.equal(unknown.status, 404);
    assert.deepEqual(await unknown.json(), { error: "Route not found" });
    const health = await fetch(`${base}/health`);
    assert.equal(health.status, 200);
    assert.equal((await health.json()).service, "gateway");
  } finally {
    balancer?.stop();
    await Promise.all([upstream, ...gateways, front].filter(Boolean).map(close));
  }
});
