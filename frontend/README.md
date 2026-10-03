# Uddeepto Frontend

Next.js App Router frontend written in plain JavaScript and plain CSS. No TypeScript, Tailwind, ORM, or Supabase client is used.

## Included

- Public landing, about, login and signup pages
- HttpOnly-cookie session bridge to the Uddeepto backend
- Automatic access-token refresh
- Responsive light/dark interface and mobile sidebar
- Learner dashboard, Showcase, courses, contests, webinars, communities, jobs, direct messages and profiles
- Hirer dashboard, Showcase, job posting and candidate management
- Admin management for users, interests, content, contests, webinars, communities, jobs, reports, course lessons and contest judging
- Loading, error and empty states
- Integration tests using an isolated PostgreSQL-compatible database

## 1. Start the updated backend

Use the supplied `uddeepto-backend-updated.zip`. Its `.env` needs the same values as before, plus these optional values:

```env
FRONTEND_API_PORT=4010
FRONTEND_API_URL=http://localhost:4010
CORS_ORIGINS=http://localhost:3000
```

Then run:

```bash
npm install
npm run dev
```

The database schema does not need a new migration for this frontend API.

If you prefer to update your own earlier backend folder instead, this frontend package also contains `backend-patch`. Run:

```bash
node backend-patch/install.mjs C:\path\to\uddeepto-backend
```

The installer keeps `.before-frontend` copies of files it changes.

## 2. Configure and start the frontend

Copy `.env.example` to `.env.local`:

```env
BACKEND_URL=http://localhost:4000/api/v1
APP_ORIGIN=http://localhost:3000
```

Then run:

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Test and production build

```bash
npm test
npm run build
npm start
```

For production, set `BACKEND_URL` to the public HTTPS gateway URL and `APP_ORIGIN` to the exact frontend HTTPS origin.

Live updates (Socket.IO): the browser opens a WebSocket straight to the backend. By default the address is `BACKEND_URL` without `/api/v1`; set `SOCKET_URL` (server-side) if the browser must use a different public address. The backend's `CORS_ORIGINS` must include the frontend origin. If the socket cannot connect, the app keeps working with its normal polling. Do not expose JWT secrets or the Supabase database URL in the frontend environment.

## Important production note

Free courses and contests can be joined immediately. Paid enrollment intentionally returns a payment-required message until a verified bKash, SSLCommerz, or Stripe webhook is connected to the backend. Community and direct-message screens refresh on demand; a later WebSocket/Redis service can provide real-time delivery without changing the current database model.
