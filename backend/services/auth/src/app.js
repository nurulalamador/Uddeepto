import { createApp } from "@uddeepto/common";
import router from "./routes/auth.routes.js";
export function createServiceApp() {
  const app = createApp("auth");
  app.use('/', router);
  return app;
}
