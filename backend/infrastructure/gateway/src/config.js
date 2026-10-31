import dotenv from "dotenv";
import { fileURLToPath } from "node:url";

dotenv.config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });

const argument = name => process.argv.find(value => value.startsWith(`--${name}=`))?.split("=")[1];
const port = argument("port") || process.env.GATEWAY_PORT || 4000;
const targets = {
  auth: ["AUTH_URL", 4001],
  users: ["USERS_URL", 4002],
  courses: ["COURSES_URL", 4003],
  communities: ["COMMUNITY_URL", 4004],
  showcase: ["COMMUNITY_URL", 4004],
  contests: ["CONTESTS_URL", 4005],
  webinars: ["WEBINARS_URL", 4006],
  jobs: ["JOBS_URL", 4007],
  messages: ["MESSAGES_URL", 4008],
  payments: ["PAYMENTS_URL", 4009],
};

export const gatewayConfig = {
  port,
  instance: argument("id") || process.env.GATEWAY_ID || `gateway-${port}`,
  origins: (process.env.CORS_ORIGINS || "http://localhost:5173").split(","),
  services: Object.fromEntries(Object.entries(targets).map(([area, [key, servicePort]]) => [
    area, process.env[key] || `http://localhost:${servicePort}`,
  ])),
  frontendApiUrl: process.env.FRONTEND_API_URL || "http://localhost:4010",
};
