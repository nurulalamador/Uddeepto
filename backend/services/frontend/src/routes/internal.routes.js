import { createInternalEmit } from "../controllers/internal.controller.js";
export function registerInternalRoutes(router) {
  router.post("/internal/emit", createInternalEmit);
}
