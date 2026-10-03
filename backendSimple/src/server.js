import { attachRealtime } from "./common.js"; // also loads .env before anything reads process.env
import { createServerApp } from "./app.js";
import { realtimeOptions } from "./modules/frontend.js";

const port = process.env.PORT || process.env.GATEWAY_PORT || 4000;
const app = createServerApp();
const server = app.listen(port, () =>
  console.log(`backend-simple listening on ${port}`),
);
// Live updates (Socket.IO) share this HTTP server and port.
attachRealtime(server, realtimeOptions);
// Uploads and downloads can take a long time; do not cut them off.
server.requestTimeout = 0;
server.headersTimeout = 66000;
server.keepAliveTimeout = 65000;

const shutdown = () => {
  server.close(() => process.exit(0));
  server.closeIdleConnections?.();
  setTimeout(() => process.exit(0), 10000).unref();
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
