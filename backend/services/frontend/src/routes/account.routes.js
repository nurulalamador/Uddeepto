import { createAccountPassword, deleteAccount } from "../controllers/account.controller.js";
export function registerAccountRoutes(router) {
  router.post("/account/password", createAccountPassword);
  router.delete("/account", deleteAccount);
}
