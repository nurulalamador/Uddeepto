BEGIN;

-- Map position of a job (chosen by the hirer on a map). Remote jobs may leave it empty.
ALTER TABLE jobs
    ADD COLUMN IF NOT EXISTS latitude  NUMERIC(9,6),
    ADD COLUMN IF NOT EXISTS longitude NUMERIC(9,6);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'jobs'::regclass AND conname = 'jobs_coordinates_valid') THEN
        ALTER TABLE jobs ADD CONSTRAINT jobs_coordinates_valid CHECK (
            (latitude IS NULL AND longitude IS NULL)
            OR (latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180)
        );
    END IF;
END;
$$;

-- Used by the "jobs near me" map view.
CREATE INDEX IF NOT EXISTS idx_jobs_coordinates ON jobs (latitude, longitude)
    WHERE latitude IS NOT NULL AND status = 'open';

COMMIT;
