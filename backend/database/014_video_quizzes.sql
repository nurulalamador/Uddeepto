BEGIN;

-- Check-point questions for video lessons. While a learner watches, the video stops at
-- 1/3 (checkpoint 1) and 2/3 (checkpoint 2) of its length and again at the end (checkpoint 3).
-- The learner must answer correctly to continue; passing checkpoint 3 completes the material.
--
-- Questions are written by Gemini from the course title and the lesson title (the video file itself
-- is never sent) the first time a learner needs them, and are then reused for everyone.
-- source_key is a fingerprint of those titles, so renaming a course or a lesson makes new questions.
CREATE TABLE IF NOT EXISTS material_quiz_questions (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    material_id   UUID NOT NULL REFERENCES course_materials(id) ON DELETE CASCADE,
    checkpoint    SMALLINT NOT NULL CHECK (checkpoint BETWEEN 1 AND 3),
    position      SMALLINT NOT NULL DEFAULT 0,
    question      TEXT NOT NULL,
    options       JSONB NOT NULL,
    correct_index SMALLINT NOT NULL CHECK (correct_index BETWEEN 0 AND 5),
    explanation   TEXT,
    source_key    VARCHAR(64) NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_material_quiz_questions_material
    ON material_quiz_questions (material_id, checkpoint, position);

-- Which checkpoints a learner has passed in a material.
CREATE TABLE IF NOT EXISTS material_quiz_passes (
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    material_id UUID NOT NULL REFERENCES course_materials(id) ON DELETE CASCADE,
    checkpoint  SMALLINT NOT NULL CHECK (checkpoint BETWEEN 1 AND 3),
    passed_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, material_id, checkpoint)
);

COMMIT;
