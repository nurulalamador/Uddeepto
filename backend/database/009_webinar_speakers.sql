BEGIN;

-- Webinars can have several speakers, picked from the instructor profiles (at least one is
-- enforced by the admin API). Removing an instructor just removes them from the speaker lists.
CREATE TABLE IF NOT EXISTS webinar_speakers (
    webinar_id    UUID NOT NULL REFERENCES webinars(id) ON DELETE CASCADE,
    instructor_id UUID NOT NULL REFERENCES instructors(id) ON DELETE CASCADE,
    sort_order    INTEGER NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (webinar_id, instructor_id)
);

CREATE INDEX IF NOT EXISTS idx_webinar_speakers_instructor ON webinar_speakers (instructor_id);

-- Link to the recorded session (YouTube, Vimeo, Google Drive, ...), added after the webinar ends.
ALTER TABLE webinars ADD COLUMN IF NOT EXISTS recording_url TEXT;

COMMIT;
