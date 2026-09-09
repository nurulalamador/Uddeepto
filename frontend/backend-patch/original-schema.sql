-- Uddeepto (উদ্দীপ্ত) - PostgreSQL schema
-- Target: PostgreSQL 15+

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------

CREATE TYPE user_role AS ENUM ('learner', 'instructor', 'hirer', 'moderator', 'admin');
CREATE TYPE account_status AS ENUM ('active', 'suspended', 'deactivated');
CREATE TYPE publication_status AS ENUM ('draft', 'published', 'archived');
CREATE TYPE enrollment_status AS ENUM ('active', 'completed', 'cancelled', 'refunded');
CREATE TYPE membership_status AS ENUM ('pending', 'approved', 'rejected', 'blocked');
CREATE TYPE reaction_kind AS ENUM ('like', 'love', 'celebrate', 'insightful', 'curious');
CREATE TYPE report_status AS ENUM ('pending', 'reviewing', 'resolved', 'dismissed');
CREATE TYPE contest_status AS ENUM ('draft', 'published', 'cancelled', 'completed');
CREATE TYPE contest_type AS ENUM ('competitive_programming', 'drawing', 'singing', 'general');
CREATE TYPE submission_status AS ENUM ('submitted', 'judging', 'accepted', 'rejected', 'disqualified');
CREATE TYPE webinar_status AS ENUM ('draft', 'scheduled', 'live', 'completed', 'cancelled');
CREATE TYPE attendance_status AS ENUM ('registered', 'attended', 'absent', 'cancelled');
CREATE TYPE job_type AS ENUM ('permanent', 'contract', 'internship', 'part_time', 'freelance', 'one_time');
CREATE TYPE job_status AS ENUM ('draft', 'open', 'closed', 'filled', 'cancelled');
CREATE TYPE application_status AS ENUM ('applied', 'shortlisted', 'accepted', 'rejected', 'withdrawn');
CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'failed', 'refunded', 'cancelled');

-- -----------------------------------------------------------------------------
-- Common trigger
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;

-- -----------------------------------------------------------------------------
-- Users and interests
-- -----------------------------------------------------------------------------

CREATE TABLE users (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                VARCHAR(150) NOT NULL,
    email               CITEXT NOT NULL UNIQUE,
    username            CITEXT NOT NULL UNIQUE,
    password_hash       TEXT NOT NULL,
    role                user_role NOT NULL DEFAULT 'learner',
    picture             BYTEA,
    picture_mime_type   VARCHAR(100),
    bio                 TEXT,
    account_status      account_status NOT NULL DEFAULT 'active',
    email_verified_at   TIMESTAMPTZ,
    last_login_at       TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT users_email_not_blank CHECK (btrim(email::TEXT) <> ''),
    CONSTRAINT users_username_format CHECK (username::TEXT ~ '^[A-Za-z0-9_.-]{3,40}$'),
    CONSTRAINT users_picture_consistency CHECK (
        (picture IS NULL AND picture_mime_type IS NULL)
        OR (picture IS NOT NULL AND picture_mime_type IS NOT NULL)
    )
);

