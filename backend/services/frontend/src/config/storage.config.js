import path from "node:path";
import { fileURLToPath } from "node:url";
export const UPLOAD_ROOT = path.resolve(process.env.UPLOAD_DIR || fileURLToPath(new URL("../../../../uploads", import.meta.url)));
export const MB = 1024 * 1024;
