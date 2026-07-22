import { z } from "zod";

export const shareCapitalStatuses = ["Pending", "Validated", "Rejected", "Reversed"] as const;

export const listShareCapitalQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().trim().min(1).max(190).optional(),
  memberId: z.string().trim().min(1).max(30).optional(),
  paymentStatus: z.enum(shareCapitalStatuses).optional(),
  sortBy: z.enum(["paymentDate", "amount", "createdAt"]).default("paymentDate"),
  sortDirection: z.enum(["asc", "desc"]).default("desc"),
});

export const shareCapitalSchema = z.object({
  memberId: z.string().trim().min(1).max(30),
  paymentReferenceId: z.string().trim().min(1).max(30).nullable().optional(),
  amount: z.coerce.number().positive().max(15_000),
  paymentDate: z.iso.date(),
  paymentStatus: z.enum(shareCapitalStatuses).default("Pending"),
  remarks: z.string().trim().max(2000).nullable().optional(),
});

export const updateShareCapitalSchema = shareCapitalSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  { message: "At least one share capital field is required" },
);
