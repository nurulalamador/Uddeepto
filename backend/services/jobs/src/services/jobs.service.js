import { query, notifyAdmins, notifyInterested } from "@uddeepto/common";
// After a job is posted: tell the admins when a hirer posted it, and tell interested
// learners when it is already open.
export async function announceJob(job, user) {
  try {
    if (user.role === "hirer") {
      const hirer = (await query("SELECT name FROM users WHERE id=$1", [user.sub])).rows[0]?.name || "A hirer";
      await notifyAdmins({
        actor: user.sub,
        type: "job_posted",
        title: `New job posted: ${job.title}`,
        body: `By ${hirer}`,
        link: "/jobs",
        entity: ["job", job.id],
        key: `posted:${job.id}`
      });
    }
    if (job.status === "open") await notifyInterested("job", job.id, {
      actor: user.sub,
      type: "job_new",
      title: `New job: ${job.title}`,
      body: "A job that matches your interests is open for applications.",
      link: `/jobs/${job.id}`
    });
  } catch (error) {
    console.error("notification failed:", error.message);
  }
}
