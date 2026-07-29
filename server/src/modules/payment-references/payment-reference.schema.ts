import { z } from "zod";

export const paymentPurposes = [
  "Associate Membership Fee", "Share Capital", "Rental", "POS/Product",
  "Preorder", "Bulk Order", "Document/Certificate", "Other",
] as const;
export const validationStatuses = [
  "Pending", "Validated", "Rejected", "Needs Clarification", "Reversed",
] as const;
export const paymentChannels = [
  "PayMongo", "Manual GCash", "Cash", "Bank Transfer", "Other",
] as const;
export const validationSources = [
  "Manual Bookkeeper", "PayMongo Webhook", "System",
] as const;
const nullableText = (max: number) => z.string().trim().max(max).nullable().optional();

export const listPaymentReferencesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().trim().min(1).max(190).optional(),
  validationStatus: z.enum(validationStatuses).optional(),
  paymentPurpose: z.enum(paymentPurposes).optional(),
  paymentChannel: z.enum(paymentChannels).optional(),
  validationSource: z.enum(validationSources).optional(),
  gatewayOnly: z.coerce.boolean().optional(),
  manualOnly: z.coerce.boolean().optional(),
  failedEvents: z.coerce.boolean().optional(),
  dateFrom: z.iso.date().optional(),
  dateTo: z.iso.date().optional(),
  amountMin: z.coerce.number().finite().nonnegative().optional(),
  amountMax: z.coerce.number().finite().nonnegative().optional(),
  sortBy: z.enum(["submittedAt", "amount", "referenceNumber", "paidAt"]).default("submittedAt"),
  sortDirection: z.enum(["asc", "desc"]).default("desc"),
}).superRefine((value, context) => {
  if (value.amountMin !== undefined && value.amountMax !== undefined && value.amountMin > value.amountMax) {
    context.addIssue({ code: "custom", path: ["amountMax"], message: "Maximum amount must be greater than or equal to minimum amount" });
  }
  if (value.dateFrom && value.dateTo && value.dateFrom > value.dateTo) {
    context.addIssue({ code: "custom", path: ["dateTo"], message: "Date to must be on or after date from" });
  }
});

export const paymentReferenceSchema = z.object({
  memberId: nullableText(30), submittedBy: nullableText(30), payerName: nullableText(190),
  payerEmail: z.email().max(190).nullable().optional(), payerContact: nullableText(40),
  provider: z.string().trim().min(2).max(100).default("Reference-Based Payment"),
  referenceNumber: z.string().trim().min(2).max(190), paymentPurpose: z.enum(paymentPurposes),
  relatedEntityType: nullableText(80), relatedEntityId: nullableText(30),
  amount: z.coerce.number().positive().max(99_999_999.99), proofFilePath: nullableText(500),
  notes: nullableText(2000),
});
export const updatePaymentReferenceSchema = paymentReferenceSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  { message: "At least one payment reference field is required" },
);
export const reviewPaymentReferenceSchema = z.object({ reason: z.string().trim().max(2000).nullable().optional() });
export const reversePaymentReferenceSchema = z.object({
  reason: z.string().trim().min(8).max(2000), confirmation: z.string().trim().min(1).max(190),
});
export const retryGatewayEventSchema = z.object({
  note: z.string().trim().min(8).max(1000),
});
