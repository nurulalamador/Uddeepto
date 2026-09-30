-- Sample jobs with map positions, posted by three hirers.
-- Run once in the Supabase SQL Editor (after migrations 001-011).
-- Fixed ids (f0000000-0000-4000-8000-0000000000NN) make them easy to remove; cleanup query at the bottom.
-- Most jobs are in and around Dhaka so the "jobs near me" map has something to show; a few are in
-- other cities and two are remote (remote jobs have no map position).

BEGIN;

INSERT INTO jobs (id, creator_id, category_id, title, description, salary_min, salary_max, currency, salary_period, location, latitude, longitude, criteria, type, is_remote, status, application_deadline)
SELECT ('f0000000-0000-4000-8000-' || lpad(v.no::text, 12, '0'))::uuid, v.creator::uuid, v.category::uuid, v.title, v.description,
       v.salary_min, v.salary_max, 'BDT', v.period, v.location, v.lat, v.lng, v.criteria::jsonb, v.type::job_type, v.remote, 'open'::job_status,
       now() + v.deadline
FROM (VALUES
  (1,  '053a1376-9a57-4b57-b711-ca9864bfa304', 'e604bb87-12ed-4560-a66a-45a8ad7715c8', 'Junior Frontend Developer', 'Build responsive interfaces with React and work closely with designers. Great first job for a recent graduate.', 30000::numeric, 45000::numeric, 'monthly', 'Gulshan 2, Dhaka', 23.794700::numeric, 90.414100::numeric, '["Good knowledge of HTML, CSS and JavaScript","Familiarity with React","Portfolio of small projects"]', 'permanent', false, interval '20 days'),
  (2,  '053a1376-9a57-4b57-b711-ca9864bfa304', 'e604bb87-12ed-4560-a66a-45a8ad7715c8', 'Backend Engineer (Node.js)', 'Design and ship APIs used by thousands of learners. You will own services end to end.', 60000, 90000, 'monthly', 'Banani, Dhaka', 23.793700, 90.404300, '["2+ years with Node.js","Experience with PostgreSQL","Comfortable with code reviews"]', 'permanent', false, interval '25 days'),
  (3,  '053a1376-9a57-4b57-b711-ca9864bfa304', 'a8faaddc-08d5-4b02-9146-6013d5fd6fb9', 'Mobile App Developer', 'Build our Flutter learner app and ship weekly releases.', 50000, 80000, 'monthly', 'Mohakhali, Dhaka', 23.778100, 90.405400, '["Flutter or React Native experience","Published at least one app"]', 'contract', false, interval '18 days'),
  (4,  'b4f2f42d-49bc-4773-87fb-7cc6eb8855be', '758825b2-c165-4128-ae52-17be75d3f87b', 'Graphic Designer', 'Create social media graphics, posters and brand assets for campaigns.', 25000, 40000, 'monthly', 'Dhanmondi 27, Dhaka', 23.756800, 90.375300, '["Strong Adobe Illustrator and Photoshop skills","A portfolio you are proud of"]', 'permanent', false, interval '15 days'),
  (5,  'b4f2f42d-49bc-4773-87fb-7cc6eb8855be', 'f4c00521-9455-4ac4-8bca-960cbaee0b05', 'Digital Marketing Intern', 'Support campaign planning, content calendars and reporting. Mentorship included.', 8000, 12000, 'monthly', 'Motijheel, Dhaka', 23.732900, 90.417200, '["Curious about marketing","Good written English"]', 'internship', false, interval '12 days'),
  (6,  'b4f2f42d-49bc-4773-87fb-7cc6eb8855be', 'cc3b8b52-a048-455e-9acb-debe9cecf6e5', 'Event Photographer (one day)', 'Photograph a full-day tech conference and deliver 100 edited photos within 3 days.', 12000, 12000, 'fixed', 'Bashundhara R/A, Dhaka', 23.813300, 90.424200, '["Own camera and lenses","Experience shooting events"]', 'one_time', false, interval '10 days'),
  (7,  '63962802-4e24-4f8e-8ae5-7927d8dfef58', 'c91de36a-240b-4913-aa6f-9b381687fda2', 'Competitive Programming Coach', 'Train school students for programming olympiads twice a week.', 800, 1200, 'hourly', 'Uttara Sector 7, Dhaka', 23.875900, 90.397800, '["Strong algorithms background","Contest experience","Patient with beginners"]', 'part_time', false, interval '30 days'),
  (8,  '63962802-4e24-4f8e-8ae5-7927d8dfef58', 'e604bb87-12ed-4560-a66a-45a8ad7715c8', 'WordPress Developer (freelance)', 'Customise themes and build landing pages for small businesses.', 15000, 30000, 'fixed', 'Mirpur 10, Dhaka', 23.806900, 90.368700, '["WordPress and PHP experience","Can work independently"]', 'freelance', false, interval '22 days'),
  (9,  '63962802-4e24-4f8e-8ae5-7927d8dfef58', 'f0f18115-5ce9-46e8-aecf-93baeb1ae2e1', 'Craft Workshop Instructor', 'Lead weekend craft workshops for kids and adults.', 3000, 5000, 'daily', 'Savar, Dhaka', 23.858300, 90.266700, '["Experience teaching hands-on skills","Own portfolio of handmade work"]', 'part_time', false, interval '16 days'),
  (10, '053a1376-9a57-4b57-b711-ca9864bfa304', 'c0e3dff5-9854-4bb2-bf50-cfdb8001e5fc', 'Music Teacher (Guitar)', 'Teach beginner and intermediate guitar students.', 20000, 30000, 'monthly', 'Agrabad, Chattogram', 22.324800, 91.812600, '["Solid guitar skills","Teaching experience preferred"]', 'part_time', false, interval '21 days'),
  (11, 'b4f2f42d-49bc-4773-87fb-7cc6eb8855be', 'e604bb87-12ed-4560-a66a-45a8ad7715c8', 'Full-stack Developer', 'Work across our Next.js frontend and Node.js services for a growing product team.', 70000, 110000, 'monthly', 'Zindabazar, Sylhet', 24.895600, 91.868700, '["3+ years full-stack experience","Comfortable with cloud deployments"]', 'permanent', false, interval '28 days'),
  (12, '63962802-4e24-4f8e-8ae5-7927d8dfef58', 'f4c00521-9455-4ac4-8bca-960cbaee0b05', 'SEO Specialist', 'Own organic growth for our learning platform.', 40000, 65000, 'monthly', 'Shaheb Bazar, Rajshahi', 24.374500, 88.604200, '["Proven SEO results","Analytics tools experience"]', 'contract', false, interval '24 days'),
  (13, '053a1376-9a57-4b57-b711-ca9864bfa304', 'e604bb87-12ed-4560-a66a-45a8ad7715c8', 'Remote Technical Writer', 'Write clear tutorials and API documentation from anywhere.', 35000, 55000, 'monthly', NULL, NULL, NULL, '["Excellent written English","Can read and explain code"]', 'contract', true, interval '26 days'),
  (14, 'b4f2f42d-49bc-4773-87fb-7cc6eb8855be', '758825b2-c165-4128-ae52-17be75d3f87b', 'Remote UI Designer', 'Design product screens in Figma and hand them over to the engineering team.', 45000, 70000, 'monthly', NULL, NULL, NULL, '["Strong Figma skills","Understanding of design systems"]', 'freelance', true, interval '19 days')
) AS v(no, creator, category, title, description, salary_min, salary_max, period, location, lat, lng, criteria, type, remote, deadline)
ON CONFLICT (id) DO NOTHING;

COMMIT;

-- Cleanup (also removes any applications to these jobs):
-- DELETE FROM jobs WHERE id::text LIKE 'f0000000-0000-4000-8000-0000000000__';
