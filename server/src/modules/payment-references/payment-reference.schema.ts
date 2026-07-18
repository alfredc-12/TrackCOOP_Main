import { z } from "zod";

export const paymentPurposes = [
  "Associate Membership Fee",
  "Share Capital",
  "Rental",
  "POS/Product",
  "Preorder",
  "Bulk Order",
  "Document/Certificate",
  "Other",
] as const;

export const validationStatuses = [
  "Pending",
  "Validated",
  "Rejected",
  "Needs Clarification",
] as const;

const nullableText = (max: number) => z.string().trim().max(max).nullable().optional();

export const listPaymentReferencesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().trim().min(1).max(190).optional(),
  validationStatus: z.enum(validationStatuses).optional(),
  paymentPurpose: z.enum(paymentPurposes).optional(),
  sortBy: z.enum(["submittedAt", "amount", "referenceNumber"]).default("submittedAt"),
  sortDirection: z.enum(["asc", "desc"]).default("desc"),
});

export const paymentReferenceSchema = z.object({
  memberId: nullableText(30),
  submittedBy: nullableText(30),
  payerName: nullableText(190),
  payerEmail: z.email().max(190).nullable().optional(),
  payerContact: nullableText(40),
  provider: z.string().trim().min(2).max(100).default("Reference-Based Payment"),
  referenceNumber: z.string().trim().min(2).max(190),
  paymentPurpose: z.enum(paymentPurposes),
  relatedEntityType: nullableText(80),
  relatedEntityId: nullableText(30),
  amount: z.coerce.number().positive().max(99_999_999.99),
  proofFilePath: nullableText(500),
  notes: nullableText(2000),
});

export const updatePaymentReferenceSchema = paymentReferenceSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  { message: "At least one payment reference field is required" },
);

export const reviewPaymentReferenceSchema = z.object({
  reason: z.string().trim().max(2000).nullable().optional(),
});
