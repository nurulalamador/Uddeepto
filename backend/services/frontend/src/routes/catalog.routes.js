import { getCatalogByKind, getDetailByKindById } from "../controllers/catalog.controller.js";
export function registerCatalogRoutes(router) {
  router.get("/catalog/:kind", getCatalogByKind);
  router.get("/detail/:kind/:id", getDetailByKindById);
}
