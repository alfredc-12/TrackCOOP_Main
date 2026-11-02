import { z } from "zod";
import { roleSlugs } from "../auth/auth.types";
import { csvEnum, isoDateSchema, refineDateRange } from "../../utils/people-filters";

export const accountStatuses = ["Pending", "Active", "Suspended", "Inactive"] as const;

const booleanQuery = z.preprocess(
  (value) => value === true || value === "true" || value === "1" || value === 1,
  z.boolean(),
);

export const memberLinkFilters = ["linked", "unlinked"] as const;
export const lastLoginFilters = ["never", "recent", "inactive"] as const;
export const defaultLastLoginDays = 30;

/** Filters shared by the list, the export and the KPI summary so all three always agree. */
const userFilterShape = {
  search: z.string().trim().min(1).max(190).optional(),
  role: z.enum(roleSlugs).optional(),
  status: z.enum(accountStatuses).optional(),
  /** Several statuses at once, e.g. `Suspended|Inactive`; takes precedence over `status`. */
  statuses: csvEnum(accountStatuses).optional(),
  includeHidden: booleanQuery.default(false),
  createdFrom: isoDateSchema.optional(),
  createdTo: isoDateSchema.optional(),
  /** `unlinked` means a member-role account with no member profile; staff accounts are never "unlinked". */
  memberLink: z.enum(memberLinkFilters).optional(),
  lastLogin: z.enum(lastLoginFilters).optional(),
  lastLoginDays: z.coerce.number().int().min(1).max(3650).default(defaultLastLoginDays),
};

export const listUsersQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().positive().max(100).default(20),
    ...userFilterShape,
    sortBy: z
      .enum(["displayName", "email", "role", "accountStatus", "createdAt"])
      .default("createdAt"),
    sortDirection: z.enum(["asc", "desc"]).default("desc"),
  })
  .superRefine(refineDateRange("createdFrom", "createdTo"));

/** KPI summary: every list filter except paging and sorting. */
export const userSummaryQuerySchema = z
  .object(userFilterShape)
  .superRefine(refineDateRange("createdFrom", "createdTo"));

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
    .min(3)
    .max(128)
    .optional(),
  role: z.enum(roleSlugs),
  accountStatus: z.enum(accountStatuses).default("Active"),
  issueActivationLink: z.boolean().optional().default(false),
  memberId: z.string().uuid().optional(),
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
    .min(3)
    .max(128),
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

