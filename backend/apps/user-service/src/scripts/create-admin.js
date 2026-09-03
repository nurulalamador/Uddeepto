import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma.js";
const email = process.env.ADMIN_EMAIL?.toLowerCase();
const password = process.env.ADMIN_PASSWORD;
const name = process.env.ADMIN_NAME ?? "Administrator";
if (!email || !password || password.length < 8) {
    throw new Error("Set ADMIN_EMAIL and ADMIN_PASSWORD (minimum 8 characters).");
}
const passwordHash = await bcrypt.hash(password, 12);
const user = await prisma.user.upsert({
    where: { email },
    update: { role: "ADMIN", status: "ACTIVE", passwordHash, name },
    create: { email, name, passwordHash, role: "ADMIN" },
});
console.log(`Admin ready: ${user.email} (${user.id})`);
await prisma.$disconnect();
