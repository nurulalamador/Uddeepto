import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

test("migration converts old instructor users into profiles and reassigns their courses", async () => {
  const db = new PGlite();
  const migration = await readFile(
    new URL("../../backend/database/004_instructors.sql", import.meta.url),
    "utf8",
  );

  try {
    await db.exec(`
      CREATE TYPE user_role AS ENUM ('learner', 'instructor', 'hirer', 'moderator', 'admin');
      CREATE TABLE users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(150) NOT NULL,
        role user_role NOT NULL DEFAULT 'learner',
        picture BYTEA,
        picture_mime_type VARCHAR(100),
        bio TEXT
      );
      CREATE TABLE courses (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        creator_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT
      );
      CREATE FUNCTION set_updated_at() RETURNS TRIGGER LANGUAGE plpgsql AS $$
      BEGIN NEW.updated_at = CURRENT_TIMESTAMP; RETURN NEW; END;
      $$;
      ALTER TABLE users ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
      INSERT INTO users(id,name,role,picture,picture_mime_type,bio) VALUES
        ('10000000-0000-4000-8000-000000000001','Mina Instructor','instructor',decode('89504e47','hex'),'image/png','Frontend and product design.'),
        ('10000000-0000-4000-8000-000000000002','Nabil Learner','learner',NULL,NULL,NULL);
      INSERT INTO courses(id,creator_id) VALUES
        ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001');
    `);

    await db.exec(migration);

    const converted = await db.query(
      "SELECT id,name,image_mime_type,details FROM instructors WHERE legacy_user_id=$1",
      ["10000000-0000-4000-8000-000000000001"],
    );
    assert.equal(converted.rows.length, 1);
    assert.equal(converted.rows[0].name, "Mina Instructor");
    assert.equal(converted.rows[0].image_mime_type, "image/png");
    assert.equal(converted.rows[0].details, "Frontend and product design.");

    const assignment = await db.query(
      "SELECT instructor_id FROM courses WHERE id=$1",
      ["20000000-0000-4000-8000-000000000001"],
    );
    assert.equal(assignment.rows[0].instructor_id, converted.rows[0].id);
    const migratedUser = await db.query(
      "SELECT role::text role FROM users WHERE id=$1",
      ["10000000-0000-4000-8000-000000000001"],
    );
    assert.equal(migratedUser.rows[0].role, "learner");

    const enumValues = await db.query(
      "SELECT enumlabel FROM pg_enum WHERE enumtypid='user_role'::regtype ORDER BY enumsortorder",
    );
    assert.equal(enumValues.rows.some((row) => row.enumlabel === "instructor"), false);

    await db.exec(migration);
    assert.equal((await db.query("SELECT count(*) FROM instructors")).rows[0].count, 1);
  } finally {
    await db.close();
  }
});
