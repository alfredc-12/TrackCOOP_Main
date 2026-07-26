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
  firstName: string;
  middleName?: string | null;
  lastName: string;
  suffix?: string | null;
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

export type ChairmanApplicationListQuery = {
  page: number;
  pageSize: number;
  search?: string | null;
  status?: MembershipApplicationStatus;
  requestedMembershipType?: RequestedMembershipType;
  applicationSource?: MembershipApplicationSource;
  barangay?: string | null;
  sortBy: "submittedAt" | "fullName" | "applicationStatus" | "requestedMembershipType";
  sortDirection: "asc" | "desc";
};

export type ChairmanApplicationSummary = {
  total: number;
  submitted: number;
  underReview: number;
  needsInformation: number;
  approved: number;
  rejected: number;
  withdrawn: number;
};

export type ChairmanApplicationListItem = {
  id: string;
  applicationCode: string;
  applicationSource: MembershipApplicationSource;
  requestedMembershipType: RequestedMembershipType;
  firstName: string;
  middleName: string | null;
  lastName: string;
  suffix: string | null;
  fullName: string;
  email: string | null;
  contactNumber: string;
  barangay: string | null;
  applicationStatus: MembershipApplicationStatus;
  submittedAt: Date;
  reviewedAt: Date | null;
  convertedMemberId: string | null;
};

export type ChairmanApplicationListResult = {
  applications: ChairmanApplicationListItem[];
  total: number;
  page: number;
  pageSize: number;
};

export type ChairmanApplicationRequirement = {
  id: string;
  applicationId: string;
  requirementType: RequirementType;
  requirementStatus: RequirementStatus;
  paymentReferenceId: string | null;
  documentId: string | null;
  completionDate: string | null;
  verifiedBy: string | null;
  verifiedAt: Date | null;
  remarks: string | null;
};

export type ChairmanApplicationDocument = {
  id: string;
  applicationId: string;
  documentType: MembershipApplicationDocumentType;
  originalFileName: string;
  mimeType: string;
  fileSizeBytes: number;
  checksumSha256: string | null;
  uploadedByUserId: string | null;
  uploadedAt: Date;
};

export type ChairmanApplicationBeneficiary = MembershipApplicationBeneficiaryInput & {
  id: string;
  applicationId: string;
  displayOrder: number;
};

export type ChairmanApplicationHistoryEntry = {
  id: string;
  applicationId: string;
  oldStatus: MembershipApplicationStatus | null;
  newStatus: MembershipApplicationStatus;
  internalNote: string | null;
  applicantMessage: string | null;
  changedBy: string | null;
  changedAt: Date;
};

export type ChairmanApplicationDetail = ChairmanApplicationListItem &
  Omit<
    PublicMembershipApplicationInput,
    | "beneficiaries"
    | "orientationCommitmentAccepted"
    | "membershipFeeCommitmentAccepted"
    | "shareSubscriptionCommitmentAccepted"
    | "bylawsAgreementAccepted"
    | "privacyConsentAccepted"
  > & {
    id: string;
    orientationCommitmentAccepted: boolean;
    membershipFeeCommitmentAccepted: boolean;
    shareSubscriptionCommitmentAccepted: boolean;
    bylawsAgreementAccepted: boolean;
    privacyConsentAccepted: boolean;
    boardMeetingDate: string | null;
    secretaryName: string | null;
    decisionReason: string | null;
    submittedByUserId: string | null;
    reviewedBy: string | null;
    submittedIp: string | null;
    submittedUserAgent: string | null;
    beneficiaries: ChairmanApplicationBeneficiary[];
    documents: ChairmanApplicationDocument[];
    requirements: ChairmanApplicationRequirement[];
    history: ChairmanApplicationHistoryEntry[];
  };

export type ChairmanMembershipApplicationInput = PublicMembershipApplicationInput & {
  applicationSource: Extract<MembershipApplicationSource, "Chairman Entry" | "Imported Paper Form">;
};

export type ChairmanMembershipApplicationUpdateInput = Partial<
  Omit<
    PublicMembershipApplicationInput,
    | "beneficiaries"
    | "termsVersion"
    | "orientationCommitmentAccepted"
    | "membershipFeeCommitmentAccepted"
    | "shareSubscriptionCommitmentAccepted"
    | "bylawsAgreementAccepted"
    | "privacyConsentAccepted"
  >
> & {
  orientationCommitmentAccepted?: boolean;
  membershipFeeCommitmentAccepted?: boolean;
  shareSubscriptionCommitmentAccepted?: boolean;
  bylawsAgreementAccepted?: boolean;
  privacyConsentAccepted?: boolean;
  boardMeetingDate?: string | null;
  secretaryName?: string | null;
  decisionReason?: string | null;
};

export type RequirementInput = {
  requirementType: RequirementType;
  requirementStatus?: RequirementStatus;
  paymentReferenceId?: string | null;
  documentId?: string | null;
  completionDate?: string | null;
  remarks?: string | null;
};

export type RequirementUpdateInput = Partial<Omit<RequirementInput, "requirementType">>;

export type StatusTransitionInput = {
  reason?: string | null;
  applicantMessage?: string | null;
  internalNote?: string | null;
};

export type ApprovalInput = {
  boardMeetingDate: string;
  secretaryName: string;
  decisionReason: string;
  createMemberPortalAccount: boolean;
  accountEmail?: string | null;
  username?: string | null;
};

export type ApprovalResult = {
  applicationId: string;
  applicationCode: string;
  memberId: string;
  memberCode: string;
  membershipType: RequestedMembershipType;
  shareCapitalDeadline: string | null;
  activationUrl: string | null;
  activationTokenExpiresAt: Date | null;
};
