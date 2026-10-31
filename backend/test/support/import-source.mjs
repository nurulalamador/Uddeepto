import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

/**
 * Loads a service module graph with explicit test adapters. Production modules
 * keep their normal imports; only the test graph receives the replacements.
 */
export function createSourceImporter({ replacements = {}, transform = text => text } = {}) {
  const cache = new Map();

  async function moduleUrl(url) {
    if (cache.has(url.href)) return cache.get(url.href);
    const pending = (async () => {
      const resolve = createRequire(url).resolve;
      let source = transform(await readFile(url, "utf8"), url);
      const imports = [...source.matchAll(/^\s*(?:import\s+(?:[^;]*?\s+from\s*)?|export\s+(?:\*|\{[^}]*\})\s+from\s*)(["'])([^"']+)\1/gm)];
      for (const match of imports.reverse()) {
        const specifier = match[2];
        let target = replacements[specifier];
        if (!target && specifier.startsWith(".")) {
          const dependency = new URL(specifier, url);
          target = replacements[dependency.href] || await moduleUrl(dependency);
        }
        if (!target) {
          target = specifier.startsWith("node:") || specifier.startsWith("file:")
            ? specifier
            : pathToFileURL(resolve(specifier)).href;
        }
        const offset = match.index + match[0].lastIndexOf(match[1] + specifier + match[1]);
        source = source.slice(0, offset) + JSON.stringify(target) + source.slice(offset + specifier.length + 2);
      }
      source = source.replace(/import\.meta\.url/g, JSON.stringify(url.href));
      return "data:text/javascript;base64," + Buffer.from(source + `\n//# sourceURL=${fileURLToPath(url).replaceAll("\\", "/")}\n`).toString("base64");
    })();
    cache.set(url.href, pending);
    return pending;
  }

  return async url => import(await moduleUrl(url));
}
