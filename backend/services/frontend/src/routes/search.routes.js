import { getSearch } from "../controllers/search.controller.js";
export function registerSearchRoutes(router) {
  router.get("/search", getSearch);
}
