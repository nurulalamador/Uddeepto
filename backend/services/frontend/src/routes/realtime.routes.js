import { createRealtimeTicket } from "../controllers/realtime.controller.js";
export function registerRealtimeRoutes(router) {
  router.post("/realtime/ticket", createRealtimeTicket);
}
