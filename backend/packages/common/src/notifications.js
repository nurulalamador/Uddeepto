// In-app notifications. createNotifier(query) is separate from the database pool so
// the tests can run the real code against an in-memory database.
// type -> the group the UI filters by. Add new notification types here.
export const NOTIFICATION_TYPES = {
  post_like: "social",
  post_comment: "social",
  comment_like: "social",
  post_removed: "social",
  job_application_received: "jobs",
  job_application_status: "jobs",
  job_closed: "jobs",
  job_new: "jobs",
  contest_result: "contests",
  contest_submission_judged: "contests",
  contest_reminder: "contests",
  contest_cancelled: "contests",
  contest_new: "contests",
  course_new: "courses",
  course_material_added: "courses",
  webinar_reminder: "webinars",
  webinar_cancelled: "webinars",
  webinar_new: "webinars",
  community_join_request: "communities",
  community_member_joined: "communities",
  community_membership: "communities",
  welcome: "system",
  report_update: "system",
  report_received: "admin",
  hirer_registered: "admin",
  job_posted: "admin",
};
const clip = (value, max) => (value == null ? null : String(value).slice(0, max));
// publish(items) receives [{ to: userId, event, payload }] so new notifications can reach open browsers.
export function createNotifier(query, publish = () => {}) {
  /**
   * Create a notification for one or many users. It never throws: a failed notification
   * must not break the action that caused it. Call it after the transaction has committed.
   *   to    user id or array of user ids (the actor is skipped automatically)
   *   key   optional dedupe key; the same (user, key) is only ever notified once
   *   entity  [entity_type, entity_id]
   */
  async function notify(
    { to, actor = null, type, title, body = null, link = null, entity = [], key = null },
    db = { query },
  ) {
    try {
      const category = NOTIFICATION_TYPES[type];
      if (!category) throw new Error(`Unknown notification type: ${type}`);
      const ids = [...new Set([].concat(to ?? []).filter(Boolean))].filter(
        (id) => id !== actor,
      );
      if (!ids.length) return 0;
      const result = await db.query(
        `WITH inserted AS (
           INSERT INTO notifications(user_id,actor_id,type,category,title,body,link,entity_type,entity_id,dedupe_key)
           SELECT u,$2::uuid,$3::text,$4::text,$5::text,$6::text,$7::text,$8::text,$9::uuid,$10::text FROM unnest($1::uuid[]) u
           ON CONFLICT (user_id,dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING
           RETURNING *)
         SELECT i.id,i.user_id,i.type,i.category,i.title,i.body,i.link,i.created_at,i.actor_id,a.name AS actor_name,(a.picture IS NOT NULL) AS actor_has_picture
         FROM inserted i LEFT JOIN users a ON a.id=i.actor_id`,
        [
          ids,
          actor,
          type,
          category,
          clip(title, 200),
          clip(body, 500),
          clip(link, 300),
          entity[0] ?? null,
          entity[1] ?? null,
          key,
        ],
      );
      try {
        publish(
          result.rows.map(({ user_id, ...rest }) => ({
            to: user_id,
            event: "notification",
            payload: { ...rest, read: false },
          })),
        );
      } catch {
        /* live delivery is best effort */
      }
      return result.rows.length;
    } catch (error) {
      console.error("notification failed:", error.message);
      return 0;
    }
  }
  /** Remove a still-unread notification, for example when a like is taken back. */
  async function unnotify(userId, key, db = { query }) {
    try {
      const removed = await db.query(
        "DELETE FROM notifications WHERE user_id=$1 AND dedupe_key=$2 AND read_at IS NULL RETURNING id",
        [userId, key],
      );
      publish(
        removed.rows.map((row) => ({
          to: userId,
          event: "notification:removed",
          payload: { id: row.id },
        })),
      );
    } catch (error) {
      console.error("notification cleanup failed:", error.message);
    }
  }
  /** Notify every active admin. */
  async function notifyAdmins(input, db = { query }) {
    try {
      const admins = await db.query(
        "SELECT id FROM users WHERE role='admin' AND account_status='active'",
      );
      return await notify({ ...input, to: admins.rows.map((row) => row.id) }, db);
    } catch (error) {
      console.error("notification failed:", error.message);
      return 0;
    }
  }
  const interestSources = {
    course: ["courses", "course_categories", "course_id"],
    contest: ["contests", "contest_categories", "contest_id"],
    webinar: ["webinars", "webinar_categories", "webinar_id"],
    job: ["jobs", "job_categories", "job_id"],
  };
  /** Notify active learners whose interests match a course, contest, webinar or job. */
  async function notifyInterested(kind, id, input, db = { query }) {
    try {
      const [table, junction, column] = interestSources[kind];
      const people = await db.query(
        `SELECT DISTINCT ui.user_id FROM user_interests ui JOIN users u ON u.id=ui.user_id
         WHERE u.role='learner' AND u.account_status='active' AND ui.interest_id IN (
           SELECT category_id FROM ${junction} WHERE ${column}=$1
           UNION SELECT category_id FROM ${table} WHERE id=$1 AND category_id IS NOT NULL)
         LIMIT 5000`,
        [id],
      );
      return await notify(
        { ...input, to: people.rows.map((row) => row.user_id), entity: [kind, id], key: `new:${kind}:${id}` },
        db,
      );
    } catch (error) {
      console.error("notification failed:", error.message);
      return 0;
    }
  }
  /** Tell an applicant that a hirer shortlisted, accepted or rejected their application. */
  async function notifyApplicationStatus(jobId, applicantId, status, actor) {
    try {
      if (!["shortlisted", "accepted", "rejected"].includes(status)) return 0;
      const job = (await query("SELECT title FROM jobs WHERE id=$1", [jobId])).rows[0];
      if (!job) return 0;
      const copy = {
        shortlisted: [
          `You were shortlisted for “${job.title}”`,
          "The hirer is interested in your profile.",
        ],
        accepted: [
          `Your application for “${job.title}” was accepted`,
          "Congratulations! The hirer will be in touch with you soon.",
        ],
        rejected: [
          `Your application for “${job.title}” was not selected`,
          "Don’t give up, there are more jobs waiting for you.",
        ],
      }[status];
      return await notify({
        to: applicantId,
        actor,
        type: "job_application_status",
        title: copy[0],
        body: copy[1],
        link: `/jobs/${jobId}`,
        entity: ["job", jobId],
        key: `jobapp:${jobId}:${applicantId}:${status}`,
      });
    } catch (error) {
      console.error("notification failed:", error.message);
      return 0;
    }
  }
  return {
    notify,
    unnotify,
    notifyAdmins,
    notifyInterested,
    notifyApplicationStatus,
  };
}
