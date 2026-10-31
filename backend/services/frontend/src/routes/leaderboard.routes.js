import { getLeaderboard } from "../controllers/leaderboard.controller.js";
export function registerLeaderboardRoutes(router) {
  router.get("/leaderboard", getLeaderboard);
}
