import { getWebinarsById, createWebinarsByIdJoin } from "../controllers/webinars.controller.js";
export function registerWebinarsRoutes(router) {
  router.get("/webinars/:id", getWebinarsById);
  router.post("/webinars/:id/join", createWebinarsByIdJoin);
}
