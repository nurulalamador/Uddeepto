import "dotenv/config";
import compression from "compression";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { createProxyMiddleware } from "http-proxy-middleware";
import { closeRedis, getRedisClient, requestContext } from "@scale/common";
const app = express();
const port = Number(process.env.PORT ?? 8080);
const services = {
    user: process.env.USER_SERVICE_URL ?? "http://localhost:3001",
    course: process.env.COURSE_SERVICE_URL ?? "http://localhost:3002",
    job: process.env.JOB_SERVICE_URL ?? "http://localhost:3003",
    contest: process.env.CONTEST_SERVICE_URL ?? "http://localhost:3004",
    community: process.env.COMMUNITY_SERVICE_URL ?? "http://localhost:3005",
};
const allowedOrigins = (process.env.CORS_ORIGINS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(requestContext);
app.use(helmet());
app.use(compression());
app.use(cors({
    origin(origin, callback) {
        if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
            callback(null, true);
            return;
        }
        callback(new Error("Origin is not allowed by CORS"));
    },
    credentials: true,
}));
const fallbackBuckets = new Map();
function rateLimit(windowMs, max) {
    return async (req, res, next) => {
        const now = Date.now();
        const ip = req.ip || req.socket.remoteAddress || "unknown";
        const bucket = Math.floor(now / windowMs);
        const key = `rl:${ip}:${bucket}:${req.baseUrl || "global"}`;
        try {
            const redis = await getRedisClient();
            if (redis) {
                const count = await redis.incr(key);
                if (count === 1)
                    await redis.pExpire(key, windowMs);
                res.setHeader("RateLimit-Limit", max);
                res.setHeader("RateLimit-Remaining", Math.max(0, max - count));
                if (count > max) {
                    res.status(429).json({ error: { code: "RATE_LIMITED", message: "Too many requests" } });
                    return;
                }
                next();
                return;
            }
        }
        catch (error) {
            console.error("Distributed rate limit failed; falling back to memory.", error);
        }
        if (fallbackBuckets.size > 10_000) {
            for (const [bucketKey, value] of fallbackBuckets) {
                if (value.resetAt <= now)
                    fallbackBuckets.delete(bucketKey);
            }
        }
        const current = fallbackBuckets.get(key);
        if (!current || current.resetAt <= now) {
            fallbackBuckets.set(key, { count: 1, resetAt: now + windowMs });
            next();
            return;
        }
        current.count += 1;
        if (current.count > max) {
            res.status(429).json({ error: { code: "RATE_LIMITED", message: "Too many requests" } });
            return;
        }
        next();
    };
}
app.get("/health", (_req, res) => {
    res.json({
        service: "api-gateway",
        status: "ok",
        timestamp: new Date().toISOString(),
        services,
    });
});
app.get("/ready", async (_req, res) => {
    const checks = await Promise.all(Object.entries(services).map(async ([name, url]) => {
        try {
            const response = await fetch(`${url}/health`, { signal: AbortSignal.timeout(3_000) });
            return { name, ok: response.ok, status: response.status };
        }
        catch {
            return { name, ok: false, status: 0 };
        }
    }));
    const ok = checks.every((check) => check.ok);
    res.status(ok ? 200 : 503).json({ service: "api-gateway", ready: ok, checks });
});
app.use(rateLimit(60_000, 300));
app.use("/api/auth", rateLimit(15 * 60_000, 30));
function proxy(target) {
    return createProxyMiddleware({
        target,
        changeOrigin: true,
        proxyTimeout: 15_000,
        timeout: 15_000,
    });
}
app.use("/api/auth", proxy(`${services.user}/auth`));
app.use("/api/users", proxy(`${services.user}/users`));
app.use("/api/courses", proxy(`${services.course}/courses`));
app.use("/api/jobs", proxy(`${services.job}/jobs`));
app.use("/api/contests", proxy(`${services.contest}/contests`));
app.use("/api/communities", proxy(`${services.community}/communities`));
app.use((req, res) => {
    res.status(404).json({
        error: { code: "NOT_FOUND", message: `Route not found: ${req.method} ${req.originalUrl}` },
    });
});
app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(502).json({ error: { code: "GATEWAY_ERROR", message: "Gateway request failed" } });
});
const server = app.listen(port, () => {
    console.log(`API Gateway listening on http://localhost:${port}`);
});
for (const signal of ["SIGTERM", "SIGINT"]) {
    process.on(signal, () => server.close(async () => {
        await closeRedis().catch(() => undefined);
        process.exit(0);
    }));
}
