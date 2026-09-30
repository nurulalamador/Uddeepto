BEGIN;

-- 1. Uddeepto ID: a unique 9-digit public ID shown as 123-456-789 (like an ORCID iD).
--    New accounts get one automatically (column default); existing accounts are backfilled below.
CREATE OR REPLACE FUNCTION generate_uddeepto_id() RETURNS VARCHAR AS $$
DECLARE
    candidate VARCHAR;
BEGIN
    LOOP
        candidate := lpad(floor(random() * 900000000 + 100000000)::BIGINT::TEXT, 9, '0');
        candidate := substr(candidate, 1, 3) || '-' || substr(candidate, 4, 3) || '-' || substr(candidate, 7, 3);
        EXIT WHEN NOT EXISTS (SELECT 1 FROM users WHERE uddeepto_id = candidate);
    END LOOP;
    RETURN candidate;
END;
$$ LANGUAGE plpgsql;

ALTER TABLE users ADD COLUMN IF NOT EXISTS uddeepto_id VARCHAR(11);

-- Give every existing user an ID, one at a time so each new value is checked against the others.
DO $$
DECLARE
    row_id UUID;
BEGIN
    FOR row_id IN SELECT id FROM users WHERE uddeepto_id IS NULL LOOP
        UPDATE users SET uddeepto_id = generate_uddeepto_id() WHERE id = row_id;
    END LOOP;
END;
$$;

ALTER TABLE users ALTER COLUMN uddeepto_id SET DEFAULT generate_uddeepto_id();
ALTER TABLE users ALTER COLUMN uddeepto_id SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'users'::regclass AND conname = 'users_uddeepto_id_format') THEN
        ALTER TABLE users ADD CONSTRAINT users_uddeepto_id_format CHECK (uddeepto_id ~ '^[0-9]{3}-[0-9]{3}-[0-9]{3}$');
    END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_uddeepto_id ON users (uddeepto_id);

-- 2. Extra profile fields. Phone, birth date, gender and addresses are private
--    (only the owner and admins can see them).
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS headline          VARCHAR(200),
    ADD COLUMN IF NOT EXISTS phone             VARCHAR(30),
    ADD COLUMN IF NOT EXISTS birth_date        DATE,
    ADD COLUMN IF NOT EXISTS gender            VARCHAR(20),
    ADD COLUMN IF NOT EXISTS current_address   TEXT,
    ADD COLUMN IF NOT EXISTS permanent_address TEXT;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'users'::regclass AND conname = 'users_gender_valid') THEN
        ALTER TABLE users ADD CONSTRAINT users_gender_valid
            CHECK (gender IS NULL OR gender IN ('female', 'male', 'other', 'prefer_not_to_say'));
    END IF;
END;
$$;

-- 3. Education timeline
CREATE TABLE IF NOT EXISTS user_education (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    institution    VARCHAR(200) NOT NULL,
    degree         VARCHAR(200),
    field_of_study VARCHAR(200),
    start_date     DATE NOT NULL,
    end_date       DATE,               -- NULL = still studying
    grade          VARCHAR(100),
    description    TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT user_education_dates CHECK (end_date IS NULL OR end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_user_education_user ON user_education (user_id, start_date DESC);

-- 4. Experience timeline (each entry belongs to one interest category)
CREATE TABLE IF NOT EXISTS user_experiences (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title       VARCHAR(200) NOT NULL,
    workplace   VARCHAR(200) NOT NULL,
    category_id UUID NOT NULL REFERENCES interest_categories(id) ON DELETE RESTRICT,
    location    VARCHAR(200),
    start_date  DATE NOT NULL,
    end_date    DATE,                  -- NULL = current position
    description TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT user_experiences_dates CHECK (end_date IS NULL OR end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_user_experiences_user ON user_experiences (user_id, start_date DESC);

DO $$
DECLARE
    table_name TEXT;
BEGIN
    FOREACH table_name IN ARRAY ARRAY['user_education', 'user_experiences']
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_trigger WHERE tgname = table_name || '_set_updated_at'
        ) THEN
            EXECUTE format(
                'CREATE TRIGGER %I_set_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at()',
                table_name, table_name
            );
        END IF;
    END LOOP;
END;
$$;

COMMIT;
