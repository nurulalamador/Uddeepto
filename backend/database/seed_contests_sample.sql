-- Sample contest data: 5 upcoming, 5 ongoing, 5 previous contests.
-- Run once in the Supabase SQL Editor (after migrations 001-006).
-- Times are relative to now(), so "ongoing" stays ongoing for a few days after you run it.
-- Contests are created by the oldest admin account. All contests use fixed ids
-- (c0000001-... upcoming, c0000002-... ongoing, c0000003-... previous) so they are easy to remove;
-- a cleanup query is at the bottom.

BEGIN;

-- ---------------------------------------------------------------------------
-- Contests
-- ---------------------------------------------------------------------------
INSERT INTO contests (id, creator_id, name, description, category_id, type, entry_fee, currency, status, max_participants, starting_time, ending_time)
SELECT v.id::uuid,
       (SELECT id FROM users WHERE role = 'admin' ORDER BY created_at LIMIT 1),
       v.name, v.description, v.category_id::uuid, v.type::contest_type, v.entry_fee, 'BDT',
       v.status::contest_status, v.max_participants, now() + v.starts, now() + v.ends
FROM (VALUES
  -- Upcoming (published, not started yet)
  ('c0000001-0000-4000-8000-000000000001', 'Weekly Algorithm Sprint #1', 'Solve a set of algorithmic problems as fast as you can. Ranked by points, then by submission time.', 'c91de36a-240b-4913-aa6f-9b381687fda2', 'competitive_programming', 0::numeric, 'published', 200, interval '3 days', interval '3 days 3 hours'),
  ('c0000001-0000-4000-8000-000000000002', 'Logo Design Challenge', 'Design a logo for an imaginary eco-friendly startup. Judged on originality, clarity and brand fit.', '758825b2-c165-4128-ae52-17be75d3f87b', 'drawing', 100, 'published', 100, interval '5 days', interval '9 days'),
  ('c0000001-0000-4000-8000-000000000003', 'Mobile UI Hackathon', 'Build a clean, usable mobile app screen flow from a short brief in 48 hours.', 'a8faaddc-08d5-4b02-9146-6013d5fd6fb9', 'general', 200, 'published', 60, interval '7 days', interval '9 days'),
  ('c0000001-0000-4000-8000-000000000004', 'Acoustic Cover Contest', 'Record and submit an acoustic cover of any song. Vocals, instruments or both are welcome.', 'c0e3dff5-9854-4bb2-bf50-cfdb8001e5fc', 'singing', 0, 'published', NULL, interval '10 days', interval '17 days'),
  ('c0000001-0000-4000-8000-000000000005', 'Street Photography Showcase', 'Submit up to three photographs that capture everyday life on the street.', 'cc3b8b52-a048-455e-9acb-debe9cecf6e5', 'general', 50, 'published', 150, interval '14 days', interval '21 days'),

  -- Ongoing (published, started, not ended)
  ('c0000002-0000-4000-8000-000000000001', 'Div 3 Practice Round', 'A friendly practice round with problems of increasing difficulty. Great warm-up before the weekly sprint.', 'c91de36a-240b-4913-aa6f-9b381687fda2', 'competitive_programming', 0, 'published', 500, interval '-1 day', interval '2 days'),
  ('c0000002-0000-4000-8000-000000000002', 'Responsive Landing Page Build', 'Turn the provided design brief into a fast, accessible, responsive landing page.', 'e604bb87-12ed-4560-a66a-45a8ad7715c8', 'general', 0, 'published', 100, interval '-2 days', interval '4 days'),
  ('c0000002-0000-4000-8000-000000000003', 'Digital Marketing Campaign Pitch', 'Plan a small launch campaign for a local product. Pitch your channels, budget and metrics.', 'f4c00521-9455-4ac4-8bca-960cbaee0b05', 'general', 100, 'published', 80, interval '-3 days', interval '5 days'),
  ('c0000002-0000-4000-8000-000000000004', 'Handmade Craft Festival', 'Share a handmade craft with a short note about how you made it and what inspired you.', 'f0f18115-5ce9-46e8-aecf-93baeb1ae2e1', 'drawing', 0, 'published', NULL, interval '-1 day', interval '6 days'),
  ('c0000002-0000-4000-8000-000000000005', 'Portrait Photography Week', 'One week, one theme: portraits. Submit your best shot with natural light only.', 'cc3b8b52-a048-455e-9acb-debe9cecf6e5', 'general', 0, 'published', 120, interval '-4 days', interval '3 days'),

  -- Previous (completed)
  ('c0000003-0000-4000-8000-000000000001', 'Beginner Coding Cup', 'A beginner-friendly programming contest with two problems. Results are final.', 'c91de36a-240b-4913-aa6f-9b381687fda2', 'competitive_programming', 0, 'completed', 300, interval '-21 days', interval '-21 days' + interval '3 hours'),
  ('c0000003-0000-4000-8000-000000000002', 'Poster Design Battle', 'Design a poster for a community book fair. Judged by a panel of designers.', '758825b2-c165-4128-ae52-17be75d3f87b', 'drawing', 100, 'completed', 60, interval '-30 days', interval '-24 days'),
  ('c0000003-0000-4000-8000-000000000003', 'Solo Singing Night', 'Perform one song of your choice. Scored on pitch, expression and stage presence.', 'c0e3dff5-9854-4bb2-bf50-cfdb8001e5fc', 'singing', 50, 'completed', 50, interval '-40 days', interval '-38 days'),
  ('c0000003-0000-4000-8000-000000000004', 'Frontend Speed Build', 'Recreate a UI from a screenshot as accurately as possible within the time limit.', 'e604bb87-12ed-4560-a66a-45a8ad7715c8', 'general', 0, 'completed', 100, interval '-15 days', interval '-14 days'),
  ('c0000003-0000-4000-8000-000000000005', 'Mobile App Idea Jam', 'Pitch a mobile app idea with a short prototype walkthrough.', 'a8faaddc-08d5-4b02-9146-6013d5fd6fb9', 'general', 0, 'completed', 40, interval '-50 days', interval '-47 days')
) AS v(id, name, description, category_id, type, entry_fee, status, max_participants, starts, ends)
ON CONFLICT (id) DO NOTHING;

