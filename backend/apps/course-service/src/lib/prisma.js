import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/client/index.js";
import { requireEnv } from "@scale/common";
const adapter = new PrismaPg({ connectionString: requireEnv("DATABASE_URL") });
export const prisma = new PrismaClient({ adapter });
