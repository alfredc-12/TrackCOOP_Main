import { z } from "zod";

export const loginSchema = z.object({
  identifier: z
    .string()
    .trim()
    .min(3, "Enter your email or username")
    .max(190, "Email or username is too long"),
  password: z
    .string()
    .min(8, "Password must contain at least 8 characters")
    .max(128, "Password is too long"),
});

export type LoginFormValues = z.infer<typeof loginSchema>;
