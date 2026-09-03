# Express.js Microservices Backend — Plain JavaScript + Supabase

A plain **JavaScript (ES Modules)** Express.js microservices starter using Prisma and Supabase PostgreSQL. There is no TypeScript, no `tsconfig`, no `tsx`, and no compile/build step.

## Stack

- Node.js 22+
- Express 5
- Plain JavaScript (ESM)
- Prisma 7.10
- Supabase PostgreSQL
- Zod validation
- JWT access + refresh tokens
- bcrypt password hashing
- API Gateway
- Optional Redis rate limiting
- Optional RabbitMQ domain events

## Services

```text
Client / Frontend
       |
       v
API Gateway :8080
       |
       |-- /api/auth, /api/users  ---> user-service      :3001
       |-- /api/courses           ---> course-service    :3002
       |-- /api/jobs              ---> job-service       :3003
       |-- /api/contests          ---> contest-service   :3004
       `-- /api/communities       ---> community-service :3005
                                            |
                                            v
                                    Supabase PostgreSQL
```

One Supabase database is used. Each service owns a separate PostgreSQL schema:

```text
users
courses
jobs
contests
communities
```

Supabase is used as managed PostgreSQL. Login/registration is handled by the included Express/JWT auth service, not Supabase Auth.

## Requirements

- Node.js 22.12+
- npm
- A Supabase project

Redis and RabbitMQ are optional.

## 1. Install dependencies

From the project root:

```bash
npm install
```

## 2. Configure Supabase

Open your Supabase project and go to **Connect**. Use:

- Transaction pooler URL for `SUPABASE_DATABASE_URL`
- Session pooler/direct URL for `SUPABASE_DIRECT_URL`

Copy the root environment file.

### Windows PowerShell

```powershell
Copy-Item .env.example .env
```

### macOS/Linux

```bash
cp .env.example .env
```

Edit `.env`:

```env
SUPABASE_DATABASE_URL=YOUR_SUPABASE_TRANSACTION_POOLER_URL
SUPABASE_DIRECT_URL=YOUR_SUPABASE_SESSION_OR_DIRECT_URL

JWT_ACCESS_SECRET=replace-this-with-a-long-random-secret-at-least-32-characters
JWT_ACCESS_TTL=15m
REFRESH_TOKEN_DAYS=30

CORS_ORIGINS=http://localhost:3000,http://localhost:5173

REDIS_URL=
RABBITMQ_URL=
```

Do not expose database URLs or JWT secrets in frontend code.

## 3. Initialize schemas and Prisma

```bash
npm run setup:supabase
```

This command:

1. Connects to Supabase using `SUPABASE_DIRECT_URL`.
2. Creates `users`, `courses`, `jobs`, `contests`, and `communities` schemas if missing.
3. Creates `.env` files for all services.
4. Generates one Prisma JavaScript client per service.
5. Pushes each service schema to Supabase.

The project uses service-local Prisma Client output so one microservice cannot overwrite another service's generated client.

## 4. Start development mode

```bash
npm run dev
```

`node --watch` is used directly. No TypeScript compiler or build command is required.

```text
API Gateway        http://localhost:8080
User/Auth Service  http://localhost:3001
Course Service     http://localhost:3002
Job Service        http://localhost:3003
Contest Service    http://localhost:3004
Community Service  http://localhost:3005
```

Your frontend should normally call only:

```text
http://localhost:8080/api/...
```

For production-style execution without watch mode:

```bash
npm run start:all
```

## 5. Syntax check

```bash
npm run check
```

This runs Node's native JavaScript syntax checker over the project source/config scripts.

## 6. Health checks

```http
GET http://localhost:8080/health
GET http://localhost:8080/ready
```

## 7. Smoke test

After all services are running:

```bash
npm run smoke
```

## 8. Create an admin

Make sure `npm run setup:supabase` has already been run.

### Windows PowerShell

```powershell
$env:ADMIN_EMAIL="admin@example.com"
$env:ADMIN_PASSWORD="ChangeThisStrongPassword123!"
$env:ADMIN_NAME="Admin"
npm run admin:create -w @scale/user-service
```

### macOS/Linux

```bash
ADMIN_EMAIL="admin@example.com" \
ADMIN_PASSWORD="ChangeThisStrongPassword123!" \
ADMIN_NAME="Admin" \
npm run admin:create -w @scale/user-service
```

Public registration cannot create an `ADMIN` account.

# Auth API

## Register

```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "StrongPassword123!",
  "name": "Example User",
  "username": "example"
}
```

## Login

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "StrongPassword123!"
}
```

## Refresh token

```http
POST /api/auth/refresh
Content-Type: application/json

{
  "refreshToken": "..."
}
```

## Logout

```http
POST /api/auth/logout
Content-Type: application/json

{
  "refreshToken": "..."
}
```

## Current user

```http
GET /api/auth/me
Authorization: Bearer ACCESS_TOKEN
```

# Main endpoints

```text
Users
GET     /api/users
GET     /api/users/:id
PATCH   /api/users/:id
PATCH   /api/users/:id/role
PATCH   /api/users/:id/status
DELETE  /api/users/:id

Courses
GET     /api/courses
GET     /api/courses/:idOrSlug
POST    /api/courses
PATCH   /api/courses/:id
DELETE  /api/courses/:id

Jobs
GET     /api/jobs
GET     /api/jobs/:id
POST    /api/jobs
PATCH   /api/jobs/:id
DELETE  /api/jobs/:id

Contests
GET     /api/contests
GET     /api/contests/:idOrSlug
POST    /api/contests
PATCH   /api/contests/:id
DELETE  /api/contests/:id

Communities
GET     /api/communities
GET     /api/communities/:idOrSlug
POST    /api/communities
PATCH   /api/communities/:id
DELETE  /api/communities/:id
POST    /api/communities/:id/join
DELETE  /api/communities/:id/leave
GET     /api/communities/:id/members
```

# Prisma note for this JavaScript version

Prisma 7's newer `prisma-client` generator outputs TypeScript source. To keep this starter genuinely plain JavaScript, each service uses the still-supported `prisma-client-js` generator with a custom service-local output directory and the PostgreSQL driver adapter.

Generated files are ignored by Git and recreated by:

```bash
npm run prisma:generate
```

If you edit any `schema.prisma`, run:

```bash
npm run prisma:generate
npm run db:push
```

For production databases, prefer versioned Prisma migrations once your schema stabilizes rather than relying on `db push`.

# Optional Redis

If `REDIS_URL` is blank, the API Gateway uses an in-memory rate limiter. For multiple gateway instances, use shared Redis.

# Optional RabbitMQ

If `RABBITMQ_URL` is blank, REST APIs still work and event publishing is skipped.

Example events include:

```text
user.registered
user.logged_in
course.created
job.created
contest.created
community.created
community.member_joined
```

# Useful commands

```bash
npm install
npm run setup:supabase
npm run dev
npm run start:all
npm run check
npm run smoke
npm run prisma:generate
npm run db:push
```
