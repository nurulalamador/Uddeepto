import { randomUUID } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { AppError, authenticate, getAuthUser, parsePositiveInt, publishEvent, requireRoles, slugify, isUuid, } from "@scale/common";
import { prisma } from "./lib/prisma.js";
export const router = Router();
const fields = {
    title: z.string().trim().min(3).max(180),
    slug: z.string().trim().min(3).max(200).optional(),
    shortDescription: z.string().max(500).nullable().optional(),
    description: z.string().min(10),
    instructorId: z.uuid().nullable().optional(),
    category: z.string().max(100).nullable().optional(),
    level: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]).optional(),
    price: z.number().min(0).optional(),
    currency: z.string().min(3).max(10).optional(),
    thumbnailUrl: z.url().nullable().optional(),
    durationMinutes: z.number().int().positive().nullable().optional(),
    published: z.boolean().optional(),
};
const createSchema = z.object(fields);
const updateSchema = z.object(fields).partial();
router.get("/", async (req, res) => {
    const page = parsePositiveInt(req.query.page, 1, 100000);
    const limit = parsePositiveInt(req.query.limit, 20, 100);
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
    const category = typeof req.query.category === "string" ? req.query.category.trim() : undefined;
    const where = {
        published: true,
        ...(category ? { category } : {}),
        ...(search ? {
            OR: [
                { title: { contains: search, mode: "insensitive" } },
                { description: { contains: search, mode: "insensitive" } },
            ],
        } : {}),
    };
    const [items, total] = await Promise.all([
        prisma.course.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: "desc" } }),
        prisma.course.count({ where }),
    ]);
    res.json({ items, meta: { page, limit, total, pages: Math.ceil(total / limit) } });
});
router.get("/:idOrSlug", async (req, res) => {
    const value = req.params.idOrSlug;
    const item = await prisma.course.findFirst({
        where: {
            published: true,
            ...(isUuid(value) ? { OR: [{ id: value }, { slug: value }] } : { slug: value }),
        },
    });
    if (!item)
        throw new AppError(404, "Course not found", "COURSE_NOT_FOUND");
    res.json({ item });
});
router.post("/", authenticate, requireRoles("ADMIN", "MODERATOR"), async (req, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success)
        throw new AppError(400, "Invalid course data", "VALIDATION_ERROR", parsed.error.flatten());
    const auth = getAuthUser(req);
    const slug = parsed.data.slug ? slugify(parsed.data.slug) : `${slugify(parsed.data.title)}-${randomUUID().slice(0, 8)}`;
    const item = await prisma.course.create({ data: { ...parsed.data, slug, createdById: auth.id } });
    void publishEvent("course.created", { courseId: item.id, createdById: auth.id });
    res.status(201).json({ item });
});
router.patch("/:id", authenticate, requireRoles("ADMIN", "MODERATOR"), async (req, res) => {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success)
        throw new AppError(400, "Invalid course data", "VALIDATION_ERROR", parsed.error.flatten());
    const data = { ...parsed.data };
    if (typeof data.slug === "string")
        data.slug = slugify(data.slug);
    const item = await prisma.course.update({ where: { id: req.params.id }, data });
    void publishEvent("course.updated", { courseId: item.id });
    res.json({ item });
});
router.delete("/:id", authenticate, requireRoles("ADMIN", "MODERATOR"), async (req, res) => {
    await prisma.course.delete({ where: { id: req.params.id } });
    void publishEvent("course.deleted", { courseId: req.params.id });
    res.status(204).send();
});
