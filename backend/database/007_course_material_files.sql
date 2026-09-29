BEGIN;

-- Course materials can now be videos, documents, text or other files.
-- Uploaded files live in backend storage; the database keeps only the file URL
-- (a storage path like /uploads/course-materials/<course>/<file>, or a full
-- https:// URL if the files are later moved to Supabase Storage / S3 / a CDN).

ALTER TABLE course_materials
    ADD COLUMN IF NOT EXISTS file_url  TEXT,
    ADD COLUMN IF NOT EXISTS file_name VARCHAR(255),
    ADD COLUMN IF NOT EXISTS file_size BIGINT;

-- Exactly one content source is still required, now including file_url.
ALTER TABLE course_materials DROP CONSTRAINT IF EXISTS course_material_has_content;
ALTER TABLE course_materials
    ADD CONSTRAINT course_material_has_content CHECK (
        num_nonnulls(content_blob, content_text, external_url, file_url) = 1
    );

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'course_materials'::regclass AND conname = 'course_material_file_consistency'
    ) THEN
        ALTER TABLE course_materials ADD CONSTRAINT course_material_file_consistency CHECK (
            (file_url IS NULL AND file_name IS NULL AND file_size IS NULL)
            OR (file_url IS NOT NULL AND mime_type IS NOT NULL AND file_size >= 0)
        );
    END IF;
END;
$$;

-- Learner progress needs no new table: completed_course_materials already records
-- which materials a learner has finished. Opening a text lesson, watching a video
-- or downloading a file now adds a row there automatically, and the progress bar
-- is (completed rows) / (materials in the course).
CREATE INDEX IF NOT EXISTS idx_course_materials_course ON course_materials (course_id);
CREATE INDEX IF NOT EXISTS idx_completed_materials_user ON completed_course_materials (user_id, course_id);

COMMIT;
