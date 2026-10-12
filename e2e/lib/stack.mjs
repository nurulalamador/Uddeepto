import { spawn, spawnSync } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { paths, ports, urls } from "./config.mjs";
import { startDatabase } from "./database.mjs";
import { seed } from "./seed.mjs";

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitFor(url, label, timeout = 120000, child) {
  const started = Date.now();
  let last = "";
  while (Date.now() - started < timeout) {
    if (child && child.exitCode !== null) throw new Error(`${label} exited early (code ${child.exitCode}); see e2e/artifacts/`);
    try {
      const response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(4000) });
      if (response.status < 500) return;
      last = `HTTP ${response.status}`;
    } catch (error) {
      last = error.message;
    }
    await wait(500);
  }
  throw new Error(`${label} did not become ready at ${url} (${last})`);
}

function kill(child) {
  if (!child || child.exitCode !== null) return;
  // On Windows a plain kill leaves the process tree running.
  if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
  else child.kill("SIGTERM");
}

/**
 * Boots everything the browser needs, all isolated from the real data:
 *   in-memory PostgreSQL (PGlite)  ->  backendSimple (the real API)  ->  Next.js (production build)
 */
export async function startStack({ build = true } = {}) {
  mkdirSync(paths.artifacts, { recursive: true });
  const database = await startDatabase();
  const ids = await seed(database.db);
  writeFileSync(path.join(paths.artifacts, "seed.json"), JSON.stringify(ids, null, 2));

  const children = [];
  const logOf = (name) => createWriteStream(path.join(paths.artifacts, `${name}.log`));
  const run = (name, command, args, options) => {
    const log = logOf(name);
    const child = spawn(command, args, { ...options, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    child.stdout.pipe(log);
    child.stderr.pipe(log);
    children.push(child);
    return child;
  };

  const uploads = mkdtempSync(path.join(tmpdir(), "uddeepto-e2e-uploads-"));
  // Everything is passed explicitly so nothing can leak in from a real .env (dotenv never overrides these).
  const apiEnv = {
    ...process.env,
    NODE_ENV: "development",
    PORT: String(ports.api),
    DATABASE_URL: urls.db,
    DATABASE_SSL: "false",
    // PGlite is one database session: with a single pooled connection requests simply take turns,
    // which avoids the multi-connection multiplexer entirely (and nothing in the API nests pool queries inside a transaction).
    DB_POOL_MAX: "1",
    JWT_ACCESS_SECRET: "e2e-access-secret",
    JWT_REFRESH_SECRET: "e2e-refresh-secret",
    ACCESS_TOKEN_TTL: "15m",
    REFRESH_TOKEN_TTL: "30d",
    CORS_ORIGINS: urls.web,
    UPLOAD_DIR: uploads,
    RATE_LIMIT_PER_MINUTE: "1000000",
    MAX_UPLOAD_MB: "10",
    GEMINI_API_KEY: "",
    GEMINI_MODEL: "",
    AI_REQUESTS_PER_MINUTE: "100",
  };
  const api = run("backend", process.execPath, ["src/server.js"], { cwd: paths.backendSimple, env: apiEnv });
  await waitFor(`http://127.0.0.1:${ports.api}/health`, "backendSimple", 60000, api);

  const next = path.join(paths.frontend, "node_modules", "next", "dist", "bin", "next");
  const webEnv = {
    ...process.env,
    BACKEND_URL: urls.api,
    NEXT_DIST_DIR: ".next-e2e",
    NEXT_TELEMETRY_DISABLED: "1",
  };
  delete webEnv.APP_ORIGIN;
  if (build || !existsSync(path.join(paths.frontend, ".next-e2e", "BUILD_ID"))) {
    console.log("e2e: building the frontend (set E2E_SKIP_BUILD=1 to reuse the last build)...");
    const built = spawnSync(process.execPath, [next, "build", "--webpack"], { cwd: paths.frontend, env: webEnv, encoding: "utf8" });
    writeFileSync(path.join(paths.artifacts, "web-build.log"), `${built.stdout}\n${built.stderr}`);
    if (built.status !== 0) throw new Error("next build failed; see e2e/artifacts/web-build.log");
  }
  const web = run("web", process.execPath, [next, "start", "-p", String(ports.web)], { cwd: paths.frontend, env: webEnv });
  await waitFor(`${urls.web}/login`, "Next.js", 60000, web);

  return {
    ids,
    db: database.db,
    async stop() {
      for (const child of children) kill(child);
      await wait(500);
      await database.stop().catch(() => {});
    },
  };
}
