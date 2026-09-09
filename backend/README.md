# Uddeepto Backend

Plain JavaScript, Express, direct PostgreSQL (`pg`) এবং Supabase-hosted PostgreSQL-এর জন্য microservice backend। Prisma/ORM ব্যবহার করা হয়নি।

## Architecture

| Service | Port | Gateway path |
|---|---:|---|
| Gateway | 4000 | `/api/v1/*` |
| Auth | 4001 | `/api/v1/auth` |
| Users/Profile | 4002 | `/api/v1/users` |
| Courses | 4003 | `/api/v1/courses` |
| Communities + Showcase | 4004 | `/api/v1/communities`, `/api/v1/showcase` |
| Contests | 4005 | `/api/v1/contests` |
| Webinars | 4006 | `/api/v1/webinars` |
| Jobs | 4007 | `/api/v1/jobs` |
| Direct messages | 4008 | `/api/v1/messages` |
| Payments | 4009 | `/api/v1/payments` |

## Supabase setup

1. Supabase Dashboard → SQL Editor-এ মূল `uddeepto_postgresql_schema.sql` চালান।
2. এরপর `database/002_auth_sessions.sql` চালান।
3. Project Settings → Database → Connection string → **Transaction pooler** URI নিন। `.env.example` কপি করে `.env` বানিয়ে password/region বসান। Password-এ special character থাকলে URL encode করুন।
4. Secret তৈরি করুন: `openssl rand -base64 48` (Windows PowerShell-এ শক্তিশালী random secret generator ব্যবহার করুন)। দুইটি আলাদা secret দিন।

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
