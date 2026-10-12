import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
export const root = path.resolve(here, "..", "..");
export const paths = {
  e2e: path.resolve(here, ".."),
  migrations: path.join(root, "backend", "database"),
  backendSimple: path.join(root, "backendSimple"),
  frontend: path.join(root, "frontend"),
  artifacts: path.resolve(here, "..", "artifacts"),
};

// Odd, fixed ports so the suite never collides with the normal dev servers (3000 / 4000).
export const ports = { db: 54329, api: 4400, web: 3200 };
export const urls = {
  web: process.env.E2E_BASE_URL || `http://127.0.0.1:${ports.web}`,
  api: process.env.E2E_API_URL || `http://127.0.0.1:${ports.api}/api/v1`,
  db: `postgres://postgres:postgres@127.0.0.1:${ports.db}/postgres`,
};

// One password for every seeded account.
export const PASSWORD = "Passw0rd!123";

// Seeded accounts. See lib/seed.mjs for the rest of the baseline data.
export const accounts = {
  learner: { username: "learner1", email: "learner1@e2e.test", name: "Lena Learner" },
  learner2: { username: "learner2", email: "learner2@e2e.test", name: "Liam Learner" },
  newbie: { username: "newbie1", email: "newbie1@e2e.test", name: "Nora Newbie" },
  hirer: { username: "hirer1", email: "hirer1@e2e.test", name: "Hana Hirer" },
  hirer2: { username: "hirer2", email: "hirer2@e2e.test", name: "Hugo Hirer" },
  admin: { username: "admin1", email: "admin1@e2e.test", name: "Ada Admin" },
  banned: { username: "banned1", email: "banned1@e2e.test", name: "Bob Banned" },
};
