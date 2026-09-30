-- Sample community data: 8 communities with members, channels, chat messages and reactions.
-- Run once in the Supabase SQL Editor (after migrations 001-009).
-- Community ids look like e0000000-0000-4000-8000-00000000000N (N = 1..8) so they are easy to remove;
-- a cleanup query is at the bottom. Message times are relative to now().
--
-- Users used (6): 403a64ce (u1) 5ce8331c (u2) 649b623d (u3) 66c27b45 (u4) 6efb2e07 (u5) 7347687c (u6)
-- Creators: 1 Code Crafters = u1, 2 Web Dev Circle = u2, 3 Pixel & Palette = u3, 4 Mobile Makers = u4,
--           5 Lens Lovers = u5, 6 Melody Lounge = u6, 7 Craft Corner = u1 (private), 8 Growth Marketers = u2

BEGIN;

-- ---------------------------------------------------------------------------
-- Communities
-- ---------------------------------------------------------------------------
INSERT INTO communities (id, creator_id, name, slug, description, category_id, requires_approval, is_private)
SELECT ('e0000000-0000-4000-8000-' || lpad(v.no::text, 12, '0'))::uuid, v.creator::uuid, v.name, v.slug, v.description, v.category::uuid, v.requires_approval, v.is_private
FROM (VALUES
  (1, '403a64ce-877c-4e6e-a500-b470297efa35', 'Code Crafters', 'code-crafters', 'Solve problems together, share contest tips and grow as competitive programmers.', 'c91de36a-240b-4913-aa6f-9b381687fda2', false, false),
  (2, '5ce8331c-8094-461d-bfa4-80458504cde4', 'Web Dev Circle', 'web-dev-circle', 'A friendly place to ask frontend and backend questions, review each other''s projects and share resources.', 'e604bb87-12ed-4560-a66a-45a8ad7715c8', false, false),
  (3, '649b623d-0157-409c-9236-68e3655065f2', 'Pixel & Palette', 'pixel-and-palette', 'Graphic designers sharing work in progress, feedback and design inspiration.', '758825b2-c165-4128-ae52-17be75d3f87b', true, false),
  (4, '66c27b45-cfbf-4468-b4c8-ea75487ebb1d', 'Mobile Makers', 'mobile-makers', 'Building Android and iOS apps? Swap ideas, debug together and celebrate launches.', 'a8faaddc-08d5-4b02-9146-6013d5fd6fb9', false, false),
  (5, '6efb2e07-f49f-4c22-bf90-c8e686d6889d', 'Lens Lovers', 'lens-lovers', 'Photographers of all levels: critique, photo walks, gear talk and weekly challenges.', 'cc3b8b52-a048-455e-9acb-debe9cecf6e5', true, false),
  (6, '7347687c-99b8-48d4-8842-3804f4051419', 'Melody Lounge', 'melody-lounge', 'Singers, songwriters and instrument players sharing tracks and learning from each other.', 'c0e3dff5-9854-4bb2-bf50-cfdb8001e5fc', false, false),
  (7, '403a64ce-877c-4e6e-a500-b470297efa35', 'Craft Corner', 'craft-corner', 'A private space for makers to share handmade projects, patterns and materials.', 'f0f18115-5ce9-46e8-aecf-93baeb1ae2e1', false, true),
  (8, '5ce8331c-8094-461d-bfa4-80458504cde4', 'Growth Marketers', 'growth-marketers', 'Digital marketing case studies, campaign teardowns and practical growth tactics.', 'f4c00521-9455-4ac4-8bca-960cbaee0b05', true, false)
) AS v(no, creator, name, slug, description, category, requires_approval, is_private)
ON CONFLICT (id) DO NOTHING;

-- Extra interests (migration 006)
INSERT INTO community_categories (community_id, category_id)
SELECT id, category_id FROM communities WHERE id::text LIKE 'e0000000-0000-4000-8000-00000000000_'
ON CONFLICT DO NOTHING;

