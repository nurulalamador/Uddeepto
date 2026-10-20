BEGIN;

-- A learner's current CV (one per person). It is either a PDF they uploaded or one made in the CV Generator.
-- For a generated CV, template and cv_data keep what was typed in, so it can be opened and edited again.
-- Job applications copy the PDF at the time of applying, so changing the CV later never alters an application.
CREATE TABLE IF NOT EXISTS user_cvs (
    user_id    UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    file_name  VARCHAR(200) NOT NULL,
    file_size  INTEGER NOT NULL CHECK (file_size > 0),
    mime_type  VARCHAR(100) NOT NULL DEFAULT 'application/pdf',
    file_data  BYTEA NOT NULL,
    source     VARCHAR(20) NOT NULL CHECK (source IN ('uploaded', 'generated')),
    template   VARCHAR(40),
    cv_data    JSONB,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMIT;
