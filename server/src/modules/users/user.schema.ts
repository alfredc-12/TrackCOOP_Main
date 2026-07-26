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

export const listLinkableMembersQuerySchema = z.object({
  search: z.string().trim().min(1).max(190).optional(),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
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
    .regex(/[0-9]/, "Password must include a number")
    .optional(),
  role: z.enum(roleSlugs),
  accountStatus: z.enum(accountStatuses).default("Active"),
  issueActivationLink: z.boolean().optional().default(false),
}).superRefine((value, context) => {
  if (!value.issueActivationLink && !value.password) {
    context.addIssue({
      code: "custom",
      path: ["password"],
      message: "Password is required unless an activation link is issued",
    });
  }
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
  reason: z.string().trim().min(3).max(500),
  selfConfirmation: z.string().trim().max(160).optional(),
});

export const updateUserRoleSchema = z.object({
  role: z.enum(roleSlugs),
  reason: z.string().trim().min(3).max(500),
});

export const issueActivationLinkSchema = z.object({
  reason: z.string().trim().min(3).max(500),
});

export const revokeSessionSchema = z.object({
  reason: z.string().trim().min(3).max(500),
});

export const linkMemberSchema = z.object({
  memberId: z.string().trim().min(1),
  reason: z.string().trim().min(3).max(500),
});

export const unlinkMemberSchema = z.object({
  reason: z.string().trim().min(3).max(500),
});

export const resetUserPasswordSchema = z.object({
  password: z
    .string()
    .min(12)
    .max(128)
    .regex(/[a-z]/, "Password must include a lowercase letter")
    .regex(/[A-Z]/, "Password must include an uppercase letter")
    .regex(/[0-9]/, "Password must include a number"),
  reason: z.string().trim().min(3).max(500),
});

export const deleteUserSchema = z.object({
  reason: z.string().trim().min(3).max(500),
  selfConfirmation: z.string().trim().max(160).optional(),
});

export const bulkUserActionSchema = z.object({
  userIds: z.array(z.string().min(1)).min(1).max(100),
  action: z.enum(["Suspend", "Activate", "Delete"]),
  reason: z.string().trim().min(3).max(500),
});

