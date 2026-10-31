import { z } from "zod";
export const accountPassword = z.string().min(1).max(200);
