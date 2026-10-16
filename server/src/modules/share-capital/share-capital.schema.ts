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

export const shareCapitalAccountsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(25),
  search: z.string().trim().min(1).max(190).optional(),
});

export const shareCapitalLedgerQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(25),
  search: z.string().trim().min(1).max(190).optional(),
  memberId: z.string().trim().min(1).max(30).optional(),
  direction: z.enum(["Credit", "Debit"]).optional(),
  status: z.enum(["Posted", "Reversed"]).optional(),
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

export const memberShareCapitalTransactionsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(50).default(10),
  dateFrom: z.iso.date().optional(),
  dateTo: z.iso.date().optional(),
  direction: z.enum(["Credit", "Debit"]).optional(),
  status: z.enum(["Posted", "Reversed"]).optional(),
}).refine((value) => !value.dateFrom || !value.dateTo || value.dateTo >= value.dateFrom, {
  message: "The transaction end date must be on or after the start date",
  path: ["dateTo"],
});

export const createDividendDeclarationSchema = z.object({
  name: z.string().trim().min(3).max(160),
  coverageStart: z.iso.date(),
  coverageEnd: z.iso.date(),
  availableAt: z.iso.datetime({ offset: true }),
  netSurplus: z.coerce.number().nonnegative(),
  statutoryReserves: z.coerce.number().nonnegative(),
  interestAllocationRate: z.coerce.number().nonnegative().max(70),
  notes: z.string().trim().max(1000).nullable().optional(),
}).refine((value) => value.coverageEnd >= value.coverageStart, {
  message: "Coverage end must be on or after coverage start",
  path: ["coverageEnd"],
}).refine((value) => value.statutoryReserves <= value.netSurplus, {
  message: "Statutory reserves cannot exceed net surplus",
  path: ["statutoryReserves"],
});

export const dividendDeclarationPreviewSchema = z.object({
  coverageStart: z.iso.date(),
  coverageEnd: z.iso.date(),
  netSurplus: z.coerce.number().nonnegative(),
  statutoryReserves: z.coerce.number().nonnegative(),
  interestAllocationRate: z.coerce.number().nonnegative().max(70),
}).refine((value) => value.coverageEnd >= value.coverageStart, {
  message: "Coverage end must be on or after coverage start",
  path: ["coverageEnd"],
}).refine((value) => value.statutoryReserves <= value.netSurplus, {
  message: "Statutory reserves cannot exceed net surplus",
  path: ["statutoryReserves"],
});

export const dividendFinancialBasisQuerySchema = z.object({
  coverageStart: z.iso.date(),
  coverageEnd: z.iso.date(),
}).refine((value) => value.coverageEnd >= value.coverageStart, {
  message: "Coverage end must be on or after coverage start",
  path: ["coverageEnd"],
});

export const completeDividendWithdrawalSchema = z.object({
  referenceNumber: z.string().trim().min(2).max(190),
  notes: z.string().trim().max(1000).nullable().optional(),
});

export const completeDividendActionSchema = z.object({
  referenceNumber: z.string().trim().max(190).optional().default(""),
  notes: z.string().trim().max(1000).nullable().optional(),
  withdrawalReceipt: z
    .string()
    .trim()
    .max(850_000)
    .refine((value) => /^data:(?:application\/pdf|image\/(?:png|jpe?g|webp));base64,/i.test(value), "Receipt must be a PDF, PNG, JPG, or WebP file.")
    .nullable()
    .optional(),
  withdrawalReceiptName: z.string().trim().max(190).nullable().optional(),
});

export const requestDividendWithdrawalSchema = z.object({
  withdrawalMethod: z.enum(["Cash", "Online Transfer"]),
  withdrawalProvider: z.string().trim().max(80).nullable().optional(),
  withdrawalAccountName: z.string().trim().max(190).nullable().optional(),
  withdrawalAccountNumber: z.string().trim().max(190).nullable().optional(),
  withdrawalQrCode: z
    .string()
    .trim()
    .max(700_000)
    .refine((value) => /^data:image\/(?:png|jpe?g|webp);base64,/i.test(value), "QR code must be a PNG, JPG, or WebP image.")
    .nullable()
    .optional(),
}).superRefine((value, context) => {
  if (value.withdrawalMethod !== "Online Transfer") return;

  if (!value.withdrawalProvider) {
    context.addIssue({ code: "custom", path: ["withdrawalProvider"], message: "Select an online transfer provider." });
  }
  if (!value.withdrawalAccountName) {
    context.addIssue({ code: "custom", path: ["withdrawalAccountName"], message: "Enter the account name." });
  }
  if (!value.withdrawalAccountNumber && !value.withdrawalQrCode) {
    context.addIssue({ code: "custom", path: ["withdrawalAccountNumber"], message: "Enter an account number or upload a QR code." });
  }
});
