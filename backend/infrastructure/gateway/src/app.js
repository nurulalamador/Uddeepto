import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { gatewayConfig } from "./config.js";
import { registerProxyRoutes } from "./routes/proxy.routes.js";

export function createGatewayApp(config = gatewayConfig) {
  const app = express();
  app.set("trust proxy", 1);
  app.use(helmet());
  app.use(cors({
    origin: (origin, done) => !origin || config.origins.includes(origin)
      ? done(null, true)
      : done(new Error("Origin not allowed")),
    credentials: true,
  }));
  app.use(rateLimit({ windowMs: 60000, limit: 180 }));
  app.use((_req, res, next) => {
    res.setHeader("X-Gateway-Instance", config.instance);
    next();
  });
  app.get("/health", (_req, res) => res.json({
    service: "gateway", instance: config.instance, status: "ok",
  }));
  const live = registerProxyRoutes(app, config);
  app.use((_req, res) => res.status(404).json({ error: "Route not found" }));
  return { app, upgrade: live.upgrade };
}
