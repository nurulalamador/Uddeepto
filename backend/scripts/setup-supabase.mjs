import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import pg from "pg";

const { Client } = pg;
const root = process.cwd();
const envPath = path.join(root, ".env");

if (!fs.existsSync(envPath)) {
  console.error("Missing .env. Copy .env.example to .env and paste your Supabase connection strings first.");
  process.exit(1);
}

function parseEnv(contents) {
  const output = {};
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index < 0) continue;
    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    output[key] = value;
  }
  return output;
}

const env = parseEnv(fs.readFileSync(envPath, "utf8"));
const databaseUrl = env.SUPABASE_DATABASE_URL || "";
const directUrl = env.SUPABASE_DIRECT_URL || "";
const jwtSecret = env.JWT_ACCESS_SECRET || "";

if (!databaseUrl.startsWith("postgres")) {
  console.error("SUPABASE_DATABASE_URL is missing or invalid.");
  process.exit(1);
}
if (!directUrl.startsWith("postgres")) {
  console.error("SUPABASE_DIRECT_URL is missing or invalid.");
  process.exit(1);
}
if (jwtSecret.length < 32 || jwtSecret.startsWith("replace-with")) {
  console.error("JWT_ACCESS_SECRET must be changed to a random value with at least 32 characters.");
  process.exit(1);
}

const services = [
  ["user-service", "users", 3001],
  ["course-service", "courses", 3002],
  ["job-service", "jobs", 3003],
  ["contest-service", "contests", 3004],
  ["community-service", "communities", 3005],
];

const client = new Client({ connectionString: directUrl });
try {
  await client.connect();
  for (const [, schema] of services) {
    await client.query(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
    console.log(`Schema ready: ${schema}`);
  }
} catch (error) {
  console.error("Could not connect to Supabase or create service schemas.");
  console.error(error instanceof Error ? error.message : error);
  console.error("Check SUPABASE_DIRECT_URL and database permissions in the root .env file.");
  process.exit(1);
} finally {
  await client.end().catch(() => undefined);
}

const common = [
  `DATABASE_URL=${databaseUrl}`,
  `DIRECT_URL=${directUrl}`,
  `JWT_ACCESS_SECRET=${jwtSecret}`,
  `JWT_ACCESS_TTL=${env.JWT_ACCESS_TTL || "15m"}`,
  `REFRESH_TOKEN_DAYS=${env.REFRESH_TOKEN_DAYS || "30"}`,
  `RABBITMQ_URL=${env.RABBITMQ_URL || ""}`,
];

for (const [service, , servicePort] of services) {
  const contents = [
    `PORT=${servicePort}`,
    ...common,
    "",
  ].join("\n");
  fs.writeFileSync(path.join(root, "apps", service, ".env"), contents);
}

const gatewayEnv = [
  "PORT=8080",
  `REDIS_URL=${env.REDIS_URL || ""}`,
  `CORS_ORIGINS=${env.CORS_ORIGINS || "http://localhost:3000,http://localhost:5173"}`,
  "USER_SERVICE_URL=http://localhost:3001",
  "COURSE_SERVICE_URL=http://localhost:3002",
  "JOB_SERVICE_URL=http://localhost:3003",
  "CONTEST_SERVICE_URL=http://localhost:3004",
  "COMMUNITY_SERVICE_URL=http://localhost:3005",
  "",
].join("\n");
fs.writeFileSync(path.join(root, "apps", "api-gateway", ".env"), gatewayEnv);

console.log("Supabase service .env files generated.");
console.log("Next: Prisma generation and db push will run automatically.");
