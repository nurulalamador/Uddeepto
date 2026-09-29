BEGIN;

CREATE TABLE IF NOT EXISTS platform_settings (
  key VARCHAR(80) PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO platform_settings(key, value, description)
VALUES
  ('registration_open', 'true'::jsonb, 'Allow public self-registration.'),
  ('content_review_required', 'true'::jsonb, 'Require admin approval before creators publish courses, contests, webinars or jobs.')
ON CONFLICT (key) DO NOTHING;

COMMIT;
