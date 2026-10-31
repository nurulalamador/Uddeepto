import { createApp } from "@uddeepto/common";
import router from "./routes/users.routes.js";
export function createServiceApp() {
  const app = createApp("users");
  app.use('/', router);
  return app;
}
