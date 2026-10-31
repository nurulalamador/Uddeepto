import { NOTIFICATION_TYPES, query } from "@uddeepto/common";
export const notificationCategories = [...new Set(Object.values(NOTIFICATION_TYPES))];
export const reminderChecks = new Map();
export const pruneChecks = new Map();
// Reminders are created when someone opens the app (there is no background scheduler).
export async function createReminders(user) {
  if (user.role !== "learner") return;
  const now = Date.now();
  if (now - (reminderChecks.get(user.sub) || 0) < 5 * 60 * 1000) return;
  if (reminderChecks.size > 5000) reminderChecks.clear();
  reminderChecks.set(user.sub, now);
  const hours = column => `greatest(1,round(extract(epoch FROM ${column}-now())/3600))::int`;
  const insert = select => query(`INSERT INTO notifications(user_id,type,category,title,body,link,entity_type,entity_id,dedupe_key) ${select} ON CONFLICT (user_id,dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING`, [user.sub]);
  try {
    await insert(`SELECT p.participant_id,'webinar_reminder','webinars','“'||w.name||'” starts soon','Starts in about '||${hours("w.starting_time")}||' hour(s). Don’t forget to join.','/webinars/'||w.id,'webinar',w.id,'remind:webinar:'||w.id FROM webinar_participants p JOIN webinars w ON w.id=p.webinar_id WHERE p.participant_id=$1 AND p.status='registered' AND w.status IN('scheduled','live') AND w.starting_time>now() AND w.starting_time<=now()+interval '24 hours'`);
    await insert(`SELECT p.participant_id,'contest_reminder','contests','“'||c.name||'” starts soon','Starts in about '||${hours("c.starting_time")}||' hour(s). Get ready!','/contests/'||c.id,'contest',c.id,'remind:contest-start:'||c.id FROM contest_participants p JOIN contests c ON c.id=p.contest_id WHERE p.participant_id=$1 AND p.payment_status='paid' AND c.status='published' AND c.starting_time>now() AND c.starting_time<=now()+interval '24 hours'`);
    await insert(`SELECT p.participant_id,'contest_reminder','contests','“'||c.name||'” ends soon','Ends in about '||${hours("c.ending_time")}||' hour(s). Submit your work in time.','/contests/'||c.id,'contest',c.id,'remind:contest-end:'||c.id FROM contest_participants p JOIN contests c ON c.id=p.contest_id WHERE p.participant_id=$1 AND p.payment_status='paid' AND c.status='published' AND c.starting_time<=now() AND c.ending_time>now() AND c.ending_time<=now()+interval '24 hours'`);
  } catch (error) {
    console.error("reminders failed:", error.message);
  }
}
// Keep the table small: read items after 60 days, everything after 180.
// Keep the table small: read items after 60 days, everything after 180.
export async function pruneNotifications(userId) {
  const now = Date.now();
  if (now - (pruneChecks.get(userId) || 0) < 60 * 60 * 1000) return;
  if (pruneChecks.size > 5000) pruneChecks.clear();
  pruneChecks.set(userId, now);
  await query("DELETE FROM notifications WHERE user_id=$1 AND((read_at IS NOT NULL AND created_at<now()-interval '60 days') OR created_at<now()-interval '180 days')", [userId]).catch(() => {});
}
