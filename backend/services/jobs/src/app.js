import { createApp } from "@uddeepto/common";
import router from "./routes/jobs.routes.js";
export function createServiceApp() {
  const app = createApp("jobs");
  app.use('/', router);
  return app;
}
