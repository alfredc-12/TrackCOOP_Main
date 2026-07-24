import { z } from "zod";
import {
  civilStatuses,
  documentTypes,
  requestedMembershipTypes,
} from "./membership-application.types";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((value) => (value && value.length > 0 ? value : null));

const requiredText = (max: number) => z.string().trim().min(1).max(max);

const accepted = (message: string) =>
  z.boolean().refine((value) => value === true, { message }).transform(() => true as const);

function normalizeComparable(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isPastDate(value: string) {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed < new Date();
}

function isValidDateTime(value: string) {
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) && parsed <= new Date(Date.now() + 5 * 60 * 1000);
}

function signatureMatches(fullName: string, signature: string) {
  const normalizedFullName = normalizeComparable(fullName);
  const normalizedSignature = normalizeComparable(signature);

  return (
    normalizedFullName === normalizedSignature ||
    normalizedFullName.includes(normalizedSignature) ||
    normalizedSignature.includes(normalizedFullName)
  );
}

export const beneficiarySchema = z
  .object({
    fullName: requiredText(190),
    relationship: optionalText(100),
    ageAtApplication: z.coerce.number().int().min(0).max(130).nullable().optional(),
    birthDate: optionalText(10).refine((value) => value === null || isPastDate(value), {
      message: "Birth date must be a valid past date",
    }),
  })
  .superRefine((value, context) => {
    if (value.ageAtApplication === null && value.birthDate === null) {
      context.addIssue({
        code: "custom",
        path: ["ageAtApplication"],
        message: "Provide either age or birth date for each beneficiary",
      });
    }
  });

export const publicMembershipApplicationSchema = z
  .object({
    requestedMembershipType: z.enum(requestedMembershipTypes).default("Associate"),
    fullName: requiredText(190),
    email: z.email().max(190).optional().nullable(),
    contactNumber: requiredText(40),
    civilStatus: z.enum(civilStatuses).optional().nullable(),
    placeOfBirth: optionalText(255),
    dateOfBirth: optionalText(10).refine((value) => value === null || isPastDate(value), {
      message: "Date of birth must be a valid past date",
    }),
    currentAddress: requiredText(500),
    barangay: optionalText(120),
    municipality: requiredText(120).default("Nasugbu"),
    province: requiredText(120).default("Batangas"),
    fatherName: optionalText(190),
    motherName: optionalText(190),
    spouseName: optionalText(190),
    occupation: optionalText(190),
    orientationCommitmentAccepted: accepted("Orientation commitment must be accepted"),
    membershipFeeCommitmentAccepted: accepted("Membership fee commitment must be accepted"),
    shareSubscriptionCommitmentAccepted: accepted("Share subscription commitment must be accepted"),
    patronageRefundAcknowledged: z.boolean().default(false),
    bylawsAgreementAccepted: accepted("Bylaws agreement must be accepted"),
    privacyConsentAccepted: accepted("Privacy consent must be accepted"),
    applicantSignatureName: requiredText(190),
    signedAt: requiredText(40).refine(isValidDateTime, {
      message: "Signed date and time must be valid",
    }),
    signedPlace: requiredText(190),
    termsVersion: optionalText(40),
    beneficiaries: z.array(beneficiarySchema).max(20).default([]),
    website: z.string().max(0).optional().default(""),
  })
  .superRefine((value, context) => {
    if (value.civilStatus === "Married" && !value.spouseName) {
      context.addIssue({
        code: "custom",
        path: ["spouseName"],
        message: "Spouse name is required when civil status is Married",
      });
    }

    if (!signatureMatches(value.fullName, value.applicantSignatureName)) {
      context.addIssue({
        code: "custom",
        path: ["applicantSignatureName"],
        message: "Signature name must match the applicant name",
      });
    }
  })
  .transform(({ website, ...value }) => {
    void website;
    return value;
  });

export const publicStatusParamsSchema = z.object({
  applicationCode: requiredText(60),
});

export const publicDocumentUploadSchema = z.object({
  documentType: z.enum(documentTypes),
});
