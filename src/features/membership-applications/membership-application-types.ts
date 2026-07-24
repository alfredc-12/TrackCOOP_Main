export const requestedMembershipTypes = ["Associate", "True Member"] as const;
export const civilStatuses = ["Single", "Married", "Widowed", "Separated", "Other"] as const;
export const documentTypes = [
  "Scanned Paper Application",
  "Signed Application",
  "Valid ID",
  "Proof of Residency",
  "Membership Fee Proof",
  "Share Capital Proof",
  "Other",
] as const;

export type RequestedMembershipType = (typeof requestedMembershipTypes)[number];
export type CivilStatus = (typeof civilStatuses)[number];
export type MembershipDocumentType = (typeof documentTypes)[number];

export type BeneficiaryInput = {
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
  beneficiaries: BeneficiaryInput[];
  website?: string;
};

export type PublicSubmissionResult = {
  applicationCode: string;
  trackingToken: string;
  duplicateWarning: boolean;
  warnings: string[];
  submittedAt: string;
  nextStep: "Chairman review";
};

export type PublicStatusRequirement = {
  requirementType: string;
  requirementStatus: string;
  remarks: string | null;
};

export type PublicApplicationStatus = {
  applicationCode: string;
  fullName: string;
  submittedAt: string;
  applicationStatus: string;
  latestApplicantMessage: string | null;
  missingOrRejectedRequirements: PublicStatusRequirement[];
};

export type DocumentUploadDraft = {
  documentType: MembershipDocumentType;
  file: File | null;
  clientError: string | null;
};