-- Multiple categories (migration 006): each contest gets its main category plus a few extra ones.
INSERT INTO contest_categories (contest_id, category_id)
SELECT id, category_id FROM contests WHERE id::text LIKE 'c000000_-0000-4000-8000-00000000000_'
ON CONFLICT DO NOTHING;

INSERT INTO contest_categories (contest_id, category_id)
SELECT v.contest_id::uuid, v.category_id::uuid FROM (VALUES
  ('c0000001-0000-4000-8000-000000000002', 'f0f18115-5ce9-46e8-aecf-93baeb1ae2e1'),  -- Logo Design + Arts and Crafts
  ('c0000001-0000-4000-8000-000000000003', 'e604bb87-12ed-4560-a66a-45a8ad7715c8'),  -- Mobile UI + Web Development
  ('c0000002-0000-4000-8000-000000000002', 'a8faaddc-08d5-4b02-9146-6013d5fd6fb9'),  -- Landing page + Mobile App
  ('c0000002-0000-4000-8000-000000000004', '758825b2-c165-4128-ae52-17be75d3f87b'),  -- Craft + Graphic Design
  ('c0000003-0000-4000-8000-000000000002', 'cc3b8b52-a048-455e-9acb-debe9cecf6e5'),  -- Poster + Photography
  ('c0000003-0000-4000-8000-000000000004', 'a8faaddc-08d5-4b02-9146-6013d5fd6fb9')   -- Frontend build + Mobile App
) AS v(contest_id, category_id)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- Problems (ongoing coding/web contests and the completed coding cup)
-- ---------------------------------------------------------------------------
INSERT INTO contest_problems (creator_id, contest_id, name, description, sample_input, sample_output, points, time_limit_ms, memory_limit_mb, sort_order)
SELECT (SELECT id FROM users WHERE role = 'admin' ORDER BY created_at LIMIT 1),
       v.contest_id::uuid, v.name, v.description, v.sample_input, v.sample_output, v.points, v.time_limit_ms, v.memory_limit_mb, v.sort_order
