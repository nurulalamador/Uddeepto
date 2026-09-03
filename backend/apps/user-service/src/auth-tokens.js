import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { prisma } from "./lib/prisma.js";
import { requireEnv } from "@scale/common";
export function createAccessToken(user) {
    const expiresIn = (process.env.JWT_ACCESS_TTL ?? "15m");
    return jwt.sign({ email: user.email, role: user.role }, requireEnv("JWT_ACCESS_SECRET"), { subject: user.id, expiresIn });
}
export function hashRefreshToken(token) {
    return crypto.createHash("sha256").update(token).digest("hex");
}
export async function issueRefreshToken(userId) {
    const token = crypto.randomBytes(48).toString("base64url");
    const days = Math.max(1, Number(process.env.REFRESH_TOKEN_DAYS ?? 30));
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    await prisma.refreshToken.create({
        data: { tokenHash: hashRefreshToken(token), userId, expiresAt },
    });
    return token;
}
export async function issueTokens(user) {
    await prisma.refreshToken.deleteMany({
        where: { userId: user.id, expiresAt: { lt: new Date() } },
    });
    return {
        accessToken: createAccessToken(user),
        refreshToken: await issueRefreshToken(user.id),
        tokenType: "Bearer",
    };
}
