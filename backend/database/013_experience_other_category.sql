BEGIN;

-- "Others": a work experience that fits none of the interest categories is stored without one.
ALTER TABLE user_experiences ALTER COLUMN category_id DROP NOT NULL;

COMMIT;
