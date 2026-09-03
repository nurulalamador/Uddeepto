import "dotenv/config";
import compression from "compression";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { closeBroker, errorHandler, notFound, requestContext } from "@scale/common";
import { prisma } from "./lib/prisma.js";
import { router } from "./routes.js";
const app = express();
const port = Number(process.env.PORT ?? 3004);
app.disable("x-powered-by");
app.use(requestContext);
app.use(helmet(), compression(), cors(), express.json({ limit: "1mb" }));
app.get("/health", async (_req, res) => {
    await prisma.$queryRawUnsafe("SELECT 1");
    res.json({ service: "contest-service", status: "ok" });
});
app.use("/contests", router);
app.use(notFound);
app.use(errorHandler);
const server = app.listen(port, () => console.log(`contest-service listening on ${port}`));
for (const signal of ["SIGTERM", "SIGINT"]) {
    process.on(signal, () => server.close(async () => {
        await prisma.$disconnect().catch(() => undefined);
        await closeBroker();
        process.exit(0);
    }));
}
