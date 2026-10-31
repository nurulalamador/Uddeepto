import { getNotifications, getNotificationsUnreadCount, createNotificationsReadAll, updateNotificationsById, deleteNotificationsById, deleteNotifications } from "../controllers/notifications.controller.js";
export function registerNotificationsRoutes(router) {
  router.get("/notifications", getNotifications);
  router.get("/notifications/unread-count", getNotificationsUnreadCount);
  router.post("/notifications/read-all", createNotificationsReadAll);
  router.patch("/notifications/:id", updateNotificationsById);
  router.delete("/notifications/:id", deleteNotificationsById);
  router.delete("/notifications", deleteNotifications);
}
