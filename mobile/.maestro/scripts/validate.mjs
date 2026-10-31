// Static authoring check only. Never imports the fixture server, uses ADB or invokes Maestro.
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import ts from "typescript";
const require = createRequire(import.meta.url);
const yaml = require("js-yaml");
const root = fileURLToPath(new URL("../", import.meta.url));
const app = JSON.parse(readFileSync(new URL("../../app.json", import.meta.url), "utf8"));
const catalog = JSON.parse(readFileSync(path.join(root, "cases.json"), "utf8"));
const commands = new Set(["launchApp", "stopApp", "back", "hideKeyboard", "eraseText", "inputText", "tapOn", "assertVisible", "assertNotVisible", "extendedWaitUntil", "scrollUntilVisible", "runFlow", "runScript", "addMedia", "openLink", "repeat", "swipe"]);
const files = [];
const problems = [];
const ids = new Set();
const names = new Set();
function collect(folder) {
  for (const entry of readdirSync(folder, { withFileTypes: true })) {
    const full = path.join(folder, entry.name);
    if (entry.isDirectory()) collect(full);
    else if (entry.name.endsWith(".yaml")) files.push(full);
  }
}
collect(path.join(root, "flows"));
collect(path.join(root, "helpers"));
function reference(file, value) {
  if (typeof value !== "string" || !existsSync(path.resolve(path.dirname(file), value))) problems.push(`${file}: missing referenced file ${value}`);
}
function inspect(list, file) {
  if (!Array.isArray(list) || !list.length) { problems.push(`${file}: empty commands`); return; }
  for (const step of list) {
    const key = typeof step === "string" ? step : Object.keys(step || {})[0];
    if (!commands.has(key)) problems.push(`${file}: unknown command ${key}`);
    if (typeof step === "string") continue;
    if (Object.keys(step).length !== 1) problems.push(`${file}: command must have one key`);
    if (key === "runFlow" || key === "runScript") {
      const value = step[key];
      if (typeof value === "string") reference(file, value);
      else if (value.file) reference(file, value.file);
      if (value.commands) inspect(value.commands, file);
    }
    if (key === "addMedia") for (const asset of step[key]) reference(file, asset);
    if (key === "repeat") inspect(step[key].commands, file);
    if (["tapOn", "assertVisible", "assertNotVisible"].includes(key) && typeof step[key] === "object") {
      const selector = step[key];
      for (const field of ["text", "id"]) {
        if (selector[field] && !selector[field].includes("${")) {
          try { new RegExp(selector[field]); } catch { problems.push(`${file}: invalid ${field} regex`); }
        }
      }
    }
  }
}
for (const file of files) {
  const docs = yaml.loadAll(readFileSync(file, "utf8"));
  if (docs.length !== 2) { problems.push(`${file}: expected a header and commands`); continue; }
  const [header, steps] = docs;
  if (header.appId !== app.expo.android.package) problems.push(`${file}: wrong Android package`);
  if (!header.name || names.has(header.name)) problems.push(`${file}: missing or duplicate name`);
  names.add(header.name);
  inspect(steps, file);
  for (const hook of ["onFlowStart", "onFlowComplete"]) if (header[hook]) inspect(header[hook], file);
}
for (const entry of catalog) {
  if (ids.has(entry.id)) problems.push(`Duplicate case ID: ${entry.id}`);
  ids.add(entry.id);
  if (!existsSync(path.join(root, entry.file))) problems.push(`Missing case ${entry.file}`);
  else {
    const [header] = yaml.loadAll(readFileSync(path.join(root, entry.file), "utf8"));
    if (!header.name.startsWith(`${entry.id} `)) problems.push(`${entry.file}: header does not match catalog ID`);
    if (!header.tags?.includes(entry.group)) problems.push(`${entry.file}: missing group tag`);
  }
  if (entry.status !== "Authored, not executed") problems.push(`${entry.id}: catalog must not imply an execution result`);
}
const entryFiles = files.filter(file => file.includes(`${path.sep}flows${path.sep}`));
if (entryFiles.length !== catalog.length) problems.push("Scenario count does not match cases.json");
if (new Set(catalog.map(entry => entry.file)).size !== catalog.length) problems.push("Duplicate catalog path");

// Make sure every external flow variable has a fixture definition or a helper parameter.
const fixtureText = readFileSync(path.join(root, "scripts/serve-fixtures.mjs"), "utf8");
const fixtureAst = ts.createSourceFile("fixtures.mjs", fixtureText, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const defined = new Set(["USERNAME", "LOGIN_PASSWORD", "FILE_NAME", "output"]);
function properties(node) {
  if (ts.isPropertyAssignment(node) && node.name) defined.add(node.name.getText(fixtureAst).replace(/^['"]|['"]$/g, ""));
  ts.forEachChild(node, properties);
}
properties(fixtureAst);
for (const match of fixtureText.matchAll(/env\.([A-Z_]+)\s*=/g)) defined.add(match[1]);
const actorList = fixtureText.match(/for \(const key of (\[[^\]]+\])/);
if (actorList) for (const key of JSON.parse(actorList[1])) { defined.add(`${key}_USERNAME`); defined.add(`${key}_ID`); }
for (const file of files) {
  for (const match of readFileSync(file, "utf8").matchAll(/\$\{([A-Z][A-Z0-9_]*)(?:\}|[.])/g)) {
    if (!defined.has(match[1])) problems.push(`${file}: undefined variable ${match[1]}`);
  }
}
if (problems.length) { console.error(problems.join("\n")); process.exitCode = 1; }
else {
  const groups = {};
  for (const entry of catalog) groups[entry.group] = (groups[entry.group] || 0) + 1;
  console.log(JSON.stringify({ scenarios: catalog.length, helpers: files.length - catalog.length, groups, status: "Static YAML, reference and variable checks only. No tests executed." }, null, 2));
}
