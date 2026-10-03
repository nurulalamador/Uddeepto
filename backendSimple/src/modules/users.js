import express from "express";
import { z } from "zod";
import {
  createApp,
  query,
  asyncHandler,
  auth,
  allow,
  upload,
  ApiError,
  publicUser,
  page,
  updateRow,
} from "../common.js";
const app = createApp("users"),
  r = express.Router();
r.get(
  "/interests",
  asyncHandler(async (q, s) =>
    s.json(
      (
        await query(
          "SELECT * FROM interest_categories WHERE is_active=true ORDER BY name",
        )
      ).rows,
    ),
  ),
);
r.post(
  "/interests",
  auth(),
  allow("admin"),
  asyncHandler(async (q, s) =>
    s
      .status(201)
      .json(
        (
          await query(
            "INSERT INTO interest_categories(name,slug,icon,description) VALUES($1,$2,$3,$4) RETURNING *",
            [q.body.name, q.body.slug, q.body.icon, q.body.description],
          )
        ).rows[0],
      ),
  ),
);
r.get(
  "/me",
  auth(),
  asyncHandler(async (q, s) => {
    const u = (
      await query(`SELECT ${publicUser} FROM users WHERE id=$1`, [q.user.sub])
    ).rows[0];
    if (!u) throw new ApiError(404, "User not found");
    u.interests = (
      await query(
        "SELECT i.* FROM interest_categories i JOIN user_interests ui ON ui.interest_id=i.id WHERE ui.user_id=$1",
        [q.user.sub],
      )
    ).rows;
    s.json(u);
  }),
);
r.patch(
  "/me",
  auth(),
  asyncHandler(async (q, s) =>
    s.json(
      await updateRow("users", q.user.sub, q.body, ["name", "username", "bio"]),
    ),
  ),
);
r.put(
  "/me/picture",
  auth(),
  upload.single("picture"),
  asyncHandler(async (q, s) => {
    if (!q.file) throw new ApiError(400, "picture file required");
    await query(
      "UPDATE users SET picture=$1,picture_mime_type=$2 WHERE id=$3",
      [q.file.buffer, q.file.mimetype, q.user.sub],
    );
    s.status(204).end();
  }),
);
r.get(
  "/:id/picture",
  asyncHandler(async (q, s) => {
    const x = (
      await query("SELECT picture,picture_mime_type FROM users WHERE id=$1", [
        q.params.id,
      ])
    ).rows[0];
    if (!x?.picture) throw new ApiError(404, "Picture not found");
    s.type(x.picture_mime_type).send(x.picture);
  }),
);
r.put(
  "/me/interests",
  auth(),
  asyncHandler(async (q, s) => {
    const ids = z.array(z.string().uuid()).max(30).parse(q.body.interestIds);
    await query("DELETE FROM user_interests WHERE user_id=$1", [q.user.sub]);
    for (const id of ids)
      await query(
        "INSERT INTO user_interests(user_id,interest_id) VALUES($1,$2)",
        [q.user.sub, id],
      );
    s.json({ interestIds: ids });
  }),
);
r.get(
  "/:id",
  auth(false),
  asyncHandler(async (q, s) => {
    const u = (
      await query(
        `SELECT id,name,username,role,bio,created_at FROM users WHERE id=$1 AND account_status='active'`,
        [q.params.id],
      )
    ).rows[0];
    if (!u) throw new ApiError(404, "User not found");
    s.json(u);
  }),
);
r.get(
  "/",
  auth(),
  allow("admin", "moderator"),
  asyncHandler(async (q, s) => {
    const { limit, offset } = page(q);
    s.json(
      (
        await query(
          `SELECT ${publicUser} FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
          [limit, offset],
        )
      ).rows,
    );
  }),
);
app.use("/", r);
export default app;
