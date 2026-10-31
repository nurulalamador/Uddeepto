import { run } from "../middleware/response.middleware.js";
import { createReminders, pruneNotifications, notificationCategories } from "../services/notifications.service.js";
import { paging, one, uuid } from "../services/shared.service.js";
import { query, ApiError } from "@uddeepto/common";
import { z } from "zod";
export const getNotifications = run(async req => {
  const [limit, offset] = paging(req);
  await createReminders(req.user);
  await pruneNotifications(req.user.sub);
  const where = ["n.user_id=$1"];
  const values = [req.user.sub];
  if (req.query.filter === "unread") where.push("n.read_at IS NULL");
  if (req.query.category) {
    values.push(z.enum(notificationCategories).parse(req.query.category));
    where.push(`n.category=$${values.length}`);
  }
  values.push(limit + 1, offset);
  const rows = (await query(`SELECT n.id,n.type,n.category,n.title,n.body,n.link,(n.read_at IS NOT NULL) AS read,n.created_at,n.actor_id,u.name actor_name,(u.picture IS NOT NULL) actor_has_picture FROM notifications n LEFT JOIN users u ON u.id=n.actor_id WHERE ${where.join(" AND ")} ORDER BY n.created_at DESC,n.id LIMIT $${values.length - 1} OFFSET $${values.length}`, values)).rows;
  const counts = (await query("SELECT category,count(*)::int AS count FROM notifications WHERE user_id=$1 AND read_at IS NULL GROUP BY category", [req.user.sub])).rows;
  return {
    items: rows.slice(0, limit),
    has_more: rows.length > limit,
    unread: counts.reduce((sum, row) => sum + row.count, 0),
    unread_by_category: Object.fromEntries(counts.map(row => [row.category, row.count]))
  };
});
export const getNotificationsUnreadCount = run(async req => {
  await createReminders(req.user);
  return {
    count: (await one("SELECT count(*)::int AS count FROM notifications WHERE user_id=$1 AND read_at IS NULL", [req.user.sub])).count
  };
});
export const createNotificationsReadAll = run(async req => {
  const values = [req.user.sub];
  let extra = "";
  if (req.body?.category) {
    values.push(z.enum(notificationCategories).parse(req.body.category));
    extra = " AND category=$2";
  }
  const result = await query(`UPDATE notifications SET read_at=now() WHERE user_id=$1 AND read_at IS NULL${extra}`, values);
  return {
    updated: result.rowCount
  };
});
export const updateNotificationsById = run(async req => {
  const read = z.boolean().default(true).parse(req.body?.read);
  const result = await query(`UPDATE notifications SET read_at=${read ? "coalesce(read_at,now())" : "NULL"} WHERE id=$1 AND user_id=$2`, [uuid(req.params.id), req.user.sub]);
  if (!result.rowCount) throw new ApiError(404, "Notification not found");
});
export const deleteNotificationsById = run(async req => {
  const result = await query("DELETE FROM notifications WHERE id=$1 AND user_id=$2", [uuid(req.params.id), req.user.sub]);
  if (!result.rowCount) throw new ApiError(404, "Notification not found");
});
export const deleteNotifications = run(async req => {
  const result = await query("DELETE FROM notifications WHERE user_id=$1 AND read_at IS NOT NULL", [req.user.sub]);
  return {
    deleted: result.rowCount
  };
});
