import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { once } from "node:events";
import { db, query, server } from "./harness.js";

test("community report API validates, deduplicates, and protects posts", async () => {
  let schema = await readFile(
    new URL("../../backend/database/001_initial_schema.sql", import.meta.url),
    "utf8",
  );
  schema = schema
    .replace(/CREATE EXTENSION IF NOT EXISTS (pgcrypto|citext);/g, "")
    .replace(/\bCITEXT\b/g, "TEXT");
  await db.exec(schema);
  await db.exec(await readFile(new URL("../../backend/database/012_notifications.sql", import.meta.url), "utf8"));

  let source = await readFile(
    new URL("../../backend/services/community/src/server.js", import.meta.url),
    "utf8",
  );
  // The service file may use single or double quotes (it is auto-formatted), so match both.
  source = source
    .replace(/(['"])express\1/, () => JSON.stringify(import.meta.resolve("express")))
    .replace(/(['"])@uddeepto\/common\1/, () => JSON.stringify(new URL("./harness.js", import.meta.url).href));
  await import("data:text/javascript;base64," + Buffer.from(source).toString("base64"));
  await once(server, "listening");

  const user = async (name) =>
    (await query(
      "INSERT INTO users(name,email,username,password_hash) VALUES($1,$2,$3,'test') RETURNING id",
      [name, `${name}@example.com`, name.toLowerCase()],
    )).rows[0].id;
  const creator = await user("Creator");
  const reporter = await user("Reporter");
  const category = (await query(
    "INSERT INTO interest_categories(name,slug,icon) VALUES('Design','design','palette') RETURNING id",
  )).rows[0].id;
  const post = async (owner, visibility = "public") =>
    (await query(
      "INSERT INTO showcase_posts(creator_id,category_id,content,visibility) VALUES($1,$2,'A project update',$3) RETURNING id",
      [owner, category, visibility],
    )).rows[0].id;
  const firstPost = await post(creator);
  const secondPost = await post(creator);
  const privatePost = await post(creator, "private");
  const base = `http://127.0.0.1:${server.address().port}`;
  const report = (id, as, body) => fetch(`${base}/showcase/${id}/report`, {
    method: "POST",
    headers: { "x-test-user": as, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  try {
    const valid = await report(firstPost, reporter, { reason: "spam", details: "Copied work" });
    assert.equal(valid.status, 201);
    assert.deepEqual(await valid.json(), { reported: true });

    const duplicate = await report(firstPost, reporter, { reason: "spam" });
    assert.equal(duplicate.status, 409);

    const invalidReason = await report(secondPost, reporter, { reason: "not-a-reason" });
    assert.equal(invalidReason.status, 422);

    const tooLong = await report(secondPost, reporter, { reason: "other", details: "x".repeat(2001) });
    assert.equal(tooLong.status, 422);

    const ownPost = await report(firstPost, creator, { reason: "other" });
    assert.equal(ownPost.status, 409);

    const privateContent = await report(privatePost, reporter, { reason: "other" });
    assert.equal(privateContent.status, 404);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await db.close();
  }
});
