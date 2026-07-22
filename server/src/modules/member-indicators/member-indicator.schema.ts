import { z } from "zod";

export const indicatorStatuses = ["Active", "Needs Monitoring", "Inactive"] as const;

export const listMemberIndicatorsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().trim().min(1).max(190).optional(),
  statusLabel: z.enum(indicatorStatuses).optional(),
  sortBy: z.enum(["fullName", "totalScore", "computedAt"]).default("computedAt"),
  sortDirection: z.enum(["asc", "desc"]).default("desc"),
});

export const recalculateIndicatorsSchema = z.object({
  memberId: z.string().trim().min(1).max(30).optional(),
  basisPeriodStart: z.iso.date().nullable().optional(),
  basisPeriodEnd: z.iso.date().nullable().optional(),
});
