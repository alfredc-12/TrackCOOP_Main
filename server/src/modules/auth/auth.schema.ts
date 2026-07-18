import { z } from "zod";

export const loginSchema = z.object({
  identifier: z.string().trim().min(3).max(190),
  password: z.string().min(8).max(128),
});

export const sessionIdSchema = z.object({
  id: z.string().regex(/^\d+$/),
});
