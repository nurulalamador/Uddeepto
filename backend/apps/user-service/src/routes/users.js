import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { AppError, authenticate, getAuthUser, parsePositiveInt, publishEvent, requireRoles, } from "@scale/common";
import { prisma } from "../lib/prisma.js";
export const usersRouter = Router();
function publicUser(user) {
    const { passwordHash, ...safe } = user;
    return safe;
}
function assertSelfOrStaff(requester, targetId) {
    if (requester.id !== targetId && !["ADMIN", "MODERATOR"].includes(requester.role)) {
        throw new AppError(403, "You can only access your own profile", "FORBIDDEN");
    }
}
usersRouter.get("/", authenticate, requireRoles("ADMIN", "MODERATOR"), async (req, res) => {
    const page = parsePositiveInt(req.query.page, 1, 100000);
    const limit = parsePositiveInt(req.query.limit, 20, 100);
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
    const where = search ? {
        OR: [
            { name: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
            { username: { contains: search, mode: "insensitive" } },
        ],
    } : {};
    const [items, total] = await Promise.all([
        prisma.user.findMany({
            where,
            skip: (page - 1) * limit,
            take: limit,
            orderBy: { createdAt: "desc" },
        }),
        prisma.user.count({ where }),
    ]);
    res.json({ items: items.map(publicUser), meta: { page, limit, total, pages: Math.ceil(total / limit) } });
});
usersRouter.get("/:id", authenticate, async (req, res) => {
    const requester = getAuthUser(req);
    assertSelfOrStaff(requester, req.params.id);
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user)
        throw new AppError(404, "User not found", "USER_NOT_FOUND");
    res.json({ user: publicUser(user) });
});
usersRouter.patch("/:id", authenticate, async (req, res) => {
    const requester = getAuthUser(req);
    if (requester.id !== req.params.id && requester.role !== "ADMIN") {
        throw new AppError(403, "Only the account owner or an admin can edit this profile", "FORBIDDEN");
    }
    const schema = z.object({
        name: z.string().trim().min(2).max(120).optional(),
        username: z.string().trim().min(3).max(60).regex(/^[a-zA-Z0-9_.-]+$/).nullable().optional(),
        avatarUrl: z.url().nullable().optional(),
        bio: z.string().max(2000).nullable().optional(),
        phone: z.string().max(30).nullable().optional(),
        password: z.string().min(8).max(128).optional(),
    }).refine((data) => Object.keys(data).length > 0, "At least one field is required");
    const parsed = schema.safeParse(req.body);
    if (!parsed.success)
        throw new AppError(400, "Invalid profile data", "VALIDATION_ERROR", parsed.error.flatten());
    const { password, ...data } = parsed.data;
    const updateData = { ...data };
    if (password)
        updateData.passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.update({ where: { id: req.params.id }, data: updateData });
    void publishEvent("user.updated", { userId: user.id });
    res.json({ user: publicUser(user) });
});
usersRouter.patch("/:id/role", authenticate, requireRoles("ADMIN"), async (req, res) => {
    const parsed = z.object({ role: z.enum(["USER", "MODERATOR", "ADMIN"]) }).safeParse(req.body);
    if (!parsed.success)
        throw new AppError(400, "Invalid role", "VALIDATION_ERROR");
    const user = await prisma.user.update({ where: { id: req.params.id }, data: { role: parsed.data.role } });
    void publishEvent("user.role_changed", { userId: user.id, role: user.role });
    res.json({ user: publicUser(user) });
});
usersRouter.patch("/:id/status", authenticate, requireRoles("ADMIN"), async (req, res) => {
    const parsed = z.object({ status: z.enum(["ACTIVE", "SUSPENDED", "DELETED"]) }).safeParse(req.body);
    if (!parsed.success)
        throw new AppError(400, "Invalid status", "VALIDATION_ERROR");
    const user = await prisma.user.update({ where: { id: req.params.id }, data: { status: parsed.data.status } });
    if (user.status !== "ACTIVE")
        await prisma.refreshToken.deleteMany({ where: { userId: user.id } });
    void publishEvent("user.status_changed", { userId: user.id, status: user.status });
    res.json({ user: publicUser(user) });
});
usersRouter.delete("/:id", authenticate, async (req, res) => {
    const requester = getAuthUser(req);
    if (requester.id !== req.params.id && requester.role !== "ADMIN") {
        throw new AppError(403, "Only the account owner or an admin can delete this account", "FORBIDDEN");
    }
    await prisma.user.delete({ where: { id: req.params.id } });
    void publishEvent("user.deleted", { userId: req.params.id });
    res.status(204).send();
});
