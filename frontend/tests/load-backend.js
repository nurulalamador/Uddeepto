import { createSourceImporter } from "../../backend/test/support/import-source.mjs";

/** The same in-memory adapters as before, applied to all extracted modules. */
export async function loadBackendService(service, transform) {
  const harness = new URL("./harness.js", import.meta.url).href;
  const load = createSourceImporter({
    replacements: {
      "@uddeepto/common": harness,
      [new URL("../../backendSimple/src/common.js", import.meta.url).href]: harness,
      bcryptjs: "data:text/javascript," + encodeURIComponent("export default {hash:async value=>'test-only:'+value,compare:async()=>true}"),
    },
    transform,
  });
  if (process.env.BACKEND_TEST_VARIANT === "simple") {
    const module = await load(new URL(`../../backendSimple/src/modules/${service}.js`, import.meta.url));
    const { listen, attachRealtime } = await import(harness);
    const server = listen(module.default);
    if (service === "frontend") attachRealtime(server, module.realtimeOptions);
    return;
  }
  return load(new URL(`../../backend/services/${service}/src/server.js`, import.meta.url));
}
