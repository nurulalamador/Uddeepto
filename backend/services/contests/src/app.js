import { createApp } from "@uddeepto/common";
import router from "./routes/contests.routes.js";
export function createServiceApp() {
  const app = createApp("contests");
  app.use('/', router);
  return app;
}
