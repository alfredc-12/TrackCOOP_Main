import { z } from "zod";

export const financialCategoryTypes = ["Income", "Expense", "Both"] as const;
export const financialRecordTypes = ["Income", "Expense", "Adjustment"] as const;
export const financialSourceModules = [
  "Manual",
  "Membership",
  "Payment",
  "Share Capital",
  "Rental",
  "POS",
  "Document",
  "Other",
] as const;
export const financialRecordStatuses = ["Active", "Corrected", "Reversed", "Voided"] as const;

export const financialCategorySchema = z.object({
  categoryCode: z.string().trim().min(2).max(60),
  categoryName: z.string().trim().min(2).max(120),
  categoryType: z.enum(financialCategoryTypes),
  description: z.string().trim().max(2000).nullable().optional(),
  isActive: z.coerce.boolean().default(true),
});

export const updateFinancialCategorySchema = financialCategorySchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  { message: "At least one category field is required" },
);

export const listFinancialRecordsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().trim().min(1).max(190).optional(),
  recordType: z.enum(financialRecordTypes).optional(),
  recordStatus: z.enum(financialRecordStatuses).optional(),
  sortBy: z.enum(["recordDate", "amount", "recordNumber"]).default("recordDate"),
  sortDirection: z.enum(["asc", "desc"]).default("desc"),
});

export const financialRecordSchema = z.object({
  recordNumber: z.string().trim().min(2).max(60),
  paymentReferenceId: z.string().trim().min(1).max(30).nullable().optional(),
  memberId: z.string().trim().min(1).max(30).nullable().optional(),
  financialCategoryId: z.string().trim().min(1).max(30),
  recordType: z.enum(financialRecordTypes),
  sourceModule: z.enum(financialSourceModules).default("Manual"),
  sourceRecordId: z.string().trim().min(1).max(30).nullable().optional(),
  amount: z.coerce.number().positive().max(99_999_999.99),
  recordDate: z.iso.date(),
  remarks: z.string().trim().max(2000).nullable().optional(),
});

export const updateFinancialRecordSchema = financialRecordSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  { message: "At least one financial record field is required" },
);
