import { materialTypes } from "../config/materials.config.js";
import { z } from "zod";
export const materialBody = z.object({
  name: z.string().trim().min(1).max(250),
  description: z.string().trim().max(2000).optional(),
  type: z.enum(materialTypes).optional(),
  content_text: z.string().optional(),
  is_preview: z.union([z.boolean(), z.enum(["true", "false"])]).optional()
});
export const quizSchema = z.object({
  checkpoints: z.array(z.object({
    checkpoint: z.coerce.number().int().min(1).max(3),
    questions: z.array(z.object({
      question: z.string().trim().min(3).max(500),
      options: z.array(z.string().trim().min(1).max(300)).length(4),
      correct_index: z.coerce.number().int().min(0).max(3),
      explanation: z.string().trim().max(500).optional().nullable()
    })).min(1)
  })).min(3)
});