CREATE TABLE interest_categories (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        CITEXT NOT NULL UNIQUE,
    slug        CITEXT NOT NULL UNIQUE,
    icon        VARCHAR(100) NOT NULL,
    description TEXT,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT interest_categories_slug_format CHECK (slug::TEXT ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

CREATE TABLE user_interests (
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    interest_id UUID NOT NULL REFERENCES interest_categories(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, interest_id)
);

-- -----------------------------------------------------------------------------
-- Courses
-- -----------------------------------------------------------------------------

CREATE TABLE courses (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id            UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    title                 VARCHAR(250) NOT NULL,
    slug                  CITEXT NOT NULL UNIQUE,
    description           TEXT NOT NULL,
    cover_image           BYTEA,
    cover_image_mime_type VARCHAR(100),
    price                 NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
    currency              CHAR(3) NOT NULL DEFAULT 'BDT',
    category_id           UUID NOT NULL REFERENCES interest_categories(id) ON DELETE RESTRICT,
    status                publication_status NOT NULL DEFAULT 'draft',
    published_at          TIMESTAMPTZ,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT courses_cover_consistency CHECK (
        (cover_image IS NULL AND cover_image_mime_type IS NULL)
        OR (cover_image IS NOT NULL AND cover_image_mime_type IS NOT NULL)
    ),
    CONSTRAINT courses_currency_format CHECK (currency ~ '^[A-Z]{3}$')
);

CREATE TABLE course_materials (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id   UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    name        VARCHAR(250) NOT NULL,
    description TEXT,
    type        VARCHAR(50) NOT NULL,
    mime_type   VARCHAR(100),
    content_blob BYTEA,
    content_text TEXT,
    external_url TEXT,
    sort_order  INTEGER NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
    is_preview  BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT course_material_has_content CHECK (
        num_nonnulls(content_blob, content_text, external_url) = 1
    ),
    CONSTRAINT course_material_blob_mime CHECK (content_blob IS NULL OR mime_type IS NOT NULL),
    UNIQUE (course_id, sort_order),
    UNIQUE (id, course_id)
);

CREATE TABLE course_enrollments (
    course_id       UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status          enrollment_status NOT NULL DEFAULT 'active',
    price_paid      NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (price_paid >= 0),
    currency        CHAR(3) NOT NULL DEFAULT 'BDT',
    enrolled_at     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at    TIMESTAMPTZ,
    last_accessed_at TIMESTAMPTZ,
    PRIMARY KEY (course_id, user_id),
    CONSTRAINT course_enrollment_completion CHECK (
        (status = 'completed' AND completed_at IS NOT NULL) OR status <> 'completed'
    )
);

CREATE TABLE completed_course_materials (
    course_id    UUID NOT NULL,
    user_id      UUID NOT NULL,
    material_id  UUID NOT NULL,
    completed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (course_id, user_id, material_id),
    FOREIGN KEY (course_id, user_id)
        REFERENCES course_enrollments(course_id, user_id) ON DELETE CASCADE,
    FOREIGN KEY (material_id, course_id)
        REFERENCES course_materials(id, course_id) ON DELETE CASCADE
);

-- -----------------------------------------------------------------------------
-- Communities and chat
-- -----------------------------------------------------------------------------

CREATE TABLE communities (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id    UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    name          VARCHAR(150) NOT NULL,
    slug          CITEXT NOT NULL UNIQUE,
    description   TEXT,
    category_id   UUID NOT NULL REFERENCES interest_categories(id) ON DELETE RESTRICT,
    cover_image   BYTEA,
    cover_mime_type VARCHAR(100),
    requires_approval BOOLEAN NOT NULL DEFAULT TRUE,
    is_private    BOOLEAN NOT NULL DEFAULT FALSE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE community_members (
    community_id   UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
    member_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status         membership_status NOT NULL DEFAULT 'pending',
    is_moderator   BOOLEAN NOT NULL DEFAULT FALSE,
    requested_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    approved_at    TIMESTAMPTZ,
    approved_by    UUID REFERENCES users(id) ON DELETE SET NULL,
    PRIMARY KEY (community_id, member_id),
    CONSTRAINT community_approval_time CHECK (
        (status = 'approved' AND approved_at IS NOT NULL) OR status <> 'approved'
    )
);

CREATE TABLE community_chats (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
    name         VARCHAR(150) NOT NULL,
    description  TEXT,
    sort_order   INTEGER NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (community_id, name),
    UNIQUE (id, community_id)
);

CREATE TABLE community_chat_messages (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
    chat_id      UUID NOT NULL,
    sender_id    UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    reply_to_id  UUID REFERENCES community_chat_messages(id) ON DELETE SET NULL,
    content      TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at   TIMESTAMPTZ,
    FOREIGN KEY (chat_id, community_id)
        REFERENCES community_chats(id, community_id) ON DELETE CASCADE
);

CREATE TABLE community_chat_message_media (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id  UUID NOT NULL REFERENCES community_chat_messages(id) ON DELETE CASCADE,
    mime_type   VARCHAR(100) NOT NULL,
    media_blob  BYTEA NOT NULL,
    file_name   VARCHAR(255),
    file_size   BIGINT CHECK (file_size IS NULL OR file_size >= 0),
    sort_order  INTEGER NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE community_chat_message_reactions (
    message_id UUID NOT NULL REFERENCES community_chat_messages(id) ON DELETE CASCADE,
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reaction   reaction_kind NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (message_id, user_id, reaction)
);

-- -----------------------------------------------------------------------------
-- Showcase feed
-- -----------------------------------------------------------------------------

CREATE TABLE showcase_posts (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id  UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    category_id UUID NOT NULL REFERENCES interest_categories(id) ON DELETE RESTRICT,
    content     TEXT,
    visibility  VARCHAR(20) NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'followers', 'private')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at  TIMESTAMPTZ
);

CREATE TABLE showcase_post_media (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id     UUID NOT NULL REFERENCES showcase_posts(id) ON DELETE CASCADE,
    mime_type   VARCHAR(100) NOT NULL,
    media_blob  BYTEA NOT NULL,
    file_name   VARCHAR(255),
    alt_text    VARCHAR(500),
    sort_order  INTEGER NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE showcase_post_reactions (
    post_id     UUID NOT NULL REFERENCES showcase_posts(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reaction    reaction_kind NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (post_id, user_id, reaction)
);

CREATE TABLE showcase_post_comments (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id           UUID NOT NULL REFERENCES showcase_posts(id) ON DELETE CASCADE,
    commenter_id      UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    parent_comment_id UUID REFERENCES showcase_post_comments(id) ON DELETE CASCADE,
    content           TEXT NOT NULL CHECK (btrim(content) <> ''),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at        TIMESTAMPTZ
);

CREATE TABLE showcase_post_comment_reactions (
    comment_id UUID NOT NULL REFERENCES showcase_post_comments(id) ON DELETE CASCADE,
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reaction   reaction_kind NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (comment_id, user_id, reaction)
);

CREATE TABLE reported_showcase_posts (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id     UUID NOT NULL REFERENCES showcase_posts(id) ON DELETE CASCADE,
    reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reason      VARCHAR(100) NOT NULL,
    details     TEXT,
    status      report_status NOT NULL DEFAULT 'pending',
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    resolution_note TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (post_id, reporter_id)
);

-- -----------------------------------------------------------------------------
-- Contests
-- -----------------------------------------------------------------------------

CREATE TABLE contests (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id    UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    name          VARCHAR(250) NOT NULL,
    description   TEXT NOT NULL,
    category_id   UUID NOT NULL REFERENCES interest_categories(id) ON DELETE RESTRICT,
    type          contest_type NOT NULL DEFAULT 'general',
    entry_fee     NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (entry_fee >= 0),
    currency      CHAR(3) NOT NULL DEFAULT 'BDT',
    status        contest_status NOT NULL DEFAULT 'draft',
    max_participants INTEGER CHECK (max_participants IS NULL OR max_participants > 0),
    starting_time TIMESTAMPTZ NOT NULL,
    ending_time   TIMESTAMPTZ NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT contest_time_order CHECK (ending_time > starting_time)
);

CREATE TABLE contest_participants (
    contest_id       UUID NOT NULL REFERENCES contests(id) ON DELETE CASCADE,
    participant_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    participated_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    points           NUMERIC(12,2) NOT NULL DEFAULT 0,
    rank              INTEGER CHECK (rank IS NULL OR rank > 0),
    payment_status    payment_status NOT NULL DEFAULT 'pending',
    PRIMARY KEY (contest_id, participant_id)
);

CREATE TABLE contest_problems (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id     UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    contest_id     UUID NOT NULL REFERENCES contests(id) ON DELETE CASCADE,
    name           VARCHAR(250) NOT NULL,
    description    TEXT NOT NULL,
    sample_input   TEXT,
    sample_output  TEXT,
    points         NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (points >= 0),
    time_limit_ms  INTEGER CHECK (time_limit_ms IS NULL OR time_limit_ms > 0),
    memory_limit_mb INTEGER CHECK (memory_limit_mb IS NULL OR memory_limit_mb > 0),
    sort_order     INTEGER NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (contest_id, sort_order),
    UNIQUE (id, contest_id)
);

CREATE TABLE contest_submissions (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contest_id     UUID NOT NULL REFERENCES contests(id) ON DELETE CASCADE,
    problem_id     UUID,
    participant_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    mime_type      VARCHAR(100),
    submission_blob BYTEA,
    content        TEXT,
    language       VARCHAR(50),
    status         submission_status NOT NULL DEFAULT 'submitted',
    score          NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (score >= 0),
    feedback       TEXT,
    judged_by      UUID REFERENCES users(id) ON DELETE SET NULL,
    judged_at      TIMESTAMPTZ,
    submitted_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT contest_submission_has_content CHECK (
        num_nonnulls(submission_blob, content) >= 1
    ),
    CONSTRAINT contest_submission_blob_mime CHECK (submission_blob IS NULL OR mime_type IS NOT NULL),
    FOREIGN KEY (contest_id, participant_id)
        REFERENCES contest_participants(contest_id, participant_id) ON DELETE CASCADE,
    FOREIGN KEY (problem_id, contest_id)
        REFERENCES contest_problems(id, contest_id) ON DELETE CASCADE
);

-- -----------------------------------------------------------------------------
-- Webinars
-- -----------------------------------------------------------------------------

CREATE TABLE webinars (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          VARCHAR(250) NOT NULL,
    creator_id    UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    description   TEXT NOT NULL,
    category_id   UUID NOT NULL REFERENCES interest_categories(id) ON DELETE RESTRICT,
    meeting_url   TEXT,
    capacity      INTEGER CHECK (capacity IS NULL OR capacity > 0),
    status        webinar_status NOT NULL DEFAULT 'draft',
    starting_time TIMESTAMPTZ NOT NULL,
    ending_time   TIMESTAMPTZ NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT webinar_time_order CHECK (ending_time > starting_time)
);

CREATE TABLE webinar_participants (
    webinar_id      UUID NOT NULL REFERENCES webinars(id) ON DELETE CASCADE,
    participant_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status          attendance_status NOT NULL DEFAULT 'registered',
    registered_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    attended_at     TIMESTAMPTZ,
    PRIMARY KEY (webinar_id, participant_id)
);

-- -----------------------------------------------------------------------------
-- Jobs
-- -----------------------------------------------------------------------------

CREATE TABLE jobs (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id     UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    category_id    UUID REFERENCES interest_categories(id) ON DELETE SET NULL,
    title          VARCHAR(250) NOT NULL,
    description    TEXT NOT NULL,
    salary_min     NUMERIC(12,2) CHECK (salary_min IS NULL OR salary_min >= 0),
    salary_max     NUMERIC(12,2) CHECK (salary_max IS NULL OR salary_max >= 0),
    currency       CHAR(3) NOT NULL DEFAULT 'BDT',
    salary_period  VARCHAR(20) CHECK (salary_period IN ('hourly', 'daily', 'weekly', 'monthly', 'yearly', 'fixed')),
    location       VARCHAR(250),
    criteria       JSONB NOT NULL DEFAULT '[]'::JSONB,
    type           job_type NOT NULL,
    is_remote      BOOLEAN NOT NULL DEFAULT FALSE,
    status         job_status NOT NULL DEFAULT 'draft',
    application_deadline TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT jobs_salary_range CHECK (
        salary_min IS NULL OR salary_max IS NULL OR salary_max >= salary_min
    ),
    CONSTRAINT jobs_criteria_array CHECK (jsonb_typeof(criteria) = 'array')
);

CREATE TABLE job_applications (
    job_id          UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    applicant_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    cover_letter    TEXT,
    resume_blob     BYTEA,
    resume_mime_type VARCHAR(100),
    status          application_status NOT NULL DEFAULT 'applied',
    applied_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (job_id, applicant_id),
    CONSTRAINT job_resume_consistency CHECK (
        (resume_blob IS NULL AND resume_mime_type IS NULL)
        OR (resume_blob IS NOT NULL AND resume_mime_type IS NOT NULL)
    )
);

-- -----------------------------------------------------------------------------
-- Direct messaging
-- -----------------------------------------------------------------------------

CREATE TABLE conversations (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE conversation_members (
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_read_at    TIMESTAMPTZ,
    PRIMARY KEY (conversation_id, user_id)
);

CREATE TABLE messages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id       UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    reply_to_id     UUID REFERENCES messages(id) ON DELETE SET NULL,
    content         TEXT,
    sent_at         TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at      TIMESTAMPTZ
);

CREATE TABLE message_media (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id  UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    mime_type   VARCHAR(100) NOT NULL,
    media_blob  BYTEA NOT NULL,
    file_name   VARCHAR(255),
    file_size   BIGINT CHECK (file_size IS NULL OR file_size >= 0),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE message_reactions (
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reaction   reaction_kind NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (message_id, user_id, reaction)
);

-- -----------------------------------------------------------------------------
-- Payments (shared by paid courses, contests and future paid features)
-- -----------------------------------------------------------------------------

CREATE TABLE payments (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id               UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    course_id             UUID REFERENCES courses(id) ON DELETE SET NULL,
    contest_id            UUID REFERENCES contests(id) ON DELETE SET NULL,
    amount                NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
    currency              CHAR(3) NOT NULL DEFAULT 'BDT',
    status                payment_status NOT NULL DEFAULT 'pending',
    provider              VARCHAR(50),
    provider_transaction_id VARCHAR(255),
    metadata              JSONB NOT NULL DEFAULT '{}'::JSONB,
    paid_at               TIMESTAMPTZ,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT payment_one_purpose CHECK (num_nonnulls(course_id, contest_id) = 1)
);

-- -----------------------------------------------------------------------------
-- Helpful indexes
-- -----------------------------------------------------------------------------

CREATE INDEX idx_user_interests_interest ON user_interests (interest_id, user_id);
CREATE INDEX idx_courses_category_status ON courses (category_id, status, created_at DESC);
CREATE INDEX idx_courses_creator ON courses (creator_id, created_at DESC);
CREATE INDEX idx_course_materials_course ON course_materials (course_id, sort_order);
CREATE INDEX idx_enrollments_user ON course_enrollments (user_id, status, enrolled_at DESC);
CREATE INDEX idx_communities_category ON communities (category_id, created_at DESC);
CREATE INDEX idx_community_members_user ON community_members (member_id, status);
CREATE INDEX idx_community_messages_chat ON community_chat_messages (chat_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_showcase_posts_feed ON showcase_posts (created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_showcase_posts_category ON showcase_posts (category_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_showcase_comments_post ON showcase_post_comments (post_id, created_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_reports_status ON reported_showcase_posts (status, created_at);
CREATE INDEX idx_contests_schedule ON contests (status, starting_time, ending_time);
CREATE INDEX idx_contest_submissions_participant ON contest_submissions (participant_id, contest_id, submitted_at DESC);
CREATE INDEX idx_webinars_schedule ON webinars (status, starting_time);
CREATE INDEX idx_jobs_search ON jobs (status, category_id, created_at DESC);
CREATE INDEX idx_jobs_criteria_gin ON jobs USING GIN (criteria);
CREATE INDEX idx_job_applications_applicant ON job_applications (applicant_id, status, applied_at DESC);
CREATE INDEX idx_conversation_members_user ON conversation_members (user_id, conversation_id);
CREATE INDEX idx_messages_conversation ON messages (conversation_id, sent_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_payments_user ON payments (user_id, created_at DESC);
CREATE UNIQUE INDEX idx_payments_provider_transaction
    ON payments (provider, provider_transaction_id)
    WHERE provider IS NOT NULL AND provider_transaction_id IS NOT NULL;

-- Full-text indexes for frequently searched content.
CREATE INDEX idx_courses_fts ON courses USING GIN (
    to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(description, ''))
);
CREATE INDEX idx_jobs_fts ON jobs USING GIN (
    to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(description, ''))
);

-- -----------------------------------------------------------------------------
-- updated_at triggers
-- -----------------------------------------------------------------------------

DO $$
DECLARE
    table_name TEXT;
BEGIN
    FOREACH table_name IN ARRAY ARRAY[
        'users', 'interest_categories', 'courses', 'course_materials',
        'communities', 'community_chats', 'community_chat_messages',
        'showcase_posts', 'showcase_post_comments', 'reported_showcase_posts',
        'contests', 'contest_problems', 'webinars', 'jobs', 'job_applications',
        'conversations', 'messages', 'payments'
    ]
    LOOP
        EXECUTE format(
            'CREATE TRIGGER %I_set_updated_at BEFORE UPDATE ON %I '
            'FOR EACH ROW EXECUTE FUNCTION set_updated_at()',
            table_name, table_name
        );
    END LOOP;
END;
$$;

COMMIT;

-- Notes:
-- 1. BYTEA is PostgreSQL's binary type; LONGBLOB is MySQL-only.
-- 2. For large production media, object storage + URL/object_key is generally
--    more scalable than BYTEA. BYTEA is retained here because it was requested.
-- 3. Cross-table business rules (for example, ensuring chat_id belongs to the
--    supplied community_id, or problem_id belongs to contest_id) should be
--    enforced in the service layer or with additional composite foreign keys.
