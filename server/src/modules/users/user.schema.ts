import { z } from "zod";
import { roleSlugs } from "../auth/auth.types";

export const accountStatuses = ["Pending", "Active", "Suspended", "Inactive"] as const;

export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().trim().min(1).max(190).optional(),
  role: z.enum(roleSlugs).optional(),
  status: z.enum(accountStatuses).optional(),
  sortBy: z
    .enum(["displayName", "email", "role", "accountStatus", "createdAt"])
    .default("createdAt"),
  sortDirection: z.enum(["asc", "desc"]).default("desc"),
});

export const createUserSchema = z.object({
  email: z.email().max(190),
  username: z
    .string()
    .trim()
    .min(3)
    .max(80)
    .regex(/^[a-zA-Z0-9._-]+$/)
    .nullable()
    .optional(),
  displayName: z.string().trim().min(2).max(160),
  password: z
    .string()
    .min(12)
    .max(128)
    .regex(/[a-z]/, "Password must include a lowercase letter")
    .regex(/[A-Z]/, "Password must include an uppercase letter")
    .regex(/[0-9]/, "Password must include a number"),
  role: z.enum(roleSlugs),
  accountStatus: z.enum(accountStatuses).default("Active"),
});

export const updateUserSchema = z
  .object({
    email: z.email().max(190).optional(),
    username: z
      .string()
      .trim()
      .min(3)
      .max(80)
      .regex(/^[a-zA-Z0-9._-]+$/)
      .nullable()
      .optional(),
    displayName: z.string().trim().min(2).max(160).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one profile field is required",
  });

export const updateUserStatusSchema = z.object({
  accountStatus: z.enum(accountStatuses),
});

export const updateUserRoleSchema = z.object({
  role: z.enum(roleSlugs),
});
