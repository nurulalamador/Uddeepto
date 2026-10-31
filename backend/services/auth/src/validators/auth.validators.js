import { z } from "zod";
export const credentials = z.object({
  identifier: z.string().min(3),
  password: z.string().min(8).max(128)
});
export const registerBody = z.object({
  name: z.string().min(2).max(150),
  email: z.string().email(),
  username: z.string().regex(/^[A-Za-z0-9_.-]{3,40}$/),
  password: z.string().min(8).max(128),
  role: z.enum(["learner", "hirer"]).default("learner")
});
export const refreshBody = z.object({
  refreshToken: z.string()
});
export const logoutBody = z.object({
  refreshToken: z.string()
});
export const changePasswordBody = z.object({
  currentPassword: z.string(),
  newPassword: z.string().min(8).max(128)
});
