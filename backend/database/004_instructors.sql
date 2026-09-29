BEGIN;

-- Instructor profiles are platform records, not login roles. Keep the original
-- user row as a learner account so its history and course ownership survive.
CREATE TABLE IF NOT EXISTS instructors (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    legacy_user_id    UUID UNIQUE REFERENCES users(id) ON DELETE SET NULL,
    name              VARCHAR(150) NOT NULL,
    image_blob        BYTEA,
    image_mime_type   VARCHAR(100),
    details           TEXT NOT NULL DEFAULT '',
    created_at        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT instructors_image_consistency CHECK (
        (image_blob IS NULL AND image_mime_type IS NULL)
        OR (image_blob IS NOT NULL AND image_mime_type IS NOT NULL)
    )
);

ALTER TABLE courses ADD COLUMN IF NOT EXISTS instructor_id UUID;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'courses'::regclass
          AND conname = 'courses_instructor_id_fkey'
    ) THEN
        ALTER TABLE courses
            ADD CONSTRAINT courses_instructor_id_fkey
            FOREIGN KEY (instructor_id) REFERENCES instructors(id) ON DELETE SET NULL;
    END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_courses_instructor ON courses (instructor_id);

-- Preserve old instructor accounts as learner logins, while transferring their
-- profile fields and assigning their existing courses to the new entity.
INSERT INTO instructors(legacy_user_id, name, image_blob, image_mime_type, details)
SELECT id, name, picture, picture_mime_type, COALESCE(bio, '')
FROM users
WHERE role::text = 'instructor'
ON CONFLICT (legacy_user_id) DO NOTHING;

UPDATE courses c
SET instructor_id = i.id
FROM instructors i
WHERE i.legacy_user_id = c.creator_id
  AND c.instructor_id IS NULL;

UPDATE users SET role = 'learner' WHERE role::text = 'instructor';

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_enum e
        JOIN pg_type t ON t.oid = e.enumtypid
        WHERE t.typname = 'user_role'
          AND e.enumlabel = 'instructor'
    ) THEN
        EXECUTE 'ALTER TABLE users ALTER COLUMN role DROP DEFAULT';
        EXECUTE 'CREATE TYPE user_role_without_instructor AS ENUM (''learner'', ''hirer'', ''moderator'', ''admin'')';
        EXECUTE 'ALTER TABLE users ALTER COLUMN role TYPE user_role_without_instructor USING role::text::user_role_without_instructor';
        EXECUTE 'DROP TYPE user_role';
        EXECUTE 'ALTER TYPE user_role_without_instructor RENAME TO user_role';
        EXECUTE 'ALTER TABLE users ALTER COLUMN role SET DEFAULT ''learner''::user_role';
    END IF;
END;
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'instructors_set_updated_at'
          AND tgrelid = 'instructors'::regclass
          AND NOT tgisinternal
    ) THEN
        CREATE TRIGGER instructors_set_updated_at
        BEFORE UPDATE ON instructors
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    END IF;
END;
$$;

COMMIT;
