import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
async function walk(d) {
  for (const e of await readdir(d, { withFileTypes: true })) {
    const p = join(d, e.name);
    if (e.isDirectory() && e.name !== "node_modules") await walk(p);
    else if (e.name.endsWith(".js") || e.name.endsWith(".mjs"))
      execFileSync(process.execPath, ["--check", p], { stdio: "inherit" });
  }
}
await walk(fileURLToPath(new URL("..", import.meta.url)));
console.log("Syntax check passed");
