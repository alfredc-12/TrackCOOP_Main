import type { RequestedMembershipType } from "./membership-application.types";

export type ApplicationCapitalValidationStatus =
  | "Pending"
  | "Validated"
  | "Rejected"
  | "Needs Clarification"
  | "Reversed";

export type ApplicationCapitalReference = {
  paymentReferenceId: string;
  referenceNumber: string;
  amount: number;
  validationStatus: ApplicationCapitalValidationStatus;
  validatedBy: string | null;
  validatedAt: Date | null;
  paidAt: Date | null;
  submittedAt: Date;
};

export type CapitalConversionPlan = {
  validatedReferences: ApplicationCapitalReference[];
  missingReferences: ApplicationCapitalReference[];
  validatedTotal: number;
};

export type ApprovalMembershipDecision = {
  membershipType: RequestedMembershipType;
  trueMemberEligible: boolean;
  needsShareCapitalDeadline: boolean;
};

export type CapitalReconciliationResult = {
  applicationId: string;
  memberId: string;
  validatedCapitalAmount: number;
  validatedReferenceCount: number;
  insertedCapitalRows: number;
  linkedPaymentReferences: number;
  linkedFinancialRecords: number;
};
