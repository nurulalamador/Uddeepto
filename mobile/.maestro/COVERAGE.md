# Android feature coverage and remaining work

Reviewed against mobile source on 2026-10-30. **259 authored scenarios, zero device executions.** No emulator, app tests or fixture server was launched while preparing this expansion. Counts describe independent YAML entry points, not helpers, assertions or pass results. This is a source coverage inventory, not a percentage or a claim that every possible case is complete.

## Feature map

| Feature | Cases | Authored checks |
| --- | ---: | --- |
| [Authentication and registration](flows/auth/) | 21 | Valid and invalid login, registration, duplicates, whitespace, roles, password visibility and blocked accounts. |
| [Navigation, session and sign out](flows/navigation/) | 10 | Learner and hirer tabs, persistence, sign out, cancellation, Android back and restricted deep links. |
| [Search](flows/search/) | 9 | Minimum query, empty results, result navigation for users, courses, jobs, contests and webinars, clear and hirer restrictions. |
| [Profile, active hirer jobs and interests](flows/profile/) | 27 | Own and other profiles, active hirer jobs and detail navigation, status/deadline exclusions, copying ID, fields, interests, profile image and cover. |
| [Education](flows/education/) | 10 | Empty and required fields, date rules, current study, create, edit, discard, delete cancellation and deletion. |
| [Experience](flows/experience/) | 12 | Required fields and category, Others, date rules, current employment, create, edit, discard and deletion. |
| [Showcase and media](flows/showcase/) | 23 | Text and image posts, video/audio selection, filters, empty results, pagination, menus, reporting, deletion, comments and appreciation persistence. |
| [Course learning and original event flows](flows/learning/) | 17 | Enrollment, paid-course refusal, preview and locked materials, progress, previous/next, instructor, catalog filtering and pagination; original contest/webinar flows. |
| [Additional contest and webinar cases](flows/events/) | 11 | Contest and webinar phase filters, empty search, participant checks, membership persistence, whitespace entries, speakers and timed meeting link visibility. |
| [Jobs, applications and hiring](flows/jobs/) | 28 | Details, empty/search/filter lists, posting validation, remote fields, November day limit, applications with saved or uploaded CV, duplicate prevention, expiration, pagination and applicant actions. |
| [Messages and communities](flows/messages/) | 19 | Empty/search/new conversation, draft validation, access control, direct and community sending, private membership, leaving, live receive and reconnect after restart. |
| [Notifications](flows/notifications/) | 6 | Category filters, marking read, empty state and linked post/job navigation. |
| [Settings and account changes](flows/settings/) | 10 | Preference persistence, password validation, current password refusal, same-password refusal, deletion confirmation and wrong deletion password. |
| [CV and AI](flows/cv-ai/) | 24 | CV profile defaults, required name, preview, five templates, accent, skills, projects, ordering, reset, PDF upload/rejection/removal and AI missing-key handling. |
| [Leaderboard](flows/leaderboard/) | 3 | Complete board navigation, profile navigation and interest filtering. |
| [Video checkpoint quizzes](flows/video/) | 11 | Checkpoint display and non-dismissal, partial answers, failure and retry, pass threshold, next checkpoint, saved passes, final completion, completed replay and enrollment access. |
| [Android permissions](flows/permissions/) | 2 | Navigation with optional permissions denied and system photo selection without broad storage access. |
| [Missing resources](flows/errors/) | 4 | Missing job, course, post and profile show retry instead of usable private detail controls. |
| [Transport, session renewal and retry](flows/network/) | 12 | Temporary failures, dropped requests, renewal and rejected refresh, edit/draft retention, upload 413/503, application, signup and quiz retry. |
| **Total** | **259** | **All authored, not executed.** |

The [case catalog](CASES.md) links each individual flow. Original M001 to M084 IDs remain stable. M085 to M259 add validation, persistence, access control, native media, video and failure recovery cases. Several original event checks remain in the learning group; the events group contains the added phase and membership cases. Each YAML file is counted once.

## Regressions with specific prerequisites

| Risk | Source cases and preparation |
| --- | --- |
| Hirer active jobs missing from profiles | The profile flows cover own/other accounts, job detail opening and isolated empty/status/deadline fixtures. |
| Native picture uploads failing before reaching the server | Original image upload and restart regression, video/audio cases, plus M255 and M256 for preserved attachments after 503/413. Actual phone upload still needs execution. |
| Education or experience updates not persisting | M115 to M136 create independent actors and cover validation, edits, deletion and reopening. Original profile cases also cover empty required fields. |
| Checkpoint quiz gates or saved progress being bypassed | M231 to M241 use one local nine-second MP4, cached questions and fresh enrollment. M259 authors fetch-failure recovery. |
| Session renewal losing the user or retrying incorrectly | M250 and M251 inject bounded 401 responses before real refresh/retry or sign out. This models the HTTP contract, not clock-based token expiry. |
| HTTP errors dropping unsaved work | M252 to M258 cover retained profile edits, chat drafts, CV drafts, post attachments, application details and signup fields. |
| A previous test determining the next result | Expanded state-changing cases create their own users and prerequisite records. Original mutating flows use dedicated baseline actors. Restart fixtures before repeating a full run. |

## Still needed before release confidence

These are explicit gaps and follow-up checks, not additional authored case IDs or passing tests:

| Area | Remaining work |
| --- | --- |
| Physical Android execution | Run the authored flows sequentially on a dedicated phone and adjust accessibility/native selectors, scrolling, timing, cropping and document picker behavior from actual evidence. |
| Device and lifecycle matrix | Different supported Android versions and OEMs, permanently denied permissions, restricted photo access, interrupted upload, background/foreground, low storage, screen/keyboard sizes and accessibility settings. |
| Media boundaries | Multiple attachments up to the ten-file limit, oversized files and real 10 MB rejection, slow/cancelled transfers, bad MIME types, unsupported codecs and playback seeking. Injected 413 only checks the client error path. |
| Maps and external integrations | Native WebView map marker selection and opening jobs; offline map assets; OS sharing/downloading PDFs; external meeting application handoff; successful Gemini responses and actual payment completion. |
| Further UI combinations | Full sort ordering combinations, pull-to-refresh across lists, richer CV education/experience/certification row editing, and image/audio contest entries. Existing cases cover the main text/code event path and CV project row editing. |
| Realtime edge cases | Two physical clients, simultaneous sends, duplicate/out-of-order events, unread/read synchronization, background reconnect and server restart while chatting. A connected incoming-message check and app-restart reconnect are authored. |
| Backend deployment parity | Run suitable contract/integration checks for both backend deployments and real object/file storage. This local harness starts backendSimple only. |
| Existing implementation issues | Hirer create-job status is treated as draft by current API policy; app lint has 15 existing errors and 23 warnings. These are not fixed by adding Maestro sources. |
| Video fallback | Question generation unavailable, malformed questions, long lecture seeking and skip/completion fallback still need dedicated investigation and device cases. Seeded local quiz cases do not prove these branches. |

## Validation record

- Static YAML, commands, referenced scripts/media/helpers, environment variables and catalog consistency: passed at authoring time.
- TypeScript: passed.
- Maestro JavaScript lint: zero errors and warnings. Windows import resolution was checked with case-sensitive ancestor traversal disabled to avoid an EPERM on C:/Users/HP; application rules were otherwise retained.
- App source lint: 15 existing errors and 23 warnings. No React hook rule was disabled to hide them.
- Maestro execution, Android installation, fixture startup and emulator usage: none.

See [README.md](README.md) for the opt-in physical-phone workflow. Authoring and static checking do not certify runtime behavior.
