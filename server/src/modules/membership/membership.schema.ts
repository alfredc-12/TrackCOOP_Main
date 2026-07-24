import { z } from "zod";
import {
  applicationStatuses,
  preferredMembershipTypes,
} from "./membership.types";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || null)
    .optional();

export const applicationInputSchema = z.object({
  idempotencyKey: z.uuid(),
  firstName: z.string().trim().min(1).max(100),
  middleName: optionalText(100),
  lastName: z.string().trim().min(1).max(100),
  suffix: optionalText(30),
  contactNumber: z
    .string()
    .trim()
    .min(7)
    .max(40)
    .regex(/^[+()\d\s-]+$/, "Enter a valid contact number"),
  email: z.email().max(190),
  preferredContactMethod: z.enum(["Phone", "SMS", "Email"]),
  completeAddress: z.string().trim().min(5).max(500),
  barangay: z.string().trim().min(1).max(120),
  municipality: z.string().trim().min(2).max(120).default("Nasugbu"),
  province: z.string().trim().min(2).max(120).default("Batangas"),
  sector: z.string().trim().min(1).max(100),
  livelihood: z.string().trim().min(2).max(190),
  applicantClassification: z.enum(["Farmer", "Fisherfolk", "Both", "Other"]),
  primaryActivity: z.string().trim().min(2).max(190),
  preferredMembershipType: z.enum(preferredMembershipTypes),
  consentAccuracy: z.literal(true),
  consentPrivacy: z.literal(true),
  consentNoImmediateMembership: z.literal(true),
  consentAccountAfterApproval: z.literal(true),
  privacyNoticeVersion: z.string().trim().min(1).max(40),
});

export const statusLookupSchema = z.object({
  reference: z.string().trim().min(10).max(40),
  contactNumber: z.string().trim().min(7).max(40),
});

export const additionalInformationSchema = statusLookupSchema.extend({
  information: z.string().trim().min(2).max(4000),
});

export const listApplicationsSchema = z.object({
  status: z.enum(applicationStatuses).optional(),
  search: z.string().trim().max(190).optional(),
});

export const reviewActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("START_REVIEW"),
    publicMessage: z.string().trim().max(2000).optional(),
    internalNote: z.string().trim().max(2000).optional(),
  }),
  z.object({
    action: z.literal("REQUEST_INFORMATION"),
    publicMessage: z.string().trim().min(2).max(2000),
    internalNote: z.string().trim().max(2000).optional(),
  }),
  z.object({
    action: z.literal("PLACE_ON_HOLD"),
    publicMessage: z.string().trim().max(2000).optional(),
    internalNote: z.string().trim().min(2).max(2000),
  }),
  z.object({
    action: z.literal("APPROVE"),
    approvedMembershipType: z.enum(["ASSOCIATE", "TRUE_MEMBER"]),
    publicMessage: z.string().trim().min(2).max(2000),
    internalNote: z.string().trim().max(2000).optional(),
  }),
  z.object({
    action: z.literal("REJECT"),
    publicMessage: z.string().trim().min(2).max(2000),
    internalNote: z.string().trim().max(2000).optional(),
    rejectionCategory: z.string().trim().min(2).max(100),
  }),
]);

export const paymentValidationSchema = z.object({
  decision: z.enum(["VERIFIED", "REJECTED", "NEEDS_CLARIFICATION"]),
  note: z.string().trim().min(2).max(2000),
});

export const accountCreationSchema = z
  .object({
    duplicateResolution: z.enum(["CONFIRM_NEW", "LINK_EXISTING"]),
    linkedMemberId: z.string().regex(/^\d+$/).optional(),
    overrideReason: z.string().trim().min(5).max(1000),
  })
  .refine(
    (value) =>
      value.duplicateResolution !== "LINK_EXISTING" ||
      Boolean(value.linkedMemberId),
    { message: "Select the existing member to link", path: ["linkedMemberId"] },
  );

export const activationSchema = z.object({
  token: z.string().min(32).max(200),
  password: z
    .string()
    .min(12)
    .max(128)
    .regex(/[a-z]/, "Password must include a lowercase letter")
    .regex(/[A-Z]/, "Password must include an uppercase letter")
    .regex(/[0-9]/, "Password must include a number"),
});
