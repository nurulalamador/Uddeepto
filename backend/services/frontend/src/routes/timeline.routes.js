import { createTimelineControllers } from "../controllers/timeline.controller.js";
export function registerTimelineRoutes(router, route, table, schema, columns, label) {
  const controller = createTimelineControllers(table, schema, columns, label);
  router.post(`/profile/${route}`, controller.createEntry);
  router.patch(`/profile/${route}/:entryId`, controller.updateEntry);
  router.delete(`/profile/${route}/:entryId`, controller.deleteEntry);
}
