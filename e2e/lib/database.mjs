import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { paths, ports } from "./config.mjs";

/**
 * An isolated, in-memory PostgreSQL (PGlite) that the real backend connects to over TCP.
 * Nothing here ever touches the real Supabase database.
 */
export async function startDatabase() {
  const db = new PGlite();
  const files = (await readdir(paths.migrations))
    .filter((name) => /^\d{3}_.*\.sql$/.test(name))
    .sort();
  for (const file of files) {
    let sql = await readFile(path.join(paths.migrations, file), "utf8");
    // PGlite has no pgcrypto/citext extensions; CITEXT behaves as TEXT here.
    sql = sql.replace(/CREATE EXTENSION IF NOT EXISTS (pgcrypto|citext);/g, "").replace(/\bCITEXT\b/g, "TEXT");
    await db.exec(sql);
  }
  const server = new PGLiteSocketServer({ db, port: ports.db, host: "127.0.0.1", maxConnections: 20 });
  await server.start();
  return {
    db,
    migrations: files,
    async stop() {
      await server.stop();
      await db.close();
    },
  };
}
