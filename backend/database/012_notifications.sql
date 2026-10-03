BEGIN;

-- In-app notifications for every role. One row per recipient.
--   type       what happened (post_like, job_application_received, contest_result, ...)
--   category   the group the UI filters by: social, jobs, contests, courses, webinars,
--              communities, system, admin
--   link       the frontend path to open when the notification is clicked
--   dedupe_key stops the same event notifying the same person twice (for example
--              liking, unliking and liking a post again)
CREATE TABLE IF NOT EXISTS notifications (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    actor_id    UUID REFERENCES users(id) ON DELETE SET NULL,
    type        VARCHAR(60) NOT NULL,
    category    VARCHAR(30) NOT NULL DEFAULT 'system',
    title       VARCHAR(200) NOT NULL,
    body        TEXT,
    link        VARCHAR(300),
    entity_type VARCHAR(40),
    entity_id   UUID,
    dedupe_key  VARCHAR(200),
    read_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT notifications_category_check CHECK (
        category IN ('social', 'jobs', 'contests', 'courses', 'webinars', 'communities', 'system', 'admin')
    )
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created
    ON notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
    ON notifications (user_id) WHERE read_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_dedupe
    ON notifications (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL;

COMMIT;
