BEGIN;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS cover_image BYTEA,
  ADD COLUMN IF NOT EXISTS cover_image_mime_type VARCHAR(100);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'users'::regclass AND conname = 'users_cover_consistency'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_cover_consistency CHECK (
      (cover_image IS NULL AND cover_image_mime_type IS NULL)
      OR (cover_image IS NOT NULL AND cover_image_mime_type IS NOT NULL)
    );
  END IF;
END;
$$;

ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS cover_image BYTEA,
  ADD COLUMN IF NOT EXISTS cover_image_mime_type VARCHAR(100);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'courses'::regclass AND conname = 'courses_cover_consistency'
  ) THEN
    ALTER TABLE courses ADD CONSTRAINT courses_cover_consistency CHECK (
      (cover_image IS NULL AND cover_image_mime_type IS NULL)
      OR (cover_image IS NOT NULL AND cover_image_mime_type IS NOT NULL)
    );
  END IF;
END;
$$;

ALTER TABLE instructors
  ADD COLUMN IF NOT EXISTS designation VARCHAR(150) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS social_links JSONB NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'instructors'::regclass AND conname = 'instructors_social_links_object'
  ) THEN
    ALTER TABLE instructors ADD CONSTRAINT instructors_social_links_object
      CHECK (jsonb_typeof(social_links) = 'object');
  END IF;
END;
$$;

COMMIT;
