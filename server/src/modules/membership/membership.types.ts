import type { AuthContext } from "../auth/auth.types";

export const applicationStatuses = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "NEEDS_INFORMATION",
  "ON_HOLD",
  "APPROVED_PENDING_PAYMENT",
  "PAYMENT_UNDER_REVIEW",
  "APPROVED",
  "REJECTED",
  "ACCOUNT_PENDING_ACTIVATION",
  "ACCOUNT_CREATED",
  "WITHDRAWN",
  "CANCELLED",
] as const;

export const paymentStatuses = [
  "NOT_SUBMITTED",
  "PENDING",
  "UNDER_REVIEW",
  "VERIFIED",
  "REJECTED",
  "NEEDS_CLARIFICATION",
] as const;

export const preferredMembershipTypes = [
  "ASSOCIATE",
  "TRUE_MEMBER",
  "NOT_SURE",
] as const;

export type ApplicationStatus = (typeof applicationStatuses)[number];
export type MembershipPaymentStatus = (typeof paymentStatuses)[number];
export type PreferredMembershipType = (typeof preferredMembershipTypes)[number];
export type ApprovedMembershipType = Exclude<
  PreferredMembershipType,
  "NOT_SURE"
>;

export const membershipRules = {
  associateFee: 200,
  trueMemberInitialPayment: 1500,
  shareValue: 3000,
  maximumShareCapital: 15000,
  completionPeriodMonths: 12,
} as const;

export const validStatusTransitions: Record<
  ApplicationStatus,
  readonly ApplicationStatus[]
> = {
  SUBMITTED: ["UNDER_REVIEW", "CANCELLED"],
  UNDER_REVIEW: [
    "NEEDS_INFORMATION",
    "ON_HOLD",
    "APPROVED_PENDING_PAYMENT",
    "APPROVED",
    "REJECTED",
  ],
  NEEDS_INFORMATION: ["UNDER_REVIEW", "WITHDRAWN"],
  ON_HOLD: ["UNDER_REVIEW", "REJECTED"],
  APPROVED_PENDING_PAYMENT: ["PAYMENT_UNDER_REVIEW", "APPROVED"],
  PAYMENT_UNDER_REVIEW: ["APPROVED_PENDING_PAYMENT", "APPROVED"],
  APPROVED: ["ACCOUNT_PENDING_ACTIVATION", "ACCOUNT_CREATED"],
  REJECTED: [],
  ACCOUNT_PENDING_ACTIVATION: ["ACCOUNT_CREATED"],
  ACCOUNT_CREATED: [],
  WITHDRAWN: [],
  CANCELLED: [],
};

export type MembershipApplicationInput = {
  idempotencyKey: string;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  suffix?: string | null;
  contactNumber: string;
  email: string;
  preferredContactMethod: "Phone" | "SMS" | "Email";
  completeAddress: string;
  barangay: string;
  municipality: string;
  province: string;
  sector: string;
  livelihood: string;
  applicantClassification: "Farmer" | "Fisherfolk" | "Both" | "Other";
  primaryActivity: string;
  preferredMembershipType: PreferredMembershipType;
  consentAccuracy: boolean;
  consentPrivacy: boolean;
  consentNoImmediateMembership: boolean;
  consentAccountAfterApproval: boolean;
  privacyNoticeVersion: string;
};

export type UploadedApplicationDocument = {
  documentType: string;
  originalFileName: string;
  storedFilePath: string;
  mimeType: string;
  fileSizeBytes: number;
};

export type ReviewAction =
  | { action: "START_REVIEW"; publicMessage?: string; internalNote?: string }
  | {
      action: "REQUEST_INFORMATION";
      publicMessage: string;
      internalNote?: string;
    }
  | { action: "PLACE_ON_HOLD"; publicMessage?: string; internalNote: string }
  | {
      action: "APPROVE";
      approvedMembershipType: ApprovedMembershipType;
      publicMessage: string;
      internalNote?: string;
    }
  | {
      action: "REJECT";
      publicMessage: string;
      internalNote?: string;
      rejectionCategory: string;
    };

export type AccountCreationInput = {
  duplicateResolution: "CONFIRM_NEW" | "LINK_EXISTING";
  linkedMemberId?: string;
  overrideReason: string;
};

export type Actor = AuthContext;
