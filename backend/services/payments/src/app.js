import { createApp } from "@uddeepto/common";
import router from "./routes/payments.routes.js";
export function createServiceApp() {
  const app = createApp("payments");
  app.use('/', router);
  return app;
}
