import { z } from "zod";
export const instructorFields = {
  name: z.string().trim().min(2).max(150),
  designation: z.string().trim().max(150).default(""),
  details: z.string().trim().max(10000).default(""),
  linkedin_url: z.string().trim().max(500).default(""),
  github_url: z.string().trim().max(500).default(""),
  website_url: z.string().trim().max(500).default(""),
  remove_image: z.enum(["true", "false"]).optional()
};
