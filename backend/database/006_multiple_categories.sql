BEGIN;

-- Allow courses, contests, webinars, jobs and communities to belong to several
-- interest categories. The existing category_id column stays as the primary
-- (first selected) category so older queries keep working.

CREATE TABLE IF NOT EXISTS course_categories (
    course_id   UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES interest_categories(id) ON DELETE RESTRICT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (course_id, category_id)
);

CREATE TABLE IF NOT EXISTS contest_categories (
    contest_id  UUID NOT NULL REFERENCES contests(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES interest_categories(id) ON DELETE RESTRICT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (contest_id, category_id)
);

CREATE TABLE IF NOT EXISTS webinar_categories (
    webinar_id  UUID NOT NULL REFERENCES webinars(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES interest_categories(id) ON DELETE RESTRICT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (webinar_id, category_id)
);

CREATE TABLE IF NOT EXISTS job_categories (
    job_id      UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES interest_categories(id) ON DELETE RESTRICT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (job_id, category_id)
);

CREATE TABLE IF NOT EXISTS community_categories (
    community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
    category_id  UUID NOT NULL REFERENCES interest_categories(id) ON DELETE RESTRICT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (community_id, category_id)
);

CREATE INDEX IF NOT EXISTS idx_course_categories_category ON course_categories (category_id);
CREATE INDEX IF NOT EXISTS idx_contest_categories_category ON contest_categories (category_id);
CREATE INDEX IF NOT EXISTS idx_webinar_categories_category ON webinar_categories (category_id);
CREATE INDEX IF NOT EXISTS idx_job_categories_category ON job_categories (category_id);
CREATE INDEX IF NOT EXISTS idx_community_categories_category ON community_categories (category_id);

-- Backfill from each record's existing single category.
INSERT INTO course_categories (course_id, category_id)
SELECT id, category_id FROM courses WHERE category_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO contest_categories (contest_id, category_id)
SELECT id, category_id FROM contests WHERE category_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO webinar_categories (webinar_id, category_id)
SELECT id, category_id FROM webinars WHERE category_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO job_categories (job_id, category_id)
SELECT id, category_id FROM jobs WHERE category_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO community_categories (community_id, category_id)
SELECT id, category_id FROM communities WHERE category_id IS NOT NULL
ON CONFLICT DO NOTHING;

COMMIT;
