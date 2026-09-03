import { randomUUID } from "node:crypto";
import { AppError } from "./errors.js";
export const requestContext = (req, res, next) => {
    const incoming = req.headers["x-request-id"];
    const requestId = typeof incoming === "string" && incoming.length <= 200 ? incoming : randomUUID();
    req.headers["x-request-id"] = requestId;
    res.setHeader("x-request-id", requestId);
    next();
};
export function parsePositiveInt(value, fallback, max = 100) {
    const number = Number(value);
    if (!Number.isInteger(number) || number <= 0)
        return fallback;
    return Math.min(number, max);
}
export function slugify(value) {
    const slug = value
        .toLowerCase()
        .trim()
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9\u0980-\u09ff]+/g, "-")
        .replace(/^-+|-+$/g, "");
    if (!slug)
        throw new AppError(400, "Could not generate a valid slug", "INVALID_SLUG");
    return slug;
}
export function isUuid(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
export function requireEnv(name) {
    const value = process.env[name];
    if (!value)
        throw new Error(`Missing required environment variable: ${name}`);
    return value;
}
