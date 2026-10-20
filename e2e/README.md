# Uddeepto end-to-end tests (Selenium)

Browser tests for every role - **learner**, **hirer**, **admin** - plus the public pages (login, sign-up, 404).
They drive a real Chrome against a real production build of the frontend and the real backend, but with an
**isolated in-memory database** (PGlite), so nothing here can touch your Supabase data. `GEMINI_API_KEY` is
forced empty, so the AI assistant answers "not configured" instead of calling Google.

## Run

```bash
cd e2e
npm install
npm test                 # everything: boots the stack, runs all files, shuts it down
npm run test:learner     # files named learner-*.test.mjs
npm run test:hirer
npm run test:admin
npm run test:public
node run.mjs learner-jobs        # any file whose name contains the text
node run.mjs --stack-only        # boot the stack and leave it running (to write tests / run one file by hand)
```

With a stack already running (`--stack-only`), run a single file directly:

```bash
E2E_BASE_URL=http://127.0.0.1:3200 E2E_API_URL=http://127.0.0.1:4400/api/v1 node --test tests/admin-users.test.mjs
```

| Variable | Effect |
| --- | --- |
| `E2E_SKIP_BUILD=1` | reuse the last frontend build (faster) |
| `E2E_HEADED=1` | show the browser window |
| `E2E_BROWSER=chrome\|edge\|firefox` | pick the browser (default chrome) |
| `E2E_TIMEOUT=ms` | per-wait timeout (default 12000) |
| `E2E_AI_MOCK=1` | answer AI requests with a local fake Gemini (needed by `learner-video-quiz`, which is skipped otherwise): `E2E_AI_MOCK=1 node run.mjs learner-video-quiz` |

Ports: database 54329, backend 4400, website 3200. A failing test saves a screenshot to `artifacts/`.
`node inspect-cv.mjs` (with `--stack-only` running) saves one sample PDF per CV template to `artifacts/cv/` so the layouts can be looked at.
`node inspect.mjs <learner|hirer|admin> <route>` prints what a page looks like (text, links, fields) for writing selectors.

## Layout

- `run.mjs` - boots the stack, runs the test files one at a time (they share one database), stops the stack.
- `lib/stack.mjs`, `database.mjs`, `seed.mjs` - the isolated stack and its baseline data (4 interests, courses, contests, webinars, jobs, communities, posts and the accounts below).
- `lib/browser.mjs` - Selenium helpers (waiting, clicking, typing, dropdowns, confirm dialogs, cookie sign-in, API calls as an account).
- `lib/factory.mjs` - creates fresh records through the real API so each test sets up its own data.
- `lib/flows.mjs`, `lib/admin.mjs`, `lib/live.mjs`, `lib/fixtures.mjs` - reusable journeys, admin-table helpers, Socket.IO client, upload files.
- `tests/` - the suites:

| Role | Files |
| --- | --- |
| public | `public-auth` |
| learner | `learner-shell`, `-showcase`, `-courses`, `-contests`, `-webinars`, `-communities`, `-jobs`, `-messages`, `-notifications`, `-profile`, `-onboarding-ai`, `-cv` (My CV, CV Generator, applying with a CV), `-video-quiz` (needs `E2E_AI_MOCK=1`), `-video-fallback` (no AI key) |
| hirer | `hirer-shell`, `-jobs`, `-social` |
| admin | `admin-shell` (navigation, dashboard, notifications, settings), `-users`, `-catalog` (interests, instructors, courses, materials), `-events` (contests, judging, webinars, jobs, communities), `-moderation` |

## Accounts

All passwords are `Passw0rd!123`. Usernames: `learner1` (Lena Learner), `learner2` (Liam), `hirer1` (Hana Hirer), `hirer2` (Hugo),
`admin1` (Ada Admin), a suspended `banned` user and a `newbie` with no interests.
Tests that need a clean slate create their own users with `makeLearner()` / `makeHirer()`.
