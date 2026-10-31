import { z } from "zod";
export const aiMessages = z.array(z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(8000)
})).min(1).max(40);
export const aiBody = z.object({
  messages: aiMessages
}).strict();
