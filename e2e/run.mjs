// Starts the isolated stack, runs the Selenium tests against it, then shuts everything down.
//
//   npm test                 every test file
//   npm run test:learner     files named learner-*.test.mjs  (also: hirer, admin, public)
//   node run.mjs learner-jobs   any file whose name contains the text
//   node run.mjs --stack-only   boot the stack and leave it running (for writing tests by hand)
//
// Environment: E2E_SKIP_BUILD=1 reuses the last frontend build, E2E_HEADED=1 shows the browser,
// E2E_BROWSER=chrome|edge|firefox picks the browser (default chrome).
import { spawn } from "node:child_process";
import { readdirSync } from "node:fs";
import path from "node:path";
import { paths, urls } from "./lib/config.mjs";
import { startStack } from "./lib/stack.mjs";

const args = process.argv.slice(2);
const stackOnly = args.includes("--stack-only");
const filters = args.filter((arg) => !arg.startsWith("--"));

const testsDir = path.join(paths.e2e, "tests");
const files = readdirSync(testsDir)
  .filter((name) => name.endsWith(".test.mjs"))
  .filter((name) => !filters.length || filters.some((filter) => name.includes(filter)))
  .sort()
  .map((name) => path.join("tests", name));

if (!stackOnly && !files.length) {
  console.error(`No test files match: ${filters.join(", ") || "(none)"}`);
  process.exit(2);
}

const stack = await startStack({ build: process.env.E2E_SKIP_BUILD !== "1" });
console.log(`e2e: stack is up (web ${urls.web}, api ${urls.api})`);

let code = 0;
if (stackOnly) {
  console.log("e2e: --stack-only, press Ctrl+C to stop");
  await new Promise(() => {});
} else {
  code = await new Promise((resolve) => {
    // One file at a time: they share one browser-visible database.
    const child = spawn(process.execPath, ["--test", "--test-concurrency=1", "--test-timeout=180000", ...files], {
      cwd: paths.e2e,
      stdio: "inherit",
      env: { ...process.env, E2E_BASE_URL: urls.web, E2E_API_URL: urls.api },
    });
    child.on("exit", (status) => resolve(status ?? 1));
  });
}
await stack.stop();
process.exit(code);
