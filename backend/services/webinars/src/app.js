import { createApp } from "@uddeepto/common";
import router from "./routes/webinars.routes.js";
export function createServiceApp() {
  const app = createApp("webinars");
  app.use('/', router);
  return app;
}
