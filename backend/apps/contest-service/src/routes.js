import { randomUUID } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { AppError, authenticate, getAuthUser, parsePositiveInt, publishEvent, requireRoles, slugify, isUuid, } from "@scale/common";
import { prisma } from "./lib/prisma.js";
export const router = Router();
const fields = {
    title: z.string().trim().min(3).max(180),
    slug: z.string().trim().min(3).max(200).optional(),
    description: z.string().min(10),
    organizer: z.string().max(180).nullable().optional(),
    prize: z.string().max(255).nullable().optional(),
    rules: z.string().nullable().optional(),
    bannerUrl: z.url().nullable().optional(),
    registrationStart: z.coerce.date().nullable().optional(),
    registrationEnd: z.coerce.date().nullable().optional(),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    status: z.enum(["DRAFT", "UPCOMING", "OPEN", "ENDED", "CANCELLED"]).optional(),
};
const createSchema = z.object(fields).refine((data) => data.startsAt < data.endsAt, {
    message: "startsAt must be before endsAt",
});
const updateSchema = z.object(fields).partial();
router.get("/", async (req, res) => {
    const page = parsePositiveInt(req.query.page, 1, 100000);
    const limit = parsePositiveInt(req.query.limit, 20, 100);
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
    const where = {
        status: { in: ["UPCOMING", "OPEN", "ENDED"] },
        ...(search ? { OR: [
                { title: { contains: search, mode: "insensitive" } },
                { description: { contains: search, mode: "insensitive" } },
                { organizer: { contains: search, mode: "insensitive" } },
            ] } : {}),
    };
    const [items, total] = await Promise.all([
        prisma.contest.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { startsAt: "desc" } }),
        prisma.contest.count({ where }),
    ]);
    res.json({ items, meta: { page, limit, total, pages: Math.ceil(total / limit) } });
});
router.get("/:idOrSlug", async (req, res) => {
    const value = req.params.idOrSlug;
    const item = await prisma.contest.findFirst({
        where: {
            status: { in: ["UPCOMING", "OPEN", "ENDED"] },
            ...(isUuid(value) ? { OR: [{ id: value }, { slug: value }] } : { slug: value }),
        },
    });
    if (!item)
        throw new AppError(404, "Contest not found", "CONTEST_NOT_FOUND");
    res.json({ item });
});
router.post("/", authenticate, requireRoles("ADMIN", "MODERATOR"), async (req, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success)
        throw new AppError(400, "Invalid contest data", "VALIDATION_ERROR", parsed.error.flatten());
    const auth = getAuthUser(req);
    const slug = parsed.data.slug ? slugify(parsed.data.slug) : `${slugify(parsed.data.title)}-${randomUUID().slice(0, 8)}`;
    const item = await prisma.contest.create({ data: { ...parsed.data, slug, createdById: auth.id } });
    void publishEvent("contest.created", { contestId: item.id });
    res.status(201).json({ item });
});
router.patch("/:id", authenticate, requireRoles("ADMIN", "MODERATOR"), async (req, res) => {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success)
        throw new AppError(400, "Invalid contest data", "VALIDATION_ERROR", parsed.error.flatten());
    const data = { ...parsed.data };
    if (typeof data.slug === "string")
        data.slug = slugify(data.slug);
    const item = await prisma.contest.update({ where: { id: req.params.id }, data });
    void publishEvent("contest.updated", { contestId: item.id });
    res.json({ item });
});
router.delete("/:id", authenticate, requireRoles("ADMIN", "MODERATOR"), async (req, res) => {
    await prisma.contest.delete({ where: { id: req.params.id } });
    void publishEvent("contest.deleted", { contestId: req.params.id });
    res.status(204).send();
});
