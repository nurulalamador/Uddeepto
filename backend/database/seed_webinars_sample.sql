-- Sample webinar data: 5 upcoming, 5 ongoing, 5 previous webinars.
-- Run once in the Supabase SQL Editor (after migrations 001-009).
-- Times are relative to now(), so "ongoing" stays ongoing for a few hours after you run it.
-- Webinars are created by the oldest admin account. Fixed ids are used
-- (d0000001-... upcoming, d0000002-... ongoing, d0000003-... previous) so they are easy to remove;
-- a cleanup query is at the bottom.

BEGIN;

-- ---------------------------------------------------------------------------
-- Webinars
-- ---------------------------------------------------------------------------
INSERT INTO webinars (id, name, creator_id, description, category_id, meeting_url, capacity, status, starting_time, ending_time, recording_url)
SELECT v.id::uuid, v.name,
       (SELECT id FROM users WHERE role = 'admin' ORDER BY created_at LIMIT 1),
       v.description, v.category_id::uuid, v.meeting_url, v.capacity, v.status::webinar_status,
       now() + v.starts, now() + v.ends, v.recording_url
FROM (VALUES
  -- Upcoming (scheduled, not started yet)
  ('d0000001-0000-4000-8000-000000000001', 'Cracking Your First Coding Interview', 'A practical walkthrough of how coding interviews work, what to practice, and how to stay calm under pressure.', 'c91de36a-240b-4913-aa6f-9b381687fda2', 'https://meet.example.com/coding-interview', 200, 'scheduled', interval '2 days', interval '2 days 90 minutes', NULL::text),
  ('d0000001-0000-4000-8000-000000000002', 'Design Systems for Small Teams', 'Learn how to build a lightweight design system that keeps your product consistent without slowing you down.', '758825b2-c165-4128-ae52-17be75d3f87b', 'https://meet.example.com/design-systems', 150, 'scheduled', interval '4 days', interval '4 days 2 hours', NULL),
  ('d0000001-0000-4000-8000-000000000003', 'Shipping Your First Mobile App', 'From idea to app store: planning, building, testing and releasing your first mobile app.', 'a8faaddc-08d5-4b02-9146-6013d5fd6fb9', 'https://meet.example.com/first-mobile-app', 120, 'scheduled', interval '6 days', interval '6 days 2 hours', NULL),
  ('d0000001-0000-4000-8000-000000000004', 'Music Production at Home', 'Set up a simple home studio and record your first track with affordable gear.', 'c0e3dff5-9854-4bb2-bf50-cfdb8001e5fc', 'https://meet.example.com/home-studio', 100, 'scheduled', interval '9 days', interval '9 days 90 minutes', NULL),
  ('d0000001-0000-4000-8000-000000000005', 'Growing a Brand with Content Marketing', 'How to plan content, pick channels and measure what actually brings customers.', 'f4c00521-9455-4ac4-8bca-960cbaee0b05', 'https://meet.example.com/content-marketing', 250, 'scheduled', interval '12 days', interval '12 days 2 hours', NULL),

  -- Ongoing (started, not ended)
  ('d0000002-0000-4000-8000-000000000001', 'Modern JavaScript in 90 Minutes', 'A live tour of the modern JavaScript features you will actually use every day.', 'e604bb87-12ed-4560-a66a-45a8ad7715c8', 'https://meet.example.com/modern-js', 300, 'live', interval '-30 minutes', interval '60 minutes', NULL),
  ('d0000002-0000-4000-8000-000000000002', 'Portrait Lighting Basics', 'Learn simple lighting setups for beautiful portraits, indoors and out.', 'cc3b8b52-a048-455e-9acb-debe9cecf6e5', 'https://meet.example.com/portrait-lighting', 80, 'live', interval '-45 minutes', interval '75 minutes', NULL),
  ('d0000002-0000-4000-8000-000000000003', 'Hand-Lettering for Beginners', 'Pick up a brush pen and practice the fundamentals of hand-lettering together.', 'f0f18115-5ce9-46e8-aecf-93baeb1ae2e1', 'https://meet.example.com/hand-lettering', 60, 'live', interval '-20 minutes', interval '100 minutes', NULL),
  ('d0000002-0000-4000-8000-000000000004', 'Competitive Programming: Graph Basics', 'Breadth-first search, depth-first search and shortest paths, explained with contest problems.', 'c91de36a-240b-4913-aa6f-9b381687fda2', 'https://meet.example.com/graph-basics', 200, 'live', interval '-1 hour', interval '1 hour', NULL),
  ('d0000002-0000-4000-8000-000000000005', 'SEO Essentials for New Websites', 'What really matters for search rankings when your website is brand new.', 'f4c00521-9455-4ac4-8bca-960cbaee0b05', 'https://meet.example.com/seo-essentials', 150, 'live', interval '-15 minutes', interval '105 minutes', NULL),

  -- Previous (completed, with recordings)
  ('d0000003-0000-4000-8000-000000000001', 'Getting Started with Web Development', 'A friendly overview of HTML, CSS and JavaScript and how to plan your learning path.', 'e604bb87-12ed-4560-a66a-45a8ad7715c8', 'https://meet.example.com/web-dev-start', 200, 'completed', interval '-10 days', interval '-10 days' + interval '90 minutes', 'https://www.youtube.com/watch?v=example-web-dev'),
  ('d0000003-0000-4000-8000-000000000002', 'Logo Design Masterclass', 'Sketch, refine and present a logo, with live feedback on viewer submissions.', '758825b2-c165-4128-ae52-17be75d3f87b', 'https://meet.example.com/logo-masterclass', 100, 'completed', interval '-20 days', interval '-20 days' + interval '2 hours', 'https://www.youtube.com/watch?v=example-logo-design'),
  ('d0000003-0000-4000-8000-000000000003', 'Songwriting Workshop', 'Turn a simple idea into a complete song: melody, lyrics and structure.', 'c0e3dff5-9854-4bb2-bf50-cfdb8001e5fc', 'https://meet.example.com/songwriting', 80, 'completed', interval '-30 days', interval '-30 days' + interval '2 hours', 'https://www.youtube.com/watch?v=example-songwriting'),
  ('d0000003-0000-4000-8000-000000000004', 'Mobile UX Patterns That Work', 'Navigation, onboarding and forms — patterns that make mobile apps easier to use.', 'a8faaddc-08d5-4b02-9146-6013d5fd6fb9', 'https://meet.example.com/mobile-ux', 120, 'completed', interval '-45 days', interval '-45 days' + interval '90 minutes', 'https://www.youtube.com/watch?v=example-mobile-ux'),
  ('d0000003-0000-4000-8000-000000000005', 'Street Photography Field Guide', 'How to see, frame and shoot everyday street scenes with confidence.', 'cc3b8b52-a048-455e-9acb-debe9cecf6e5', 'https://meet.example.com/street-photo', 90, 'completed', interval '-60 days', interval '-60 days' + interval '2 hours', NULL)
) AS v(id, name, description, category_id, meeting_url, capacity, status, starts, ends, recording_url)
ON CONFLICT (id) DO NOTHING;

