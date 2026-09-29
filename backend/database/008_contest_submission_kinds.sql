BEGIN;

-- 1. Each interest category says what kind of entry its contests expect:
--    code  = code + language, text = written answer, image = photo/artwork upload, audio = recording upload.
ALTER TABLE interest_categories
    ADD COLUMN IF NOT EXISTS submission_kind VARCHAR(20) NOT NULL DEFAULT 'text';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'interest_categories'::regclass AND conname = 'interest_categories_submission_kind'
    ) THEN
        ALTER TABLE interest_categories ADD CONSTRAINT interest_categories_submission_kind
            CHECK (submission_kind IN ('code', 'text', 'image', 'audio'));
    END IF;
END;
$$;

-- Set sensible values for the existing categories (change them later from Admin > Interests).
UPDATE interest_categories SET submission_kind = 'code'
WHERE name IN ('Competitive Programming', 'Web Development', 'Mobile App');

UPDATE interest_categories SET submission_kind = 'image'
WHERE name IN ('Graphic Design', 'Photography', 'Arts and Crafts');

UPDATE interest_categories SET submission_kind = 'audio'
WHERE name IN ('Music');

-- 2. Image and audio entries are saved in backend storage; the database keeps only the file URL,
--    the same way course materials work.
ALTER TABLE contest_submissions
    ADD COLUMN IF NOT EXISTS file_url  TEXT,
    ADD COLUMN IF NOT EXISTS file_name VARCHAR(255),
    ADD COLUMN IF NOT EXISTS file_size BIGINT;

ALTER TABLE contest_submissions DROP CONSTRAINT IF EXISTS contest_submission_has_content;
ALTER TABLE contest_submissions
    ADD CONSTRAINT contest_submission_has_content CHECK (
        num_nonnulls(submission_blob, content, file_url) >= 1
    );

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'contest_submissions'::regclass AND conname = 'contest_submission_file_consistency'
    ) THEN
        ALTER TABLE contest_submissions ADD CONSTRAINT contest_submission_file_consistency CHECK (
            file_url IS NULL OR (mime_type IS NOT NULL AND file_size >= 0)
        );
    END IF;
END;
$$;

COMMIT;
