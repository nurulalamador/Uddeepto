import { createApp } from "@uddeepto/common";
import router from "./routes/messages.routes.js";
export function createServiceApp() {
  const app = createApp("messages");
  app.use('/', router);
  return app;
}
