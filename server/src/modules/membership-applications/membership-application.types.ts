export const membershipApplicationStatuses = [
  "Submitted",
  "Under Review",
  "Needs Information",
  "Approved",
  "Rejected",
  "Withdrawn",
] as const;

export const membershipApplicationSources = [
  "Public Website",
  "Chairman Entry",
  "Imported Paper Form",
] as const;

export const requestedMembershipTypes = ["Associate", "True Member"] as const;

export const civilStatuses = [
  "Single",
  "Married",
  "Widowed",
  "Separated",
  "Other",
] as const;

export const requirementTypes = [
  "Orientation/Seminar",
  "Associate Membership Fee",
  "Initial Share Capital",
  "Signed Application",
  "Valid ID",
  "Proof of Residency",
  "Other",
] as const;

export const requirementStatuses = [
  "Pending",
  "Submitted",
  "Verified",
  "Rejected",
  "Waived",
] as const;

export const documentTypes = [
  "Scanned Paper Application",
  "Signed Application",
  "Valid ID",
  "Proof of Residency",
  "Membership Fee Proof",
  "Share Capital Proof",
  "Other",
] as const;

export type MembershipApplicationStatus = (typeof membershipApplicationStatuses)[number];
export type MembershipApplicationSource = (typeof membershipApplicationSources)[number];
export type RequestedMembershipType = (typeof requestedMembershipTypes)[number];
export type CivilStatus = (typeof civilStatuses)[number];
export type RequirementType = (typeof requirementTypes)[number];
export type RequirementStatus = (typeof requirementStatuses)[number];
export type MembershipApplicationDocumentType = (typeof documentTypes)[number];

export type MembershipApplicationBeneficiaryInput = {
  fullName: string;
  relationship?: string | null;
  ageAtApplication?: number | null;
  birthDate?: string | null;
};

export type PublicMembershipApplicationInput = {
  requestedMembershipType: RequestedMembershipType;
  fullName: string;
  email?: string | null;
  contactNumber: string;
  civilStatus?: CivilStatus | null;
  placeOfBirth?: string | null;
  dateOfBirth?: string | null;
  currentAddress: string;
  barangay?: string | null;
  municipality: string;
  province: string;
  fatherName?: string | null;
  motherName?: string | null;
  spouseName?: string | null;
  occupation?: string | null;
  orientationCommitmentAccepted: true;
  membershipFeeCommitmentAccepted: true;
  shareSubscriptionCommitmentAccepted: true;
  patronageRefundAcknowledged: boolean;
  bylawsAgreementAccepted: true;
  privacyConsentAccepted: true;
  applicantSignatureName: string;
  signedAt: string;
  signedPlace: string;
  termsVersion?: string | null;
  beneficiaries: MembershipApplicationBeneficiaryInput[];
};

export type PublicSubmissionContext = {
  ipAddress: string | null;
  userAgent: string | null;
};

export type MembershipSettings = {
  associateFee: number;
  initialShareCapital: number;
  trueMemberRequiredCapital: number;
  maximumShareCapital: number;
  shareCapitalDeadlineMonths: number;
  orientationRequired: boolean;
  activationTokenHours: number;
  termsVersion: string;
};

export type PublicSubmissionResult = {
  applicationCode: string;
  trackingToken: string;
  duplicateWarning: boolean;
  warnings: string[];
  submittedAt: Date;
  nextStep: "Chairman review";
};

export type PublicStatusRequirement = {
  requirementType: RequirementType;
  requirementStatus: RequirementStatus;
  remarks: string | null;
};

export type PublicApplicationStatus = {
  applicationCode: string;
  fullName: string;
  submittedAt: Date;
  applicationStatus: MembershipApplicationStatus;
  latestApplicantMessage: string | null;
  missingOrRejectedRequirements: PublicStatusRequirement[];
};

export type PublicApplicationRecord = PublicApplicationStatus & {
  id: string;
  publicTrackingTokenHash: string;
};

export type PublicDocumentUploadInput = {
  documentType: MembershipApplicationDocumentType;
  originalFileName: string;
  mimeType: string;
  fileSizeBytes: number;
  buffer: Buffer;
};

export type StoredMembershipApplicationDocument = {
  documentType: MembershipApplicationDocumentType;
  originalFileName: string;
  mimeType: string;
  fileSizeBytes: number;
  checksumSha256: string;
  uploadedAt: Date;
};
