import "dotenv/config";
import compression from "compression";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { closeBroker, errorHandler, notFound, requestContext } from "@scale/common";
import { prisma } from "./lib/prisma.js";
import { authRouter } from "./routes/auth.js";
import { usersRouter } from "./routes/users.js";
const app = express();
const port = Number(process.env.PORT ?? 3001);
app.disable("x-powered-by");
app.use(requestContext);
app.use(helmet());
app.use(compression());
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.get("/health", async (_req, res) => {
    await prisma.$queryRawUnsafe("SELECT 1");
    res.json({ service: "user-service", status: "ok", timestamp: new Date().toISOString() });
});
app.use("/auth", authRouter);
app.use("/users", usersRouter);
app.use(notFound);
app.use(errorHandler);
const server = app.listen(port, () => console.log(`user-service listening on ${port}`));
async function shutdown(signal) {
    console.log(`${signal}: shutting down user-service`);
    server.close(async () => {
        await prisma.$disconnect().catch(() => undefined);
        await closeBroker();
        process.exit(0);
    });
}
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