-- Multiple categories (migration 006): main category plus a few extra ones.
INSERT INTO webinar_categories (webinar_id, category_id)
SELECT id, category_id FROM webinars WHERE id::text LIKE 'd000000_-0000-4000-8000-00000000000_'
ON CONFLICT DO NOTHING;

INSERT INTO webinar_categories (webinar_id, category_id)
SELECT v.webinar_id::uuid, v.category_id::uuid FROM (VALUES
  ('d0000001-0000-4000-8000-000000000003', 'e604bb87-12ed-4560-a66a-45a8ad7715c8'),  -- Mobile app + Web Development
  ('d0000001-0000-4000-8000-000000000002', 'f0f18115-5ce9-46e8-aecf-93baeb1ae2e1'),  -- Design systems + Arts and Crafts
  ('d0000002-0000-4000-8000-000000000001', 'a8faaddc-08d5-4b02-9146-6013d5fd6fb9'),  -- Modern JS + Mobile App
  ('d0000002-0000-4000-8000-000000000003', '758825b2-c165-4128-ae52-17be75d3f87b'),  -- Lettering + Graphic Design
  ('d0000003-0000-4000-8000-000000000002', 'f0f18115-5ce9-46e8-aecf-93baeb1ae2e1'),  -- Logo + Arts and Crafts
  ('d0000003-0000-4000-8000-000000000005', 'f0f18115-5ce9-46e8-aecf-93baeb1ae2e1')   -- Street photo + Arts and Crafts
) AS v(webinar_id, category_id)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- Speakers (instructors). sort_order 0 is shown first.
-- 0a6979f0... / b3ad627a... / bb2d3053...
-- ---------------------------------------------------------------------------
INSERT INTO webinar_speakers (webinar_id, instructor_id, sort_order)
SELECT v.webinar_id::uuid, v.instructor_id::uuid, v.sort_order
FROM (VALUES
  -- Upcoming
  ('d0000001-0000-4000-8000-000000000001', '0a6979f0-d734-44be-9a98-8a9833eadacf', 0),
  ('d0000001-0000-4000-8000-000000000002', 'b3ad627a-5c5b-4e1b-a377-ff954987626b', 0),
  ('d0000001-0000-4000-8000-000000000002', 'bb2d3053-f9fe-4463-a6a6-7c84d8c91329', 1),
  ('d0000001-0000-4000-8000-000000000003', '0a6979f0-d734-44be-9a98-8a9833eadacf', 0),
  ('d0000001-0000-4000-8000-000000000003', 'b3ad627a-5c5b-4e1b-a377-ff954987626b', 1),
  ('d0000001-0000-4000-8000-000000000003', 'bb2d3053-f9fe-4463-a6a6-7c84d8c91329', 2),
  ('d0000001-0000-4000-8000-000000000004', 'bb2d3053-f9fe-4463-a6a6-7c84d8c91329', 0),
  ('d0000001-0000-4000-8000-000000000005', 'b3ad627a-5c5b-4e1b-a377-ff954987626b', 0),
  ('d0000001-0000-4000-8000-000000000005', '0a6979f0-d734-44be-9a98-8a9833eadacf', 1),
  -- Ongoing
  ('d0000002-0000-4000-8000-000000000001', '0a6979f0-d734-44be-9a98-8a9833eadacf', 0),
  ('d0000002-0000-4000-8000-000000000002', 'bb2d3053-f9fe-4463-a6a6-7c84d8c91329', 0),
  ('d0000002-0000-4000-8000-000000000003', 'b3ad627a-5c5b-4e1b-a377-ff954987626b', 0),
  ('d0000002-0000-4000-8000-000000000003', 'bb2d3053-f9fe-4463-a6a6-7c84d8c91329', 1),
  ('d0000002-0000-4000-8000-000000000004', '0a6979f0-d734-44be-9a98-8a9833eadacf', 0),
  ('d0000002-0000-4000-8000-000000000004', 'b3ad627a-5c5b-4e1b-a377-ff954987626b', 1),
  ('d0000002-0000-4000-8000-000000000005', 'b3ad627a-5c5b-4e1b-a377-ff954987626b', 0),
  -- Previous
  ('d0000003-0000-4000-8000-000000000001', '0a6979f0-d734-44be-9a98-8a9833eadacf', 0),
  ('d0000003-0000-4000-8000-000000000001', 'bb2d3053-f9fe-4463-a6a6-7c84d8c91329', 1),
  ('d0000003-0000-4000-8000-000000000002', 'b3ad627a-5c5b-4e1b-a377-ff954987626b', 0),
  ('d0000003-0000-4000-8000-000000000003', 'bb2d3053-f9fe-4463-a6a6-7c84d8c91329', 0),
  ('d0000003-0000-4000-8000-000000000004', '0a6979f0-d734-44be-9a98-8a9833eadacf', 0),
  ('d0000003-0000-4000-8000-000000000004', 'b3ad627a-5c5b-4e1b-a377-ff954987626b', 1),
  ('d0000003-0000-4000-8000-000000000005', 'bb2d3053-f9fe-4463-a6a6-7c84d8c91329', 0),
  ('d0000003-0000-4000-8000-000000000005', '0a6979f0-d734-44be-9a98-8a9833eadacf', 1),
  ('d0000003-0000-4000-8000-000000000005', 'b3ad627a-5c5b-4e1b-a377-ff954987626b', 2)
) AS v(webinar_id, instructor_id, sort_order)
ON CONFLICT (webinar_id, instructor_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Participants
-- Upcoming: a few early registrations. Ongoing: 0-2 each. Previous: 3-5 each with attendance.
-- ---------------------------------------------------------------------------
INSERT INTO webinar_participants (webinar_id, participant_id, status, registered_at, attended_at)
SELECT v.webinar_id::uuid, v.participant_id::uuid, v.status::attendance_status, now() + v.registered,
       CASE WHEN v.status = 'attended' THEN now() + v.attended END
FROM (VALUES
  -- Upcoming (registered)
  ('d0000001-0000-4000-8000-000000000001', '403a64ce-877c-4e6e-a500-b470297efa35', 'registered', interval '-1 day',   NULL::interval),
  ('d0000001-0000-4000-8000-000000000001', '5ce8331c-8094-461d-bfa4-80458504cde4', 'registered', interval '-20 hours', NULL),
  ('d0000001-0000-4000-8000-000000000001', '649b623d-0157-409c-9236-68e3655065f2', 'registered', interval '-5 hours',  NULL),
  ('d0000001-0000-4000-8000-000000000002', '66c27b45-cfbf-4468-b4c8-ea75487ebb1d', 'registered', interval '-2 days',   NULL),
  ('d0000001-0000-4000-8000-000000000003', '6efb2e07-f49f-4c22-bf90-c8e686d6889d', 'registered', interval '-3 hours',  NULL),
  ('d0000001-0000-4000-8000-000000000003', '7347687c-99b8-48d4-8842-3804f4051419', 'registered', interval '-1 hour',   NULL),
  -- upcoming ...04 and ...05: nobody yet

  -- Ongoing
  ('d0000002-0000-4000-8000-000000000001', '403a64ce-877c-4e6e-a500-b470297efa35', 'attended',   interval '-1 day',    interval '-25 minutes'),
  ('d0000002-0000-4000-8000-000000000001', 'e0f7ab00-b355-498e-a524-61a009b225b9', 'registered', interval '-8 hours',  NULL),
  ('d0000002-0000-4000-8000-000000000002', '5ce8331c-8094-461d-bfa4-80458504cde4', 'attended',   interval '-2 days',   interval '-40 minutes'),
  -- ongoing ...03 (Hand-Lettering): nobody yet
  ('d0000002-0000-4000-8000-000000000004', '649b623d-0157-409c-9236-68e3655065f2', 'attended',   interval '-3 days',   interval '-55 minutes'),
  ('d0000002-0000-4000-8000-000000000004', '66c27b45-cfbf-4468-b4c8-ea75487ebb1d', 'registered', interval '-1 day',    NULL),
  -- ongoing ...05 (SEO): nobody yet

  -- Previous: Getting Started with Web Development
  ('d0000003-0000-4000-8000-000000000001', '403a64ce-877c-4e6e-a500-b470297efa35', 'attended',   interval '-12 days',  interval '-10 days'),
  ('d0000003-0000-4000-8000-000000000001', '5ce8331c-8094-461d-bfa4-80458504cde4', 'attended',   interval '-12 days',  interval '-10 days'),
  ('d0000003-0000-4000-8000-000000000001', '649b623d-0157-409c-9236-68e3655065f2', 'absent',     interval '-11 days',  NULL),
  ('d0000003-0000-4000-8000-000000000001', '6efb2e07-f49f-4c22-bf90-c8e686d6889d', 'attended',   interval '-11 days',  interval '-10 days'),
  ('d0000003-0000-4000-8000-000000000001', 'e0f7ab00-b355-498e-a524-61a009b225b9', 'attended',   interval '-10 days 5 hours', interval '-10 days'),
  -- Previous: Logo Design Masterclass
  ('d0000003-0000-4000-8000-000000000002', '66c27b45-cfbf-4468-b4c8-ea75487ebb1d', 'attended',   interval '-22 days',  interval '-20 days'),
  ('d0000003-0000-4000-8000-000000000002', '7347687c-99b8-48d4-8842-3804f4051419', 'attended',   interval '-21 days',  interval '-20 days'),
  ('d0000003-0000-4000-8000-000000000002', '403a64ce-877c-4e6e-a500-b470297efa35', 'absent',     interval '-21 days',  NULL),
  -- Previous: Songwriting Workshop
  ('d0000003-0000-4000-8000-000000000003', '5ce8331c-8094-461d-bfa4-80458504cde4', 'attended',   interval '-32 days',  interval '-30 days'),
  ('d0000003-0000-4000-8000-000000000003', '649b623d-0157-409c-9236-68e3655065f2', 'attended',   interval '-31 days',  interval '-30 days'),
  ('d0000003-0000-4000-8000-000000000003', 'e0f7ab00-b355-498e-a524-61a009b225b9', 'attended',   interval '-31 days',  interval '-30 days'),
  ('d0000003-0000-4000-8000-000000000003', '6efb2e07-f49f-4c22-bf90-c8e686d6889d', 'absent',     interval '-31 days',  NULL),
  -- Previous: Mobile UX Patterns
  ('d0000003-0000-4000-8000-000000000004', '7347687c-99b8-48d4-8842-3804f4051419', 'attended',   interval '-47 days',  interval '-45 days'),
  ('d0000003-0000-4000-8000-000000000004', '66c27b45-cfbf-4468-b4c8-ea75487ebb1d', 'attended',   interval '-46 days',  interval '-45 days'),
  ('d0000003-0000-4000-8000-000000000004', '403a64ce-877c-4e6e-a500-b470297efa35', 'attended',   interval '-46 days',  interval '-45 days'),
  -- Previous: Street Photography Field Guide
  ('d0000003-0000-4000-8000-000000000005', 'e0f7ab00-b355-498e-a524-61a009b225b9', 'attended',   interval '-62 days',  interval '-60 days'),
  ('d0000003-0000-4000-8000-000000000005', '5ce8331c-8094-461d-bfa4-80458504cde4', 'attended',   interval '-61 days',  interval '-60 days'),
  ('d0000003-0000-4000-8000-000000000005', '649b623d-0157-409c-9236-68e3655065f2', 'absent',     interval '-61 days',  NULL)
) AS v(webinar_id, participant_id, status, registered, attended)
ON CONFLICT (webinar_id, participant_id) DO NOTHING;

COMMIT;

-- ---------------------------------------------------------------------------
-- Cleanup (run this if you want to remove all sample webinars again).
-- Participants, speakers and category links are removed automatically.
-- ---------------------------------------------------------------------------
-- DELETE FROM webinars WHERE id::text LIKE 'd000000_-0000-4000-8000-00000000000_';
