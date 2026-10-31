import { createApp } from "@uddeepto/common";
import router from "./routes/index.js";
export function createServiceApp() {
  const app = createApp("frontend-api");
  app.use('/', router);
  return app;
}
