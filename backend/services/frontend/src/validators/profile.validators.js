import { z } from "zod";
export const monthDate = z.string().regex(/^\d{4}-\d{2}(-\d{2})?$/, "Enter a valid date");
export const optionalText = max => z.string().trim().max(max).optional().transform(v => v ? v : null);
export const educationBody = z.object({
  institution: z.string().trim().min(1).max(200),
  degree: optionalText(200),
  field_of_study: optionalText(200),
  start_date: monthDate,
  end_date: z.string().optional(),
  grade: optionalText(100),
  description: optionalText(2000)
}).strict();
export const experienceBody = z.object({
  title: z.string().trim().min(1).max(200),
  workplace: z.string().trim().min(1).max(200),
  // null = "Others" (fits none of the interest categories)
  category_id: z.string().uuid().nullable(),
  location: optionalText(200),
  start_date: monthDate,
  end_date: z.string().optional(),
  description: optionalText(2000)
}).strict();
