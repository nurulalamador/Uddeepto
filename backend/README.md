# Uddeepto Backend

Plain JavaScript, Express, direct PostgreSQL (`pg`) এবং Supabase-hosted PostgreSQL-এর জন্য microservice backend। Prisma/ORM ব্যবহার করা হয়নি।

## Architecture

| Service | Port | Gateway path |
|---|---:|---|
| Load balancer | 4000 | public entry point, `/api/v1/*` |
| Gateway 1 / Gateway 2 | 4101 / 4102 | internal copies of the gateway |
| Auth | 4001 | `/api/v1/auth` |
| Users/Profile | 4002 | `/api/v1/users` |
| Courses | 4003 | `/api/v1/courses` |
| Communities + Showcase | 4004 | `/api/v1/communities`, `/api/v1/showcase` |
| Contests | 4005 | `/api/v1/contests` |
| Webinars | 4006 | `/api/v1/webinars` |
| Jobs | 4007 | `/api/v1/jobs` |
| Direct messages | 4008 | `/api/v1/messages` |
| Payments | 4009 | `/api/v1/payments` |

## Load balancer

```
client / Next.js BFF -> load balancer :4000 -> gateway-1 :4101 / gateway-2 :4102 -> services
```

`services/loadbalancer` is a small dependency-free Node HTTP balancer. Callers keep using port 4000 (`BACKEND_URL`), so nothing in the frontend changes.

- **Distribution:** round-robin by default; `LB_STRATEGY=least-connections` sends work to the least busy gateway.
- **Health checks:** each gateway's `/health` is probed every 5 s (every 1 s while it is down). Two failures take it out of rotation; one success brings it back. A refused or reset connection removes it immediately.
- **Failover:** `GET`/`HEAD`/`OPTIONS` requests that hit a dead gateway are retried on the other one. `POST`/`PUT`/`DELETE` are never replayed, so nothing is created twice. If no gateway is healthy the balancer answers `503` with `Retry-After`.
- **Streaming:** bodies are piped, not buffered, so large uploads, Range requests and downloads work as before.
- **Endpoints:** `GET /health` (balancer + how many gateways are healthy; use this for the platform health check), `GET /lb/status` (per-gateway detail; localhost only, or send header `x-lb-token` matching `LB_STATUS_TOKEN`).
- **Which copy answered:** every response carries `X-Gateway-Instance` and `X-Load-Balancer`.
- **Config:** `LB_PORT`, `GATEWAY_URLS` (comma separated), `LB_STRATEGY`, `LB_STATUS_TOKEN`. Run another gateway copy with `npm start -w services/gateway -- --port=4103 --id=gateway-3` and add its URL to `GATEWAY_URLS`.
- **Tests:** `npm run test:lb`.
- **Docker:** `docker-compose.yml` starts `loadbalancer` + `gateway-1` + `gateway-2` and the services.

Things that stay per-gateway: the gateway's in-memory rate limit (180 requests/min) is counted separately in each copy, so the effective total is roughly doubled. Only the gateway is replicated; the services behind it are still one copy each.

## Supabase setup

1. Supabase Dashboard → SQL Editor-এ `database/001_initial_schema.sql` চালান।
2. এরপর `database/002_auth_sessions.sql` চালান।
3. Admin platform settings চালুর জন্য `database/003_platform_settings.sql` চালান।
4. পুরোনো database হলে `database/004_instructors.sql` চালিয়ে instructor user account-গুলোকে learner login রেখে আলাদা instructor profile-এ রূপান্তর করুন। নতুন database-এও migration চালানো নিরাপদ।
5. Profile cover, course cover এবং instructor profile-এর designation/social links যোগ করতে `database/005_profile_course_media.sql` চালান।
6. Project Settings → Database → Connection string → **Transaction pooler** URI নিন। `.env.example` কপি করে `.env` বানিয়ে password/region বসান। Password-এ special character থাকলে URL encode করুন।
7. Secret তৈরি করুন: `openssl rand -base64 48` (Windows PowerShell-এ শক্তিশালী random secret generator ব্যবহার করুন)। দুইটি আলাদা secret দিন।

প্রথম admin account bootstrap করতে প্রথমে normal learner account তৈরি করুন, তারপর Supabase SQL Editor থেকে সেই নির্দিষ্ট account-কে promote করুন:

```sql
UPDATE users SET role = 'admin' WHERE email = 'admin@example.com';
```

এরপর Admin → Management থেকে বাকি admin account তৈরি করুন। Public registration-এ admin role দেওয়া যায় না।

## Run

```bash
npm install
npm run check
npm run dev
```

Docker optional; Docker ছাড়া উপরের command-ই যথেষ্ট। API base URL: `http://localhost:4000/api/v1`।

## Authentication

Register: `POST /auth/register`; login: `POST /auth/login`; refresh: `POST /auth/refresh`; logout: `POST /auth/logout`; change password: `POST /auth/change-password`। Protected API-তে `Authorization: Bearer ACCESS_TOKEN` পাঠান। Access token 15 মিনিট এবং rotating refresh token 30 দিন default। Refresh tokens database-এ SHA-256 hash হিসেবে থাকে।

Example register body:

```json
{"name":"Rubayat Hossain","email":"rubayat@example.com","username":"rubayat","password":"a-long-password","role":"learner"}
```

## Main API conventions

Most feature roots support `GET /`, `GET /:id`, `POST /`, `PATCH /:id`, `DELETE /:id`; list endpoints accept `limit`, `offset`, and supported endpoints accept `q`. Ownership and role checks are enforced for writes.

Admin Management supports searchable, date-filtered tables, user creation, bulk status/delete actions and admin publishing. Platform Settings can pause public registration and require admin review before creator-submitted content is published; both controls are enforced by the APIs.

Admin Management-এর Instructors section-এ নাম, profile image, এবং details যোগ বা সরানো যায়। Admin course তৈরি ও সম্পাদনার সময় instructor search করে assign করে। `instructor` আর user role নয়; migration পুরোনো instructor account-কে learner login হিসেবে রেখে তার profile data নতুন entity-তে নেয়।

- Profile: `GET/PATCH /users/me`, `PUT /users/me/picture`, `PUT /users/me/interests`
- Courses: materials, material content, enroll, my enrollments
- Communities: join, chats, chat messages; Showcase: feed, comment, reaction, report
- Contests: join, problems, submit, leaderboard
- Webinars: register, my registrations
- Jobs: apply with multipart `resume`, list my applications, hirer updates status
- Messages: create/list conversations, send/read messages
- Payments: create intent; admin confirmation transactionally enrolls/joins

Files use `multipart/form-data`. The schema stores files as `BYTEA`; production-scale media should later move to Supabase Storage.

## Production notes

The services intentionally share one database because the supplied schema has cross-feature foreign keys and payment transactions. Deploy each service separately and set its internal URL in the gateway. Put internal services on a private network. Payment `confirm` is an admin-only development adapter—replace it with a verified provider webhook before accepting real money. Add Redis/event broker only when async notifications or independently scaled consumers are needed.