FROM (VALUES
  ('c0000002-0000-4000-8000-000000000001', 'Sum of Two Numbers', 'Read two integers and print their sum.', E'3 4\n', E'7\n', 100::numeric, 1000, 256, 0),
  ('c0000002-0000-4000-8000-000000000001', 'Longest Streak', 'Given a list of daily results (0 or 1), print the length of the longest streak of 1s.', E'7\n1 1 0 1 1 1 0\n', E'3\n', 150, 1000, 256, 1),
  ('c0000002-0000-4000-8000-000000000002', 'Landing Page', 'Build the landing page from the brief. Submit a link or paste your HTML/CSS.', NULL, NULL, 100, NULL, NULL, 0),
  ('c0000002-0000-4000-8000-000000000005', 'Portrait Entry', 'Describe your portrait and share a link to the photo.', NULL, NULL, 100, NULL, NULL, 0),
  ('c0000003-0000-4000-8000-000000000001', 'Problem A: Even or Odd', 'Read an integer and print EVEN or ODD.', E'8\n', E'EVEN\n', 100, 1000, 256, 0),
  ('c0000003-0000-4000-8000-000000000001', 'Problem B: Count Vowels', 'Read a word and print how many vowels it contains.', E'education\n', E'5\n', 100, 1000, 256, 1)
) AS v(contest_id, name, description, sample_input, sample_output, points, time_limit_ms, memory_limit_mb, sort_order)
ON CONFLICT (contest_id, sort_order) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Participants
-- Ongoing: 0-2 participants each (points 0, no result yet).
-- Previous: participants with final points and rank.
-- Upcoming: nobody has joined yet.
-- ---------------------------------------------------------------------------
INSERT INTO contest_participants (contest_id, participant_id, participated_at, points, rank, payment_status)
SELECT v.contest_id::uuid, v.participant_id::uuid, now() + v.joined, v.points, v.rank, 'paid'
FROM (VALUES
  -- Ongoing
  ('c0000002-0000-4000-8000-000000000001', '403a64ce-877c-4e6e-a500-b470297efa35', interval '-20 hours', 0::numeric, NULL::int),
  ('c0000002-0000-4000-8000-000000000001', '5ce8331c-8094-461d-bfa4-80458504cde4', interval '-10 hours', 0, NULL),
  ('c0000002-0000-4000-8000-000000000002', '649b623d-0157-409c-9236-68e3655065f2', interval '-1 day',    0, NULL),
  -- c0000002-...03 (Digital Marketing) and c0000002-...04 (Handmade Craft): no participants yet
  ('c0000002-0000-4000-8000-000000000005', '66c27b45-cfbf-4468-b4c8-ea75487ebb1d', interval '-3 days',   0, NULL),
  ('c0000002-0000-4000-8000-000000000005', '6efb2e07-f49f-4c22-bf90-c8e686d6889d', interval '-2 days',   0, NULL),

  -- Previous: Beginner Coding Cup (points = sum of best accepted scores, see submissions below)
  ('c0000003-0000-4000-8000-000000000001', '403a64ce-877c-4e6e-a500-b470297efa35', interval '-21 days 1 hour', 200, 1),
  ('c0000003-0000-4000-8000-000000000001', '5ce8331c-8094-461d-bfa4-80458504cde4', interval '-21 days 1 hour', 180, 2),
  ('c0000003-0000-4000-8000-000000000001', '649b623d-0157-409c-9236-68e3655065f2', interval '-21 days 1 hour', 150, 3),
  ('c0000003-0000-4000-8000-000000000001', '66c27b45-cfbf-4468-b4c8-ea75487ebb1d', interval '-21 days 1 hour', 100, 4),
  ('c0000003-0000-4000-8000-000000000001', '6efb2e07-f49f-4c22-bf90-c8e686d6889d', interval '-21 days 1 hour',  70, 5),
  ('c0000003-0000-4000-8000-000000000001', '7347687c-99b8-48d4-8842-3804f4051419', interval '-21 days 1 hour',  40, 6),

  -- Previous: Poster Design Battle
  ('c0000003-0000-4000-8000-000000000002', '7347687c-99b8-48d4-8842-3804f4051419', interval '-29 days', 92, 1),
  ('c0000003-0000-4000-8000-000000000002', 'e0f7ab00-b355-498e-a524-61a009b225b9', interval '-29 days', 88, 2),
  ('c0000003-0000-4000-8000-000000000002', '403a64ce-877c-4e6e-a500-b470297efa35', interval '-28 days', 81, 3),
  ('c0000003-0000-4000-8000-000000000002', '649b623d-0157-409c-9236-68e3655065f2', interval '-27 days', 74, 4),

  -- Previous: Solo Singing Night
  ('c0000003-0000-4000-8000-000000000003', '5ce8331c-8094-461d-bfa4-80458504cde4', interval '-39 days', 95, 1),
  ('c0000003-0000-4000-8000-000000000003', '66c27b45-cfbf-4468-b4c8-ea75487ebb1d', interval '-39 days', 90, 2),
  ('c0000003-0000-4000-8000-000000000003', 'e0f7ab00-b355-498e-a524-61a009b225b9', interval '-39 days', 86, 3),
  ('c0000003-0000-4000-8000-000000000003', '403a64ce-877c-4e6e-a500-b470297efa35', interval '-38 days', 79, 4),
  ('c0000003-0000-4000-8000-000000000003', '6efb2e07-f49f-4c22-bf90-c8e686d6889d', interval '-38 days', 70, 5),

  -- Previous: Frontend Speed Build
  ('c0000003-0000-4000-8000-000000000004', '649b623d-0157-409c-9236-68e3655065f2', interval '-15 days', 97, 1),
  ('c0000003-0000-4000-8000-000000000004', '7347687c-99b8-48d4-8842-3804f4051419', interval '-15 days', 91, 2),
  ('c0000003-0000-4000-8000-000000000004', '5ce8331c-8094-461d-bfa4-80458504cde4', interval '-15 days', 84, 3),
  ('c0000003-0000-4000-8000-000000000004', 'e0f7ab00-b355-498e-a524-61a009b225b9', interval '-14 days', 77, 4),
  ('c0000003-0000-4000-8000-000000000004', '403a64ce-877c-4e6e-a500-b470297efa35', interval '-14 days', 65, 5),

  -- Previous: Mobile App Idea Jam
  ('c0000003-0000-4000-8000-000000000005', '6efb2e07-f49f-4c22-bf90-c8e686d6889d', interval '-49 days', 89, 1),
  ('c0000003-0000-4000-8000-000000000005', '66c27b45-cfbf-4468-b4c8-ea75487ebb1d', interval '-49 days', 82, 2),
  ('c0000003-0000-4000-8000-000000000005', '7347687c-99b8-48d4-8842-3804f4051419', interval '-48 days', 73, 3)
) AS v(contest_id, participant_id, joined, points, rank)
ON CONFLICT (contest_id, participant_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Submissions for the Beginner Coding Cup (they add up to the points above)
-- ---------------------------------------------------------------------------
INSERT INTO contest_submissions (contest_id, problem_id, participant_id, content, language, status, score, feedback, judged_by, judged_at, submitted_at)
SELECT p.contest_id, p.id, v.participant_id::uuid, c.code, 'python', 'accepted', v.score,
       CASE WHEN v.score = p.points THEN 'All test cases passed.' ELSE 'Partially correct.' END,
       (SELECT id FROM users WHERE role = 'admin' ORDER BY created_at LIMIT 1),
       now() - interval '20 days', now() - interval '21 days' + interval '2 hours'
FROM (VALUES
  ('403a64ce-877c-4e6e-a500-b470297efa35', 0, 100::numeric), ('403a64ce-877c-4e6e-a500-b470297efa35', 1, 100),
  ('5ce8331c-8094-461d-bfa4-80458504cde4', 0, 100),          ('5ce8331c-8094-461d-bfa4-80458504cde4', 1, 80),
  ('649b623d-0157-409c-9236-68e3655065f2', 0, 100),          ('649b623d-0157-409c-9236-68e3655065f2', 1, 50),
  ('66c27b45-cfbf-4468-b4c8-ea75487ebb1d', 0, 100),
  ('6efb2e07-f49f-4c22-bf90-c8e686d6889d', 0, 70),
  ('7347687c-99b8-48d4-8842-3804f4051419', 0, 40)
) AS v(participant_id, problem_index, score)
JOIN contest_problems p ON p.contest_id = 'c0000003-0000-4000-8000-000000000001' AND p.sort_order = v.problem_index,
LATERAL (SELECT 'print("solution")'::text AS code) AS c(code)
WHERE NOT EXISTS (
  SELECT 1 FROM contest_submissions s
  WHERE s.contest_id = p.contest_id AND s.problem_id = p.id AND s.participant_id = v.participant_id::uuid
);

COMMIT;

-- ---------------------------------------------------------------------------
-- Cleanup (run this if you want to remove all sample contests again).
-- Participants, problems, submissions and category links are removed automatically.
-- ---------------------------------------------------------------------------
-- DELETE FROM contests WHERE id::text LIKE 'c000000_-0000-4000-8000-00000000000_';
