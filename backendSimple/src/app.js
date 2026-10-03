import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { errors } from "./common.js";
import auth from "./modules/auth.js";
import users from "./modules/users.js";
import courses from "./modules/courses.js";
import community from "./modules/community.js";
import contests from "./modules/contests.js";
import webinars from "./modules/webinars.js";
import jobs from "./modules/jobs.js";
import messages from "./modules/messages.js";
import payments from "./modules/payments.js";
import frontend from "./modules/frontend.js";

// One process serves everything the gateway and the ten services used to serve,
// under the same /api/v1/... URLs, so the frontend cannot tell the difference.
const routes = {
  auth,
  users,
  courses,
  communities: community,
  // Legacy showcase endpoints live inside the community module under /showcase.
  showcase: (req, res, next) => {
    req.url = "/showcase" + req.url;
    community(req, res, next);
  },
  contests,
  webinars,
  jobs,
  messages,
  payments,
  frontend,
};

export function createServerApp() {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(helmet());
  const origins = (process.env.CORS_ORIGINS || "http://localhost:5173").split(",");
  app.use(
    cors({
      origin: (origin, done) =>
        !origin || origins.includes(origin)
          ? done(null, true)
          : done(new Error("Origin not allowed")),
      credentials: true,
    }),
  );
  app.use(
    rateLimit({
      windowMs: 60000,
      limit: Number(process.env.RATE_LIMIT_PER_MINUTE) || 180,
    }),
  );
  app.get("/health", (_q, s) => s.json({ service: "backend-simple", status: "ok" }));
  // Parsed once here (the services each parsed their own bodies before). Multipart uploads are untouched.
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: false }));
  for (const [path, router] of Object.entries(routes))
    app.use(`/api/v1/${path}`, router);
  app.use((req, res) => {
    const area = req.path.split("/")[3];
    if (!req.path.startsWith("/api/v1/") || !(area in routes))
      return res.status(404).json({ error: "Route not found" });
    // Inside a known area the message names the route as that service saw it (without the /api/v1/<area> prefix).
    const rest = req.originalUrl.slice(`/api/v1/${area}`.length) || "/";
    const seen = (area === "showcase" ? "/showcase" : "") + rest;
    res.status(404).json({ error: `Route not found: ${req.method} ${seen}` });
  });
  app.use(errors);
  return app;
}
