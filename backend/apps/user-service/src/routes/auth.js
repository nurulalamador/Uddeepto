import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { AppError, authenticate, getAuthUser, publishEvent } from "@scale/common";
import { prisma } from "../lib/prisma.js";
import { hashRefreshToken, issueRefreshToken, issueTokens, createAccessToken } from "../auth-tokens.js";
export const authRouter = Router();
const registerSchema = z.object({
    name: z.string().trim().min(2).max(120),
    email: z.email().transform((value) => value.toLowerCase()),
    username: z.string().trim().min(3).max(60).regex(/^[a-zA-Z0-9_.-]+$/).optional(),
    password: z.string().min(8).max(128),
});
const loginSchema = z.object({
    email: z.email().transform((value) => value.toLowerCase()),
    password: z.string().min(1).max(128),
});
function publicUser(user) {
    const { passwordHash, ...safe } = user;
    return safe;
}
authRouter.post("/register", async (req, res) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success)
        throw new AppError(400, "Invalid registration data", "VALIDATION_ERROR", parsed.error.flatten());
    const { name, email, username, password } = parsed.data;
    const conflict = await prisma.user.findFirst({
        where: { OR: [{ email }, ...(username ? [{ username }] : [])] },
        select: { id: true },
    });
    if (conflict)
        throw new AppError(409, "Email or username already exists", "USER_EXISTS");
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
        data: { name, email, username, passwordHash },
    });
    const tokens = await issueTokens(user);
    void publishEvent("user.registered", { userId: user.id, email: user.email });
    res.status(201).json({ user: publicUser(user), tokens });
});
authRouter.post("/login", async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success)
        throw new AppError(400, "Invalid login data", "VALIDATION_ERROR", parsed.error.flatten());
    const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (!user || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
        throw new AppError(401, "Invalid email or password", "INVALID_CREDENTIALS");
    }
    if (user.status !== "ACTIVE")
        throw new AppError(403, "Account is not active", "ACCOUNT_DISABLED");
    const updated = await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
    });
    const tokens = await issueTokens(updated);
    void publishEvent("user.logged_in", { userId: updated.id });
    res.json({ user: publicUser(updated), tokens });
});
authRouter.post("/refresh", async (req, res) => {
    const schema = z.object({ refreshToken: z.string().min(20) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success)
        throw new AppError(400, "refreshToken is required", "VALIDATION_ERROR");
    const tokenHash = hashRefreshToken(parsed.data.refreshToken);
    const stored = await prisma.refreshToken.findUnique({
        where: { tokenHash },
        include: { user: true },
    });
    if (!stored || stored.expiresAt <= new Date() || stored.user.status !== "ACTIVE") {
        if (stored)
            await prisma.refreshToken.delete({ where: { id: stored.id } }).catch(() => undefined);
        throw new AppError(401, "Invalid or expired refresh token", "INVALID_REFRESH_TOKEN");
    }
    await prisma.refreshToken.delete({ where: { id: stored.id } });
    const refreshToken = await issueRefreshToken(stored.user.id);
    const accessToken = createAccessToken(stored.user);
    res.json({ tokens: { accessToken, refreshToken, tokenType: "Bearer" } });
});
authRouter.post("/logout", async (req, res) => {
    const schema = z.object({ refreshToken: z.string().min(20) });
    const parsed = schema.safeParse(req.body);
    if (parsed.success) {
        await prisma.refreshToken.deleteMany({ where: { tokenHash: hashRefreshToken(parsed.data.refreshToken) } });
    }
    res.status(204).send();
});
authRouter.get("/me", authenticate, async (req, res) => {
    const auth = getAuthUser(req);
    const user = await prisma.user.findUnique({ where: { id: auth.id } });
    if (!user)
        throw new AppError(404, "User not found", "USER_NOT_FOUND");
    res.json({ user: publicUser(user) });
});