INSERT INTO community_categories (community_id, category_id)
SELECT ('e0000000-0000-4000-8000-' || lpad(v.no::text, 12, '0'))::uuid, v.category::uuid FROM (VALUES
  (2, 'a8faaddc-08d5-4b02-9146-6013d5fd6fb9'),  -- Web Dev Circle + Mobile App
  (3, 'f0f18115-5ce9-46e8-aecf-93baeb1ae2e1'),  -- Pixel & Palette + Arts and Crafts
  (5, '758825b2-c165-4128-ae52-17be75d3f87b'),  -- Lens Lovers + Graphic Design
  (8, 'e604bb87-12ed-4560-a66a-45a8ad7715c8')   -- Growth Marketers + Web Development
) AS v(no, category)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- Members. Creators are approved moderators. A few pending / rejected requests.
-- ---------------------------------------------------------------------------
INSERT INTO community_members (community_id, member_id, status, is_moderator, requested_at, approved_at, approved_by)
SELECT ('e0000000-0000-4000-8000-' || lpad(v.no::text, 12, '0'))::uuid, v.member::uuid, v.status::membership_status, v.moderator,
       now() - v.joined, CASE WHEN v.status = 'approved' THEN now() - v.joined END,
       CASE WHEN v.status = 'approved' THEN (SELECT creator_id FROM communities WHERE id = ('e0000000-0000-4000-8000-' || lpad(v.no::text, 12, '0'))::uuid) END
