# Next.js frontend starter

This package is intended to be copied into an existing Next.js **App Router** project.
It uses plain JavaScript and Tailwind CSS.

## What to replace

1. Delete your current starter `app` folder (the default Next.js intro files).
2. Copy these folders/files into the root of your existing Next.js project:
   - `app/`
   - `components/`
   - `lib/`
   - `proxy.js`
   - `postcss.config.mjs`
   - `.env.local.example`
3. Copy `.env.local.example` to `.env.local` and update `BACKEND_API_URL` if needed.

## Tailwind

This starter targets current Tailwind CSS v4. If your Next.js project does not already include Tailwind, run:

```bash
npm install tailwindcss @tailwindcss/postcss postcss
```

The included `postcss.config.mjs` and `app/globals.css` are already configured for Tailwind v4.

## Start

Start your Express microservices backend first, then run:

```bash
npm run dev
```

Frontend default URL: `http://localhost:3000`
Backend gateway default URL: `http://localhost:8080`

## Public routes

- `/`
- `/about`
- `/login`
- `/signup`

## Protected routes

- `/dashboard`
- `/courses`
- `/contests`
- `/communities`
- `/jobs`

## Authentication flow

The browser submits login/signup to Next.js route handlers. Those handlers call your existing Express API Gateway:

- `POST /api/auth/login`
- `POST /api/auth/register`
- `GET /api/auth/me`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`

Access and refresh tokens are kept in HttpOnly cookies by the Next.js server, not in `localStorage`.
The frontend automatically attempts refresh-token rotation when the access token expires.

## Backend data access

Protected UI pages call `/api/backend/...` inside Next.js. That route safely forwards authenticated requests to your Express gateway and only allows these roots:

- users
- courses
- jobs
- contests
- communities

## Next.js version note

This starter uses `proxy.js`, which is the current Next.js convention for request-time route protection. If your project is on Next.js 15 or older, rename `proxy.js` to `middleware.js` and rename the exported `proxy` function to `middleware`, or update Next.js.
