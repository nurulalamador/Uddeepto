import { createApp } from "@uddeepto/common";
import router from "./routes/courses.routes.js";
export function createServiceApp() {
  const app = createApp("courses");
  app.use('/', router);
  return app;
}
