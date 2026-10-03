import dotenv from "dotenv";
import http from "node:http";
import { fileURLToPath } from "node:url";
dotenv.config({
  path: fileURLToPath(new URL("../../../.env", import.meta.url)),
});
import { createBalancer } from "./balancer.js";

const targets = (
  process.env.GATEWAY_URLS || "http://localhost:4101,http://localhost:4102"
).split(",");
const balancer = createBalancer({
  targets,
  strategy: process.env.LB_STRATEGY || "round-robin",
  healthInterval: Number(process.env.LB_HEALTH_INTERVAL_MS) || 5000,
  healthTimeout: Number(process.env.LB_HEALTH_TIMEOUT_MS) || 2000,
});

const statusToken = process.env.LB_STATUS_TOKEN;
const isLoopback = (address = "") =>
  ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(address);

const server = http.createServer((req, res) => {
  const path = req.url.split("?")[0];
  // The balancer's own endpoints. Everything else is forwarded to a gateway.
  if (path === "/health" || path === "/lb/health") {
    const { healthy, total } = balancer.status();
    res.writeHead(healthy ? 200 : 503, { "Content-Type": "application/json" });
    return res.end(
      JSON.stringify({
        service: "load-balancer",
        status: healthy ? "ok" : "unavailable",
        healthy,
        total,
      }),
    );
  }
  if (path === "/lb/status") {
    const allowed = statusToken
      ? req.headers["x-lb-token"] === statusToken
      : isLoopback(req.socket.remoteAddress);
    res.writeHead(allowed ? 200 : 403, { "Content-Type": "application/json" });
    return res.end(JSON.stringify(allowed ? balancer.status() : { error: "Forbidden" }));
  }
  balancer.handle(req, res);
});

// Uploads and downloads can legitimately take a long time; never cut them off here.
server.requestTimeout = 0;
server.headersTimeout = 65000;
server.keepAliveTimeout = 65000;

const port = process.env.LB_PORT || process.env.PORT || 4000;
server.listen(port, () => {
  balancer.start();
  console.log(
    `load balancer listening on ${port} -> ${targets.join(", ")} (${process.env.LB_STRATEGY || "round-robin"})`,
  );
});

function shutdown() {
  console.log("load balancer shutting down");
  server.close(() => {
    balancer.stop();
    process.exit(0);
  });
  server.closeIdleConnections?.();
  setTimeout(() => process.exit(0), 10000).unref();
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
