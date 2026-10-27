import { z } from "zod";

const budgetLineSchema = z.object({
  financialCategoryId: z.string().trim().min(1),
  seasonId: z.string().trim().min(1).nullable().optional(),
  limitAmount: z.coerce.number().min(0).max(999_999_999.99),
  warningPercentage: z.coerce.number().gt(0).max(100).default(80),
  hardLimit: z.coerce.boolean().default(true),
});

export const budgetSchema = z.object({
  budgetName: z.string().trim().min(2).max(160),
  coverageStart: z.iso.date(),
  coverageEnd: z.iso.date(),
  notes: z.string().trim().max(2000).nullable().optional(),
  lines: z.array(budgetLineSchema).min(1).max(100),
}).refine((value) => value.coverageEnd >= value.coverageStart, {
  message: "Budget coverage end must be on or after the start date.",
  path: ["coverageEnd"],
}).refine((value) => new Set(value.lines.map((line) => `${line.financialCategoryId}:${line.seasonId ?? ""}`)).size === value.lines.length, {
  message: "Budget category and season lines must be unique.",
  path: ["lines"],
});

export const budgetListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  status: z.enum(["Draft", "Pending Approval", "Approved", "Closed"]).optional(),
});

export const budgetStatusSchema = z.object({
  action: z.enum(["submit", "approve", "close"]),
});
