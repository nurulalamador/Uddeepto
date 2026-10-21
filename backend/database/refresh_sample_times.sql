-- Refresh the sample contests and webinars (seed_contests_sample.sql, seed_webinars_sample.sql).
--
-- Run it in the Supabase SQL Editor whenever the "current" and "upcoming" samples have slipped into the past.
-- It sets the start and end times of those samples again, counting from now(), so it can be run at any moment:
--
--   contests   c0000001-... (5)  upcoming   start in 3-14 days
--              c0000002-... (5)  ongoing    started 1-4 days ago, end in 2-6 days
--   webinars   d0000001-... (5)  upcoming   start in 2-12 days
--              d0000002-... (5)  ongoing    started 15-60 minutes ago, end in 1-1.75 hours
--
-- The "previous" samples (c0000003-..., d0000003-...) are already finished and are left alone. Statuses are put back
-- to published / scheduled / live too, in case an admin changed them. Nothing is inserted or deleted; run it as often as
-- you like. A webinar that is "ongoing" lasts only about an hour, so run this again before showing one off.

BEGIN;

-- ---------------------------------------------------------------------------
-- Contests
-- ---------------------------------------------------------------------------
UPDATE contests c
SET starting_time = now() + v.starts,
    ending_time   = now() + v.ends,
    status        = 'published'
FROM (VALUES
  -- Upcoming
  ('c0000001-0000-4000-8000-000000000001'::uuid, interval '3 days',  interval '3 days 3 hours'),
  ('c0000001-0000-4000-8000-000000000002'::uuid, interval '5 days',  interval '9 days'),
  ('c0000001-0000-4000-8000-000000000003'::uuid, interval '7 days',  interval '9 days'),
  ('c0000001-0000-4000-8000-000000000004'::uuid, interval '10 days', interval '17 days'),
  ('c0000001-0000-4000-8000-000000000005'::uuid, interval '14 days', interval '21 days'),
  -- Ongoing
  ('c0000002-0000-4000-8000-000000000001'::uuid, interval '-1 day',  interval '2 days'),
  ('c0000002-0000-4000-8000-000000000002'::uuid, interval '-2 days', interval '4 days'),
  ('c0000002-0000-4000-8000-000000000003'::uuid, interval '-3 days', interval '5 days'),
  ('c0000002-0000-4000-8000-000000000004'::uuid, interval '-1 day',  interval '6 days'),
  ('c0000002-0000-4000-8000-000000000005'::uuid, interval '-4 days', interval '3 days')
) AS v(id, starts, ends)
WHERE c.id = v.id;

-- The ongoing contests' participants joined after the contest started: move their join times along with it.
UPDATE contest_participants p
SET participated_at = now() + v.joined
FROM (VALUES
  ('c0000002-0000-4000-8000-000000000001'::uuid, '403a64ce-877c-4e6e-a500-b470297efa35'::uuid, interval '-20 hours'),
  ('c0000002-0000-4000-8000-000000000001'::uuid, '5ce8331c-8094-461d-bfa4-80458504cde4'::uuid, interval '-10 hours'),
  ('c0000002-0000-4000-8000-000000000002'::uuid, '649b623d-0157-409c-9236-68e3655065f2'::uuid, interval '-1 day'),
  ('c0000002-0000-4000-8000-000000000005'::uuid, '66c27b45-cfbf-4468-b4c8-ea75487ebb1d'::uuid, interval '-3 days'),
  ('c0000002-0000-4000-8000-000000000005'::uuid, '6efb2e07-f49f-4c22-bf90-c8e686d6889d'::uuid, interval '-2 days')
) AS v(contest_id, participant_id, joined)
WHERE p.contest_id = v.contest_id AND p.participant_id = v.participant_id;

-- ---------------------------------------------------------------------------
-- Webinars
-- ---------------------------------------------------------------------------
UPDATE webinars w
SET starting_time = now() + v.starts,
    ending_time   = now() + v.ends,
    status        = v.status::webinar_status
FROM (VALUES
  -- Upcoming
  ('d0000001-0000-4000-8000-000000000001'::uuid, 'scheduled', interval '2 days',  interval '2 days 90 minutes'),
  ('d0000001-0000-4000-8000-000000000002'::uuid, 'scheduled', interval '4 days',  interval '4 days 2 hours'),
  ('d0000001-0000-4000-8000-000000000003'::uuid, 'scheduled', interval '6 days',  interval '6 days 2 hours'),
  ('d0000001-0000-4000-8000-000000000004'::uuid, 'scheduled', interval '9 days',  interval '9 days 90 minutes'),
  ('d0000001-0000-4000-8000-000000000005'::uuid, 'scheduled', interval '12 days', interval '12 days 2 hours'),
  -- Ongoing
  ('d0000002-0000-4000-8000-000000000001'::uuid, 'live', interval '-30 minutes', interval '60 minutes'),
  ('d0000002-0000-4000-8000-000000000002'::uuid, 'live', interval '-45 minutes', interval '75 minutes'),
  ('d0000002-0000-4000-8000-000000000003'::uuid, 'live', interval '-20 minutes', interval '100 minutes'),
  ('d0000002-0000-4000-8000-000000000004'::uuid, 'live', interval '-1 hour',     interval '1 hour'),
  ('d0000002-0000-4000-8000-000000000005'::uuid, 'live', interval '-15 minutes', interval '105 minutes')
) AS v(id, status, starts, ends)
WHERE w.id = v.id;

COMMIT;

-- Check the result:
-- SELECT left(id::text, 8) AS id, name, status, starting_time, ending_time FROM contests WHERE id::text LIKE 'c000000_-%' ORDER BY id;
-- SELECT left(id::text, 8) AS id, name, status, starting_time, ending_time FROM webinars WHERE id::text LIKE 'd000000_-%' ORDER BY id;
