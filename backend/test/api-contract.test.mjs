import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

// Inspection only: no live database, HTTP port or provider is contacted.
process.env.DATABASE_URL = "postgres://contract:contract@127.0.0.1:1/contract";
process.env.DATABASE_SSL = "false";
process.env.JWT_ACCESS_SECRET = "contract-access";
process.env.JWT_REFRESH_SECRET = "contract-refresh";
const before = JSON.parse(await readFile(new URL("./fixtures/api-contract.json", import.meta.url), "utf8"));
const signature = route => `${route.method} ${route.path}`;
const sorted = routes => [...routes].sort((a, b) => signature(a).localeCompare(signature(b)));

function collectRoutes(app) {
  const routes = [];
  function walk(stack) {
    for (const layer of stack) {
      if (layer.route) {
        for (const method of Object.keys(layer.route.methods)) routes.push({ method: method.toUpperCase(), path: layer.route.path, handlers: layer.route.stack.length });
      } else if (layer.handle?.stack) walk(layer.handle.stack);
    }
  }
  walk(app.stack || app.router.stack);
  return routes;
}

for (const [service, expected] of Object.entries(before)) {
  for (const deployment of ["microservice", "single-process"]) {
    test(`${deployment}: ${service} retains every method, path and route middleware`, async () => {
      const url = deployment === "microservice"
        ? new URL(`../services/${service}/src/app.js`, import.meta.url)
        : new URL(`../../backendSimple/src/modules/${service}.js`, import.meta.url);
      const module = await import(url);
      const app = deployment === "microservice" ? module.createServiceApp() : module.default;
      const actual = collectRoutes(app);
      assert.deepEqual(sorted(actual), sorted(expected));
      // Jobs/webinars have direct /me routes before their generic resource router.
      if (["jobs", "webinars"].includes(service)) assert.deepEqual(actual, expected);
      // Specific admin URLs must still precede /admin/:table wildcards.
      if (service === "frontend") {
        const admin = actual.filter(route => route.path.startsWith("/admin/"));
        assert.deepEqual(admin, expected.filter(route => route.path.startsWith("/admin/")));
      }
    });
  }
}

test.after(async () => {
  const micro = await import("../packages/common/src/index.js");
  const simple = await import("../../backendSimple/src/common.js");
  await Promise.all([micro.pool.end(), simple.pool.end()]);
});
