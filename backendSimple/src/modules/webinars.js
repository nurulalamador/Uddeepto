import express from "express";
import {
  createApp,
  resourceRouter,
  query,
  asyncHandler,
  auth,
  ApiError,
} from "../common.js";
const app = createApp("webinars"),
  r = express.Router();
r.use(
  "/",
  resourceRouter({
    table: "webinars",
    fields: [
      "name",
      "description",
      "category_id",
      "meeting_url",
      "capacity",
      "status",
      "starting_time",
      "ending_time",
    ],
    required: [
      "name",
      "description",
      "category_id",
      "starting_time",
      "ending_time",
    ],
    createRoles: ["admin"],
    search: ["name", "description"],
    adminOnlyFields: ["status"],
  }),
);
r.post(
  "/:id/register",
  auth(),
  asyncHandler(async (q, s) => {
    const w = (
      await query(
        `SELECT capacity,status,(SELECT count(*) FROM webinar_participants WHERE webinar_id=$1 AND status='registered') count FROM webinars WHERE id=$1`,
        [q.params.id],
      )
    ).rows[0];
    if (!w) throw new ApiError(404, "Webinar not found");
    if (
      !["scheduled", "live"].includes(w.status) ||
      (w.capacity && Number(w.count) >= w.capacity)
    )
      throw new ApiError(409, "Registration unavailable");
    await query(
      `INSERT INTO webinar_participants(webinar_id,participant_id) VALUES($1,$2) ON CONFLICT DO NOTHING`,
      [q.params.id, q.user.sub],
    );
    s.status(201).json({ registered: true });
  }),
);
app.get(
  "/me/registrations",
  auth(),
  asyncHandler(async (q, s) =>
    s.json(
      (
        await query(
          "SELECT p.*,w.name,w.starting_time FROM webinar_participants p JOIN webinars w ON w.id=p.webinar_id WHERE p.participant_id=$1",
          [q.user.sub],
        )
      ).rows,
    ),
  ),
);
app.use("/", r);
export default app;
