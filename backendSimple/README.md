# Uddeepto Backend Simple

`../backend`-এর একই API, কিন্তু **একটাই Node process**-এ। Microservice, gateway আর load balancer নেই। Render-এর মতো কম memory-র (৫১২ MB) hosting-এর জন্য বানানো।

- একই URL: `http://localhost:4000/api/v1/...`
- একই port: `4000` (Render-এ `PORT` নিজে থেকে নেয়)
- একই response, একই database, একই JWT: Frontend (`BACKEND_URL`) কিছুই বদলাতে হয় না। `backend` বা `backendSimple`, যেটা খুশি চালাও, একসাথে নয়।

## কোনটা কোথায়

```
Frontend → http://localhost:4000/api/v1/<area>/...
              │
              ▼  src/app.js  (helmet, CORS, rate limit, body parser — একবারই)
   ┌──────────┴───────────────────────────────────────────┐
   auth users courses communities showcase contests webinars jobs messages payments frontend
   └── src/modules/<name>.js ──►  src/common.js ──► PostgreSQL (একটা pool)
```

| URL | Module |
|---|---|
| `/api/v1/auth` | `modules/auth.js` |
| `/api/v1/users` | `modules/users.js` |
| `/api/v1/courses` | `modules/courses.js` |
| `/api/v1/communities`, `/api/v1/showcase` | `modules/community.js` |
| `/api/v1/contests` | `modules/contests.js` |
| `/api/v1/webinars` | `modules/webinars.js` |
| `/api/v1/jobs` | `modules/jobs.js` |
| `/api/v1/messages` | `modules/messages.js` |
| `/api/v1/payments` | `modules/payments.js` |
| `/api/v1/frontend` | `modules/frontend.js` |

`src/modules/*.js` হলো `../backend/services/*/src/server.js`-এর কোড। শুধু প্রথম import আর শেষের `listen(...)` লাইন বদলানো হয়েছে, ব্যবসায়িক logic একই। `src/common.js` হলো `../backend/packages/common`।

## চালানো

```bash
cd backendSimple
npm install
npm start        # অথবা: npm run dev
```

`.env`: `backendSimple/.env` থাকলে সেটা, না থাকলে `../backend/.env` ব্যবহার হয়। তাই লোকালি আলাদা কিছু বানাতে হয় না। নতুন করে বানালে `.env.example` কপি করো। Upload folder-ও লোকালি `../backend/uploads` ভাগ করে নেয় (আছে থাকলে), ফলে দুই backend-এই একই ফাইল দেখা যায়।

Database migration আগের মতোই `../backend/database/*.sql` (001 থেকে 012), আলাদা কিছু লাগে না। Notification-এর জন্য `012_notifications.sql` চালাতে হবে; কে কখন notification পায় তার তালিকা `../backend/README.md`-তে।

## Render-এ deploy

| Setting | মান |
|---|---|
| Root Directory | `backendSimple` |
| Build Command | `npm install` |
| Start Command | `npm start` |
| Health Check Path | `/health` |

Environment variables: `.env.example`-এর মতো। অন্তত `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `CORS_ORIGINS`, `GEMINI_API_KEY`।

Live updates (Socket.IO) একই port ও একই process-এ চলে, আলাদা কিছু লাগে না। Frontend-এর Next.js server-এ `SOCKET_URL=https://<এই-service-এর-url>` দিন (লোকালি লাগে না), আর `CORS_ORIGINS`-এ frontend-এর origin রাখুন। বিস্তারিত `../backend/README.md`-তে।

Memory কমাতে যা করা আছে:
- ১১টা process-এর বদলে ১টা (প্রতিটা Node process-এ কয়েক দশ MB বাড়তি লাগত)।
- Database pool একটাই (`DB_POOL_MAX`, Render-এ `5` রাখো)।
- `npm start` heap সীমা `384 MB` ধরে দেয়, যাতে ৫১২ MB-এর আগে GC বেশি জোরে চলে।
- কোর্স-material ও contest-এর বড় ফাইল (ভিডিও/ডকুমেন্ট) memory-তে জমা না হয়ে সরাসরি disk-এ লেখা হয়। শুধু ছোট ছবি (সর্বোচ্চ `MAX_UPLOAD_MB`) memory দিয়ে যায়।

সীমাবদ্ধতা: Render-এর free/starter disk **স্থায়ী নয়**। Redeploy-এ `uploads/` মুছে যায়। প্রোডাকশনে Render Disk লাগাও (`UPLOAD_DIR` তার path-এ) অথবা পরে object storage-এ নাও।

## পরীক্ষা

```bash
npm test
```

Database ছাড়াই routing, auth, validation, CORS, `showcase` rewrite আর 404 বার্তা যাচাই করে।
