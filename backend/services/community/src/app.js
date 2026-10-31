import { createApp } from "@uddeepto/common";
import router from "./routes/community.routes.js";
export function createServiceApp() {
  const app = createApp("community");
  app.use('/', router);
  return app;
}
