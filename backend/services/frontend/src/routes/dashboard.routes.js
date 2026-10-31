import { getDashboard, getDashboardLearner, getDashboardHirer } from "../controllers/dashboard.controller.js";
export function registerDashboardRoutes(router) {
  router.get("/dashboard", getDashboard);
  router.get("/dashboard/learner", getDashboardLearner);
  router.get("/dashboard/hirer", getDashboardHirer);
}
