import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
dotenv.config({
  path: fileURLToPath(new URL("../../../.env", import.meta.url)),
});
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { createProxyMiddleware } from "http-proxy-middleware";
const app = express();
app.set("trust proxy", 1);
app.use(helmet());
const origins = (process.env.CORS_ORIGINS || "http://localhost:5173").split(
  ",",
);
app.use(
  cors({
    origin: (o, cb) =>
      !o || origins.includes(o)
        ? cb(null, true)
        : cb(new Error("Origin not allowed")),
    credentials: true,
  }),
);
app.use(rateLimit({ windowMs: 60000, limit: 180 }));
app.get("/health", (_q, s) => s.json({ service: "gateway", status: "ok" }));
const routes = {
  auth: ["AUTH_URL", 4001],
  users: ["USERS_URL", 4002],
  courses: ["COURSES_URL", 4003],
  communities: ["COMMUNITY_URL", 4004],
  showcase: ["COMMUNITY_URL", 4004],
  contests: ["CONTESTS_URL", 4005],
  webinars: ["WEBINARS_URL", 4006],
  jobs: ["JOBS_URL", 4007],
  messages: ["MESSAGES_URL", 4008],
  payments: ["PAYMENTS_URL", 4009],
};
for (const [path, [key, port]] of Object.entries(routes))
  app.use(
    `/api/v1/${path}`,
    createProxyMiddleware({
      target: process.env[key] || `http://localhost:${port}`,
      changeOrigin: true,
      pathRewrite: (url) => (path === "showcase" ? "/showcase" + url : url),
    }),
  );
app.use(
  "/api/v1/frontend",
  createProxyMiddleware({
    target: process.env.FRONTEND_API_URL || "http://localhost:4010",
    changeOrigin: true,
  }),
);
app.use((_q, s) => s.status(404).json({ error: "Route not found" }));
app.listen(process.env.GATEWAY_PORT || 4000, () =>
  console.log("gateway listening"),
);
