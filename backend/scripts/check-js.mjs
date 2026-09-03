import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const files = [];
const ignored = new Set(["node_modules", "generated", ".git"]);

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.isFile() && (full.endsWith(".js") || full.endsWith(".mjs"))) files.push(full);
  }
}

walk(root);
let failed = 0;
for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", file], { stdio: "inherit" });
  if (result.status !== 0) failed += 1;
}

if (failed) {
  console.error(`Syntax check failed for ${failed} file(s).`);
  process.exit(1);
}
console.log(`JavaScript syntax check passed: ${files.length} files.`);
