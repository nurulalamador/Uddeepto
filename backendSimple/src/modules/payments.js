import express from "express";
import {
  createApp,
  query,
  tx,
  asyncHandler,
  auth,
  allow,
  ApiError,
  page,
} from "../common.js";
const app = createApp("payments"),
  r = express.Router();
r.use(auth());
r.get(
  "/",
  asyncHandler(async (q, s) => {
    const { limit, offset } = page(q);
    const admin = ["admin", "moderator"].includes(q.user.role);
    s.json(
      (
        await query(
          `SELECT * FROM payments ${admin ? "" : "WHERE user_id=$3"} ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
          admin ? [limit, offset] : [limit, offset, q.user.sub],
        )
      ).rows,
    );
  }),
);
r.post(
  "/intent",
  asyncHandler(async (q, s) => {
    const { course_id, contest_id } = q.body;
    if (!!course_id + !!contest_id !== 1)
      throw new ApiError(
        422,
        "Exactly one of course_id or contest_id is required",
      );
    const src = course_id
      ? (
          await query(
            "SELECT price amount,currency FROM courses WHERE id=$1 AND status='published'",
            [course_id],
          )
        ).rows[0]
      : (
          await query(
            "SELECT entry_fee amount,currency FROM contests WHERE id=$1 AND status='published'",
            [contest_id],
          )
        ).rows[0];
    if (!src) throw new ApiError(404, "Purchasable item not found");
    const x = await query(
      `INSERT INTO payments(user_id,course_id,contest_id,amount,currency) VALUES($1,$2,$3,$4,$5) RETURNING *`,
      [q.user.sub, course_id, contest_id, src.amount, src.currency],
    );
    s.status(201).json(x.rows[0]);
  }),
);
r.post(
  "/:id/confirm",
  allow("admin"),
  asyncHandler(async (q, s) => {
    const x = await tx(async (db) => {
      const p = (
        await db.query(
          `UPDATE payments SET status='paid',provider=$1,provider_transaction_id=$2,paid_at=now() WHERE id=$3 AND status='pending' RETURNING *`,
          [q.body.provider, q.body.provider_transaction_id, q.params.id],
        )
      ).rows[0];
      if (!p) throw new ApiError(409, "Payment cannot be confirmed");
      if (p.course_id)
        await db.query(
          `INSERT INTO course_enrollments(course_id,user_id,price_paid,currency) VALUES($1,$2,$3,$4) ON CONFLICT(course_id,user_id) DO UPDATE SET status='active',price_paid=$3`,
          [p.course_id, p.user_id, p.amount, p.currency],
        );
      if (p.contest_id)
        await db.query(
          `INSERT INTO contest_participants(contest_id,participant_id,payment_status) VALUES($1,$2,'paid') ON CONFLICT(contest_id,participant_id) DO UPDATE SET payment_status='paid'`,
          [p.contest_id, p.user_id],
        );
      return p;
    });
    s.json(x);
  }),
);
app.use("/", r);
export default app;