FROM (VALUES
  -- 1 Code Crafters
  (1, '403a64ce-877c-4e6e-a500-b470297efa35', 'approved', true,  interval '30 days'),
  (1, '5ce8331c-8094-461d-bfa4-80458504cde4', 'approved', true,  interval '28 days'),
  (1, '649b623d-0157-409c-9236-68e3655065f2', 'approved', false, interval '20 days'),
  (1, '66c27b45-cfbf-4468-b4c8-ea75487ebb1d', 'approved', false, interval '12 days'),
  (1, '6efb2e07-f49f-4c22-bf90-c8e686d6889d', 'approved', false, interval '5 days'),
  -- 2 Web Dev Circle
  (2, '5ce8331c-8094-461d-bfa4-80458504cde4', 'approved', true,  interval '40 days'),
  (2, '403a64ce-877c-4e6e-a500-b470297efa35', 'approved', false, interval '35 days'),
  (2, '66c27b45-cfbf-4468-b4c8-ea75487ebb1d', 'approved', false, interval '25 days'),
  (2, '7347687c-99b8-48d4-8842-3804f4051419', 'approved', false, interval '10 days'),
  -- 3 Pixel & Palette (approval required)
  (3, '649b623d-0157-409c-9236-68e3655065f2', 'approved', true,  interval '45 days'),
  (3, '7347687c-99b8-48d4-8842-3804f4051419', 'approved', false, interval '30 days'),
  (3, '6efb2e07-f49f-4c22-bf90-c8e686d6889d', 'approved', false, interval '15 days'),
  (3, '403a64ce-877c-4e6e-a500-b470297efa35', 'pending',  false, interval '2 days'),
  (3, '66c27b45-cfbf-4468-b4c8-ea75487ebb1d', 'pending',  false, interval '1 day'),
  -- 4 Mobile Makers
  (4, '66c27b45-cfbf-4468-b4c8-ea75487ebb1d', 'approved', true,  interval '38 days'),
  (4, '5ce8331c-8094-461d-bfa4-80458504cde4', 'approved', false, interval '22 days'),
  (4, '649b623d-0157-409c-9236-68e3655065f2', 'approved', false, interval '9 days'),
  -- 5 Lens Lovers (approval required)
  (5, '6efb2e07-f49f-4c22-bf90-c8e686d6889d', 'approved', true,  interval '50 days'),
  (5, '649b623d-0157-409c-9236-68e3655065f2', 'approved', false, interval '33 days'),
  (5, '7347687c-99b8-48d4-8842-3804f4051419', 'approved', false, interval '18 days'),
  (5, '5ce8331c-8094-461d-bfa4-80458504cde4', 'pending',  false, interval '3 days'),
  (5, '66c27b45-cfbf-4468-b4c8-ea75487ebb1d', 'rejected', false, interval '8 days'),
  -- 6 Melody Lounge
  (6, '7347687c-99b8-48d4-8842-3804f4051419', 'approved', true,  interval '26 days'),
  (6, '403a64ce-877c-4e6e-a500-b470297efa35', 'approved', false, interval '14 days'),
  (6, '6efb2e07-f49f-4c22-bf90-c8e686d6889d', 'approved', false, interval '6 days'),
  -- 7 Craft Corner (private)
  (7, '403a64ce-877c-4e6e-a500-b470297efa35', 'approved', true,  interval '21 days'),
  (7, '649b623d-0157-409c-9236-68e3655065f2', 'approved', false, interval '11 days'),
  -- 8 Growth Marketers (approval required)
  (8, '5ce8331c-8094-461d-bfa4-80458504cde4', 'approved', true,  interval '19 days'),
  (8, '66c27b45-cfbf-4468-b4c8-ea75487ebb1d', 'approved', false, interval '7 days'),
  (8, '6efb2e07-f49f-4c22-bf90-c8e686d6889d', 'pending',  false, interval '1 day')
) AS v(no, member, status, moderator, joined)
ON CONFLICT (community_id, member_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Channels
-- ---------------------------------------------------------------------------
INSERT INTO community_chats (id, community_id, name, description, sort_order)
SELECT ('e1000000-0000-4000-8000-' || lpad((v.no * 10 + v.sort)::text, 12, '0'))::uuid,
       ('e0000000-0000-4000-8000-' || lpad(v.no::text, 12, '0'))::uuid, v.name, v.description, v.sort
FROM (VALUES
  (1, 0, 'general',        'Say hello and chat about anything'),
  (1, 1, 'problem-of-the-day', 'One problem a day, all approaches welcome'),
  (1, 2, 'contest-talk',   'Discuss upcoming and past contests'),
  (2, 0, 'general',        'Say hello and chat about anything'),
  (2, 1, 'help',           'Stuck? Ask here'),
  (2, 2, 'project-showcase', 'Share what you are building'),
  (3, 0, 'general',        'Say hello and chat about anything'),
  (3, 1, 'critique',       'Post work in progress for feedback'),
  (4, 0, 'general',        'Say hello and chat about anything'),
  (4, 1, 'android',        'Android questions and tips'),
  (4, 2, 'ios',            'iOS questions and tips'),
  (5, 0, 'general',        'Say hello and chat about anything'),
  (5, 1, 'weekly-challenge', 'This week''s photo theme'),
  (6, 0, 'general',        'Say hello and chat about anything'),
  (6, 1, 'share-a-track',  'Share your recordings'),
  (7, 0, 'general',        'Say hello and chat about anything'),
  (8, 0, 'general',        'Say hello and chat about anything'),
  (8, 1, 'case-studies',   'Campaign teardowns and results')
) AS v(no, sort, name, description)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- Messages (n = message number, becomes the message id suffix)
-- ---------------------------------------------------------------------------
INSERT INTO community_chat_messages (id, community_id, chat_id, sender_id, content, created_at)
SELECT ('e2000000-0000-4000-8000-' || lpad(v.n::text, 12, '0'))::uuid, c.community_id, c.id, v.sender::uuid, v.content, now() - v.ago
FROM (VALUES
  (1,  1, 'general', '403a64ce-877c-4e6e-a500-b470297efa35', 'Welcome to Code Crafters! Introduce yourself and tell us your favourite language.', interval '3 days'),
  (2,  1, 'general', '649b623d-0157-409c-9236-68e3655065f2', 'Hi everyone! Mostly C++ here, trying to get better at dynamic programming.', interval '2 days 22 hours'),
  (3,  1, 'general', '66c27b45-cfbf-4468-b4c8-ea75487ebb1d', 'Python for me. Any tips for reading problem statements faster?', interval '2 days 20 hours'),
  (4,  1, 'general', '5ce8331c-8094-461d-bfa4-80458504cde4', 'Read the constraints first. They usually tell you which approach can pass.', interval '2 days 19 hours'),
  (5,  1, 'problem-of-the-day', '5ce8331c-8094-461d-bfa4-80458504cde4', 'Today: find the longest streak of 1s in a binary array. Try O(n) with a single pass!', interval '5 hours'),
  (6,  1, 'problem-of-the-day', '6efb2e07-f49f-4c22-bf90-c8e686d6889d', 'Two pointers works nicely here. Reset the counter whenever you see a 0.', interval '4 hours'),
  (7,  1, 'contest-talk', '403a64ce-877c-4e6e-a500-b470297efa35', 'The Weekly Algorithm Sprint starts in a few days. Who is joining?', interval '1 day'),
  (8,  2, 'general', '5ce8331c-8094-461d-bfa4-80458504cde4', 'Welcome to the Web Dev Circle. Keep it friendly and keep it curious!', interval '3 days'),
  (9,  2, 'help', '66c27b45-cfbf-4468-b4c8-ea75487ebb1d', 'How do you center a div both vertically and horizontally these days?', interval '1 day 6 hours'),
  (10, 2, 'help', '403a64ce-877c-4e6e-a500-b470297efa35', 'Flexbox: display:flex; align-items:center; justify-content:center; on the parent. Grid works too with place-items:center.', interval '1 day 5 hours'),
  (11, 2, 'help', '66c27b45-cfbf-4468-b4c8-ea75487ebb1d', 'That did it, thank you!', interval '1 day 5 hours'),
  (12, 2, 'project-showcase', '7347687c-99b8-48d4-8842-3804f4051419', 'Just finished my portfolio site: responsive, dark mode and zero dependencies. Feedback welcome!', interval '8 hours'),
  (13, 2, 'project-showcase', '5ce8331c-8094-461d-bfa4-80458504cde4', 'Looks great! The dark mode contrast is really well balanced.', interval '7 hours'),
  (14, 3, 'general', '649b623d-0157-409c-9236-68e3655065f2', 'Welcome designers! Share your process, not just the final result.', interval '2 days'),
  (15, 3, 'critique', '7347687c-99b8-48d4-8842-3804f4051419', 'Working on a poster for a book fair. Is the title too small on mobile?', interval '10 hours'),
  (16, 3, 'critique', '6efb2e07-f49f-4c22-bf90-c8e686d6889d', 'I would bump it up a size and add more spacing above. The colours are lovely.', interval '9 hours'),
  (17, 4, 'general', '66c27b45-cfbf-4468-b4c8-ea75487ebb1d', 'Mobile Makers is open. Post your questions in the right channel and we will help.', interval '2 days'),
  (18, 4, 'android', '5ce8331c-8094-461d-bfa4-80458504cde4', 'Anyone using Jetpack Compose in production? How was the migration?', interval '20 hours'),
  (19, 4, 'android', '66c27b45-cfbf-4468-b4c8-ea75487ebb1d', 'Yes! Migrate screen by screen and keep the old views inside AndroidView until you are ready.', interval '19 hours'),
  (20, 4, 'ios', '649b623d-0157-409c-9236-68e3655065f2', 'What is the easiest way to test push notifications on a simulator?', interval '6 hours'),
  (21, 5, 'general', '6efb2e07-f49f-4c22-bf90-c8e686d6889d', 'Welcome to Lens Lovers! Be kind with critiques and generous with tips.', interval '4 days'),
  (22, 5, 'weekly-challenge', '6efb2e07-f49f-4c22-bf90-c8e686d6889d', 'This week''s theme: reflections. Post your best shot by Sunday.', interval '1 day 2 hours'),
  (23, 5, 'weekly-challenge', '7347687c-99b8-48d4-8842-3804f4051419', 'Puddle reflection after the rain. Trying to keep the horizon straight!', interval '3 hours'),
  (24, 6, 'general', '7347687c-99b8-48d4-8842-3804f4051419', 'Hello musicians! What is everyone practising this week?', interval '2 days'),
  (25, 6, 'general', '403a64ce-877c-4e6e-a500-b470297efa35', 'Learning fingerstyle guitar. My thumb hurts but it sounds better every day.', interval '1 day 21 hours'),
  (26, 6, 'share-a-track', '6efb2e07-f49f-4c22-bf90-c8e686d6889d', 'Shared my first acoustic cover today. Nervous but happy!', interval '12 hours'),
  (27, 7, 'general', '403a64ce-877c-4e6e-a500-b470297efa35', 'Welcome to Craft Corner. This is a private space, so share freely.', interval '10 days'),
  (28, 7, 'general', '649b623d-0157-409c-9236-68e3655065f2', 'Finished a macramé wall hanging! Photos coming soon.', interval '2 days'),
  (29, 8, 'general', '5ce8331c-8094-461d-bfa4-80458504cde4', 'Growth Marketers: keep posts practical and share numbers when you can.', interval '5 days'),
  (30, 8, 'case-studies', '66c27b45-cfbf-4468-b4c8-ea75487ebb1d', 'Our newsletter grew 40% in a month by adding a single clear call to action.', interval '1 day 3 hours')
) AS v(n, no, channel, sender, content, ago)
JOIN community_chats c ON c.community_id = ('e0000000-0000-4000-8000-' || lpad(v.no::text, 12, '0'))::uuid AND c.name = v.channel
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Reactions on messages: like, love, celebrate, insightful, curious
-- ---------------------------------------------------------------------------
INSERT INTO community_chat_message_reactions (message_id, user_id, reaction)
SELECT ('e2000000-0000-4000-8000-' || lpad(v.n::text, 12, '0'))::uuid, v.member::uuid, v.reaction::reaction_kind
FROM (VALUES
  (1,  '5ce8331c-8094-461d-bfa4-80458504cde4', 'like'),
  (1,  '649b623d-0157-409c-9236-68e3655065f2', 'love'),
  (1,  '66c27b45-cfbf-4468-b4c8-ea75487ebb1d', 'like'),
  (4,  '66c27b45-cfbf-4468-b4c8-ea75487ebb1d', 'insightful'),
  (4,  '649b623d-0157-409c-9236-68e3655065f2', 'insightful'),
  (4,  '403a64ce-877c-4e6e-a500-b470297efa35', 'like'),
  (5,  '403a64ce-877c-4e6e-a500-b470297efa35', 'curious'),
  (6,  '5ce8331c-8094-461d-bfa4-80458504cde4', 'like'),
  (7,  '649b623d-0157-409c-9236-68e3655065f2', 'celebrate'),
  (7,  '6efb2e07-f49f-4c22-bf90-c8e686d6889d', 'celebrate'),
  (10, '66c27b45-cfbf-4468-b4c8-ea75487ebb1d', 'like'),
  (10, '5ce8331c-8094-461d-bfa4-80458504cde4', 'insightful'),
  (10, '7347687c-99b8-48d4-8842-3804f4051419', 'like'),
  (12, '5ce8331c-8094-461d-bfa4-80458504cde4', 'celebrate'),
  (12, '403a64ce-877c-4e6e-a500-b470297efa35', 'love'),
  (12, '66c27b45-cfbf-4468-b4c8-ea75487ebb1d', 'celebrate'),
  (13, '7347687c-99b8-48d4-8842-3804f4051419', 'love'),
  (14, '7347687c-99b8-48d4-8842-3804f4051419', 'like'),
  (16, '7347687c-99b8-48d4-8842-3804f4051419', 'insightful'),
  (16, '649b623d-0157-409c-9236-68e3655065f2', 'like'),
  (19, '5ce8331c-8094-461d-bfa4-80458504cde4', 'insightful'),
  (19, '649b623d-0157-409c-9236-68e3655065f2', 'like'),
  (21, '649b623d-0157-409c-9236-68e3655065f2', 'love'),
  (23, '6efb2e07-f49f-4c22-bf90-c8e686d6889d', 'love'),
  (23, '649b623d-0157-409c-9236-68e3655065f2', 'celebrate'),
  (23, '7347687c-99b8-48d4-8842-3804f4051419', 'love'),
  (25, '7347687c-99b8-48d4-8842-3804f4051419', 'celebrate'),
  (26, '7347687c-99b8-48d4-8842-3804f4051419', 'love'),
  (26, '403a64ce-877c-4e6e-a500-b470297efa35', 'like'),
  (28, '403a64ce-877c-4e6e-a500-b470297efa35', 'love'),
  (30, '5ce8331c-8094-461d-bfa4-80458504cde4', 'insightful')
) AS v(n, member, reaction)
ON CONFLICT DO NOTHING;

COMMIT;

-- ---------------------------------------------------------------------------
-- Cleanup (removes these 8 communities with their members, channels, messages and reactions):
-- ---------------------------------------------------------------------------
-- DELETE FROM communities WHERE id::text LIKE 'e0000000-0000-4000-8000-00000000000_';
