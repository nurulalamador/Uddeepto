import { randomUUID } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { AppError, authenticate, getAuthUser, parsePositiveInt, publishEvent, slugify, isUuid, } from "@scale/common";
import { prisma } from "./lib/prisma.js";
export const router = Router();
const communityFields = {
    name: z.string().trim().min(3).max(150),
    slug: z.string().trim().min(3).max(180).optional(),
    description: z.string().max(5000).nullable().optional(),
    visibility: z.enum(["PUBLIC", "PRIVATE"]).optional(),
    avatarUrl: z.url().nullable().optional(),
    coverUrl: z.url().nullable().optional(),
};
const createSchema = z.object(communityFields);
const updateSchema = z.object(communityFields).partial();
async function canManage(communityId, userId, role) {
    if (role === "ADMIN")
        return true;
    const member = await prisma.communityMember.findUnique({
        where: { communityId_userId: { communityId, userId } },
    });
    return member?.role === "OWNER" || member?.role === "MODERATOR";
}
router.get("/", async (req, res) => {
    const page = parsePositiveInt(req.query.page, 1, 100000);
    const limit = parsePositiveInt(req.query.limit, 20, 100);
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
    const where = {
        visibility: "PUBLIC",
        ...(search ? { OR: [
                { name: { contains: search, mode: "insensitive" } },
                { description: { contains: search, mode: "insensitive" } },
            ] } : {}),
    };
    const [items, total] = await Promise.all([
        prisma.community.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: "desc" } }),
        prisma.community.count({ where }),
    ]);
    res.json({ items, meta: { page, limit, total, pages: Math.ceil(total / limit) } });
});
router.get("/:idOrSlug", async (req, res) => {
    const value = req.params.idOrSlug;
    const item = await prisma.community.findFirst({
        where: {
            visibility: "PUBLIC",
            ...(isUuid(value) ? { OR: [{ id: value }, { slug: value }] } : { slug: value }),
        },
    });
    if (!item)
        throw new AppError(404, "Community not found", "COMMUNITY_NOT_FOUND");
    res.json({ item });
});
router.post("/", authenticate, async (req, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success)
        throw new AppError(400, "Invalid community data", "VALIDATION_ERROR", parsed.error.flatten());
    const auth = getAuthUser(req);
    const slug = parsed.data.slug ? slugify(parsed.data.slug) : `${slugify(parsed.data.name)}-${randomUUID().slice(0, 8)}`;
    const item = await prisma.$transaction(async (tx) => {
        const community = await tx.community.create({ data: { ...parsed.data, slug, ownerId: auth.id } });
        await tx.communityMember.create({
            data: { communityId: community.id, userId: auth.id, role: "OWNER" },
        });
        return community;
    });
    void publishEvent("community.created", { communityId: item.id, ownerId: auth.id });
    res.status(201).json({ item });
});
router.patch("/:id", authenticate, async (req, res) => {
    const auth = getAuthUser(req);
    if (!(await canManage(req.params.id, auth.id, auth.role))) {
        throw new AppError(403, "You cannot manage this community", "FORBIDDEN");
    }
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success)
        throw new AppError(400, "Invalid community data", "VALIDATION_ERROR", parsed.error.flatten());
    const data = { ...parsed.data };
    if (typeof data.slug === "string")
        data.slug = slugify(data.slug);
    const item = await prisma.community.update({ where: { id: req.params.id }, data });
    void publishEvent("community.updated", { communityId: item.id });
    res.json({ item });
});
router.delete("/:id", authenticate, async (req, res) => {
    const auth = getAuthUser(req);
    const community = await prisma.community.findUnique({ where: { id: req.params.id } });
    if (!community)
        throw new AppError(404, "Community not found", "COMMUNITY_NOT_FOUND");
    if (community.ownerId !== auth.id && auth.role !== "ADMIN") {
        throw new AppError(403, "Only the owner or an admin can delete this community", "FORBIDDEN");
    }
    await prisma.community.delete({ where: { id: req.params.id } });
    void publishEvent("community.deleted", { communityId: req.params.id });
    res.status(204).send();
});
router.post("/:id/join", authenticate, async (req, res) => {
    const auth = getAuthUser(req);
    const community = await prisma.community.findUnique({ where: { id: req.params.id } });
    if (!community)
        throw new AppError(404, "Community not found", "COMMUNITY_NOT_FOUND");
    if (community.visibility === "PRIVATE") {
        throw new AppError(403, "Private communities require an invitation workflow", "PRIVATE_COMMUNITY");
    }
    const member = await prisma.$transaction(async (tx) => {
        const existing = await tx.communityMember.findUnique({
            where: { communityId_userId: { communityId: community.id, userId: auth.id } },
        });
        if (existing)
            return existing;
        const created = await tx.communityMember.create({
            data: { communityId: community.id, userId: auth.id },
        });
        await tx.community.update({
            where: { id: community.id },
            data: { memberCount: { increment: 1 } },
        });
        return created;
    });
    void publishEvent("community.member_joined", { communityId: community.id, userId: auth.id });
    res.status(201).json({ member });
});
router.delete("/:id/leave", authenticate, async (req, res) => {
    const auth = getAuthUser(req);
    const member = await prisma.communityMember.findUnique({
        where: { communityId_userId: { communityId: req.params.id, userId: auth.id } },
    });
    if (!member)
        throw new AppError(404, "Membership not found", "MEMBERSHIP_NOT_FOUND");
    if (member.role === "OWNER")
        throw new AppError(400, "Owner cannot leave without transferring ownership", "OWNER_CANNOT_LEAVE");
    await prisma.$transaction([
        prisma.communityMember.delete({ where: { id: member.id } }),
        prisma.community.update({
            where: { id: req.params.id },
            data: { memberCount: { decrement: 1 } },
        }),
    ]);
    void publishEvent("community.member_left", { communityId: req.params.id, userId: auth.id });
    res.status(204).send();
});
router.get("/:id/members", authenticate, async (req, res) => {
    const auth = getAuthUser(req);
    const community = await prisma.community.findUnique({ where: { id: req.params.id } });
    if (!community)
        throw new AppError(404, "Community not found", "COMMUNITY_NOT_FOUND");
    if (community.visibility === "PRIVATE") {
        const member = await prisma.communityMember.findUnique({
            where: { communityId_userId: { communityId: req.params.id, userId: auth.id } },
        });
        if (!member && auth.role !== "ADMIN")
            throw new AppError(403, "Membership required", "FORBIDDEN");
    }
    const members = await prisma.communityMember.findMany({
        where: { communityId: req.params.id },
        orderBy: { joinedAt: "asc" },
    });
    res.json({ items: members });
});
