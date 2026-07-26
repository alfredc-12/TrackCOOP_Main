import { z } from "zod";
import {
  civilStatuses,
  documentTypes,
  membershipApplicationSources,
  membershipApplicationStatuses,
  requestedMembershipTypes,
  requirementStatuses,
  requirementTypes,
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

function applicantFullName(value: {
  firstName: string;
  middleName?: string | null;
  lastName: string;
  suffix?: string | null;
}) {
  return [value.firstName, value.middleName, value.lastName, value.suffix]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");
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
    firstName: requiredText(100),
    middleName: optionalText(100),
    lastName: requiredText(100),
    suffix: optionalText(30),
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

    if (!signatureMatches(applicantFullName(value), value.applicantSignatureName)) {
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

export const chairmanApplicationListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: optionalText(120),
  status: z.enum(membershipApplicationStatuses).optional(),
  requestedMembershipType: z.enum(requestedMembershipTypes).optional(),
  applicationSource: z.enum(membershipApplicationSources).optional(),
  barangay: optionalText(120),
  sortBy: z
    .enum(["submittedAt", "fullName", "applicationStatus", "requestedMembershipType"])
    .default("submittedAt"),
  sortDirection: z.enum(["asc", "desc"]).default("desc"),
});

export const idParamsSchema = z.object({
  id: z.coerce.string().trim().regex(/^\d+$/, "ID must be numeric"),
});

export const chairmanMembershipApplicationSchema = publicMembershipApplicationSchema.and(
  z.object({
    applicationSource: z
      .enum(["Chairman Entry", "Imported Paper Form"])
      .default("Chairman Entry"),
  }),
);

export const chairmanMembershipApplicationUpdateSchema = z
  .object({
    requestedMembershipType: z.enum(requestedMembershipTypes).optional(),
    firstName: requiredText(100).optional(),
    middleName: optionalText(100),
    lastName: requiredText(100).optional(),
    suffix: optionalText(30),
    email: z.email().max(190).optional().nullable(),
    contactNumber: requiredText(40).optional(),
    civilStatus: z.enum(civilStatuses).optional().nullable(),
    placeOfBirth: optionalText(255),
    dateOfBirth: optionalText(10).refine((value) => value === null || isPastDate(value), {
      message: "Date of birth must be a valid past date",
    }),
    currentAddress: requiredText(500).optional(),
    barangay: optionalText(120),
    municipality: requiredText(120).optional(),
    province: requiredText(120).optional(),
    fatherName: optionalText(190),
    motherName: optionalText(190),
    spouseName: optionalText(190),
    occupation: optionalText(190),
    orientationCommitmentAccepted: z.boolean().optional(),
    membershipFeeCommitmentAccepted: z.boolean().optional(),
    shareSubscriptionCommitmentAccepted: z.boolean().optional(),
    patronageRefundAcknowledged: z.boolean().optional(),
    bylawsAgreementAccepted: z.boolean().optional(),
    privacyConsentAccepted: z.boolean().optional(),
    applicantSignatureName: requiredText(190).optional(),
    signedAt: requiredText(40).refine(isValidDateTime, {
      message: "Signed date and time must be valid",
    }).optional(),
    signedPlace: requiredText(190).optional(),
    boardMeetingDate: optionalText(10),
    secretaryName: optionalText(190),
    decisionReason: optionalText(4000),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided",
  });

export const beneficiaryCreateSchema = beneficiarySchema.extend({
  displayOrder: z.coerce.number().int().min(0).max(1000).optional(),
});

export const beneficiaryUpdateSchema = z
  .object({
    fullName: requiredText(190).optional(),
    relationship: optionalText(100),
    ageAtApplication: z.coerce.number().int().min(0).max(130).nullable().optional(),
    birthDate: optionalText(10).refine((value) => value === null || isPastDate(value), {
      message: "Birth date must be a valid past date",
    }),
    displayOrder: z.coerce.number().int().min(0).max(1000).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided",
  });

export const requirementCreateSchema = z
  .object({
    requirementType: z.enum(requirementTypes),
    requirementStatus: z.enum(requirementStatuses).default("Pending"),
    paymentReferenceId: z.coerce.string().regex(/^\d+$/).optional().nullable(),
    documentId: z.coerce.string().regex(/^\d+$/).optional().nullable(),
    completionDate: optionalText(10),
    remarks: optionalText(4000),
  })
  .superRefine((value, context) => {
    if (value.requirementStatus === "Waived" && !value.remarks) {
      context.addIssue({
        code: "custom",
        path: ["remarks"],
        message: "A reason is required when waiving a requirement",
      });
    }
  });

export const requirementUpdateSchema = z
  .object({
    requirementStatus: z.enum(requirementStatuses).optional(),
    paymentReferenceId: z.coerce.string().regex(/^\d+$/).optional().nullable(),
    documentId: z.coerce.string().regex(/^\d+$/).optional().nullable(),
    completionDate: optionalText(10),
    remarks: optionalText(4000),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided",
  })
  .superRefine((value, context) => {
    if (value.requirementStatus === "Waived" && !value.remarks) {
      context.addIssue({
        code: "custom",
        path: ["remarks"],
        message: "A reason is required when waiving a requirement",
      });
    }
  });

export const statusTransitionSchema = z.object({
  reason: optionalText(4000),
  applicantMessage: optionalText(4000),
  internalNote: optionalText(4000),
});

export const approvalSchema = z.object({
  boardMeetingDate: requiredText(10),
  secretaryName: requiredText(190),
  decisionReason: requiredText(4000),
  createMemberPortalAccount: z.boolean().default(false),
  accountEmail: z.email().max(190).optional().nullable(),
  username: optionalText(80),
});
