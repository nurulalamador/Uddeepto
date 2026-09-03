import { Router } from "express";
import { z } from "zod";
import { AppError, authenticate, getAuthUser, parsePositiveInt, publishEvent, requireRoles, } from "@scale/common";
import { prisma } from "./lib/prisma.js";
export const router = Router();
const fields = {
    title: z.string().trim().min(3).max(180),
    company: z.string().trim().min(2).max(180),
    location: z.string().max(180).nullable().optional(),
    type: z.enum(["FULL_TIME", "PART_TIME", "CONTRACT", "INTERNSHIP", "REMOTE"]),
    description: z.string().min(10),
    requirements: z.string().nullable().optional(),
    salaryMin: z.number().int().nonnegative().nullable().optional(),
    salaryMax: z.number().int().nonnegative().nullable().optional(),
    currency: z.string().min(3).max(10).optional(),
    applyUrl: z.url().nullable().optional(),
    deadline: z.coerce.date().nullable().optional(),
    status: z.enum(["DRAFT", "PUBLISHED", "CLOSED"]).optional(),
};
const createSchema = z.object(fields).refine((data) => data.salaryMin == null || data.salaryMax == null || data.salaryMin <= data.salaryMax, { message: "salaryMin cannot be greater than salaryMax" });
const updateSchema = z.object(fields).partial().refine((data) => data.salaryMin == null || data.salaryMax == null || data.salaryMin <= data.salaryMax, { message: "salaryMin cannot be greater than salaryMax" });
router.get("/", async (req, res) => {
    const page = parsePositiveInt(req.query.page, 1, 100000);
    const limit = parsePositiveInt(req.query.limit, 20, 100);
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
    const requestedType = typeof req.query.type === "string" ? req.query.type : undefined;
    const allowedTypes = new Set(["FULL_TIME", "PART_TIME", "CONTRACT", "INTERNSHIP", "REMOTE"]);
    const type = requestedType && allowedTypes.has(requestedType) ? requestedType : undefined;
    const where = {
        status: "PUBLISHED",
        ...(type ? { type } : {}),
        ...(search ? { OR: [
                { title: { contains: search, mode: "insensitive" } },
                { company: { contains: search, mode: "insensitive" } },
                { location: { contains: search, mode: "insensitive" } },
            ] } : {}),
    };
    const [items, total] = await Promise.all([
        prisma.job.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: "desc" } }),
        prisma.job.count({ where }),
    ]);
    res.json({ items, meta: { page, limit, total, pages: Math.ceil(total / limit) } });
});
router.get("/:id", async (req, res) => {
    const item = await prisma.job.findFirst({ where: { id: req.params.id, status: "PUBLISHED" } });
    if (!item)
        throw new AppError(404, "Job not found", "JOB_NOT_FOUND");
    res.json({ item });
});
router.post("/", authenticate, requireRoles("ADMIN", "MODERATOR"), async (req, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success)
        throw new AppError(400, "Invalid job data", "VALIDATION_ERROR", parsed.error.flatten());
    const auth = getAuthUser(req);
    const item = await prisma.job.create({ data: { ...parsed.data, postedById: auth.id } });
    void publishEvent("job.created", { jobId: item.id, postedById: auth.id });
    res.status(201).json({ item });
});
router.patch("/:id", authenticate, requireRoles("ADMIN", "MODERATOR"), async (req, res) => {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success)
        throw new AppError(400, "Invalid job data", "VALIDATION_ERROR", parsed.error.flatten());
    const item = await prisma.job.update({ where: { id: req.params.id }, data: parsed.data });
    void publishEvent("job.updated", { jobId: item.id });
    res.json({ item });
});
router.delete("/:id", authenticate, requireRoles("ADMIN", "MODERATOR"), async (req, res) => {
    await prisma.job.delete({ where: { id: req.params.id } });
    void publishEvent("job.deleted", { jobId: req.params.id });
    res.status(204).send();
});
