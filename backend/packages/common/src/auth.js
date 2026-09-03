import jwt from "jsonwebtoken";
import { AppError } from "./errors.js";
function accessSecret() {
    const value = process.env.JWT_ACCESS_SECRET;
    if (!value || value.length < 32) {
        throw new Error("JWT_ACCESS_SECRET must be at least 32 characters.");
    }
    return value;
}
export function getAuthUser(req) {
    return req.auth;
}
export function authenticate(req, _res, next) {
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
    if (!token) {
        next(new AppError(401, "Authentication required", "AUTH_REQUIRED"));
        return;
    }
    try {
        const payload = jwt.verify(token, accessSecret());
        if (!payload.sub || typeof payload.role !== "string") {
            throw new Error("Malformed token");
        }
        req.auth = {
            id: String(payload.sub),
            email: typeof payload.email === "string" ? payload.email : undefined,
            role: payload.role,
        };
        next();
    }
    catch {
        next(new AppError(401, "Invalid or expired access token", "INVALID_TOKEN"));
    }
}
export function requireRoles(...roles) {
    return (req, _res, next) => {
        const user = getAuthUser(req);
        if (!user) {
            next(new AppError(401, "Authentication required", "AUTH_REQUIRED"));
            return;
        }
        if (!roles.includes(user.role)) {
            next(new AppError(403, "You do not have permission for this action", "FORBIDDEN"));
            return;
        }
        next();
    };
}
