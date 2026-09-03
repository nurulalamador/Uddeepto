export class AppError extends Error {
    status;
    code;
    details;
    constructor(status, message, code = "APP_ERROR", details) {
        super(message);
        this.status = status;
        this.code = code;
        this.details = details;
        this.name = "AppError";
    }
}
export const notFound = (req, _res, next) => {
    next(new AppError(404, `Route not found: ${req.method} ${req.originalUrl}`, "NOT_FOUND"));
};
export const errorHandler = (err, _req, res, _next) => {
    if (err instanceof AppError) {
        if (process.env.NODE_ENV !== "production") {
            console.error("AppError", {
                status: err.status,
                code: err.code,
                message: err.message,
                details: err.details,
            });
        }

        res.status(err.status).json({
            error: {
                code: err.code,
                message: err.message,
                details: err.details,
            },
        });
        return;
    }
    const prismaCode = typeof err === "object" && err && "code" in err ? String(err.code) : "";
    if (prismaCode === "P2002") {
        res.status(409).json({ error: { code: "DUPLICATE", message: "A unique field already exists." } });
        return;
    }
    if (prismaCode === "P2025") {
        res.status(404).json({ error: { code: "NOT_FOUND", message: "Resource not found." } });
        return;
    }
    console.error(err);
    res.status(500).json({
        error: {
            code: "INTERNAL_ERROR",
            message: "Internal server error",
        },
    });
};
