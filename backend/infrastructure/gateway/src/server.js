import { gatewayConfig } from "./config.js";
import { createGatewayApp } from "./app.js";

const { app, upgrade } = createGatewayApp();
const server = app.listen(gatewayConfig.port, () =>
  console.log(`${gatewayConfig.instance} listening on ${gatewayConfig.port}`),
);
server.on("upgrade", upgrade);
// Keep idle connections open longer than the load balancer's connections.
server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;
server.requestTimeout = 0;

const shutdown = () => {
  server.close(() => process.exit(0));
  server.closeIdleConnections?.();
  setTimeout(() => process.exit(0), 10000).unref();
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
