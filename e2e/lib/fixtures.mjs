// Small files for upload tests, written to e2e/artifacts/fixtures on first use.
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { paths } from "./config.mjs";

const dir = path.join(paths.artifacts, "fixtures");
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
const PDF = Buffer.from("%PDF-1.1\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n");

export function fixture(name) {
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, name);
  if (!existsSync(file)) {
    const content = name.endsWith(".png") ? PNG : name.endsWith(".pdf") ? PDF : Buffer.from(`E2E fixture file ${name}\n`);
    writeFileSync(file, content);
  }
  return file;
}
