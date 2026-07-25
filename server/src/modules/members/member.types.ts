export type MembershipType = "Associate" | "True Member";
export type ApprovalStatus = "Pending" | "Approved" | "Rejected" | "Needs Information";
export type OfficialMemberStatus =
  | "Pending"
  | "Active"
  | "Inactive"
  | "Suspended"
  | "Terminated";

export type MemberProfile = {
  id: string;
  userId: string | null;
  linkedUserEmail: string | null;
  linkedUserUsername: string | null;
  linkedUserStatus: string | null;
  linkedUserRole: string | null;
  memberCode: string;
  fullName: string;
  contactNumber: string | null;
  email: string | null;
  barangay: string | null;
  municipality: string;
  province: string;
  sector: string | null;
  membershipType: MembershipType;
  approvalStatus: ApprovalStatus;
  officialMemberStatus: OfficialMemberStatus;
  applicationDate: Date | null;
  approvedBy: string | null;
  approvedAt: Date | null;
  trueMemberSince: Date | null;
  shareCapitalDeadline: Date | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type MemberListQuery = {
  page: number;
  pageSize: number;
  search?: string;
  approvalStatus?: ApprovalStatus;
  officialMemberStatus?: OfficialMemberStatus;
  membershipType?: MembershipType;
  barangay?: string;
  sortBy: "fullName" | "memberCode" | "createdAt" | "applicationDate";
  sortDirection: "asc" | "desc";
};

export type MemberListResult = {
  members: MemberProfile[];
  total: number;
  page: number;
  pageSize: number;
};

export type MemberProfileInput = {
  userId?: string | null;
  memberCode: string;
  fullName: string;
  contactNumber?: string | null;
  email?: string | null;
  barangay?: string | null;
  municipality?: string;
  province?: string;
  sector?: string | null;
  membershipType?: MembershipType;
  approvalStatus?: ApprovalStatus;
  officialMemberStatus?: OfficialMemberStatus;
  applicationDate?: string | null;
  trueMemberSince?: string | null;
  shareCapitalDeadline?: string | null;
  notes?: string | null;
};

export type UpdateMemberProfileInput = Partial<MemberProfileInput>;

export type ShareCapitalProgress = {
  validatedTotal: number;
  pendingTotal: number;
  validatedPayments: number;
  fullRequirement: number;
  maximumAllowed: number;
  remainingToFull: number;
  remainingAllowed: number;
  fullRequirementMet: boolean;
};

export type MemberPaymentActivity = {
  id: string;
  referenceNumber: string;
  paymentPurpose: string;
  amount: number;
  validationStatus: string;
  submittedAt: Date;
};

export type MemberPosActivity = {
  id: string;
  saleNumber: string;
  saleStatus: string;
  paymentStatus: string;
  totalAmount: number;
  saleDate: Date;
};

export type MemberRentalActivity = {
  id: string;
  bookingNumber: string;
  assetName: string;
  bookingStatus: string;
  paymentStatus: string;
  totalAmount: number;
  startDatetime: Date;
};

export type MemberLatestIndicator = {
  id: string;
  statusLabel: string;
  totalScore: number;
  computedAt: Date;
  basisSummary: string | null;
};

export type MemberDetail = MemberProfile & {
  shareCapital: ShareCapitalProgress;
  recentPayments: MemberPaymentActivity[];
  recentPosActivity: MemberPosActivity[];
  recentRentalActivity: MemberRentalActivity[];
  latestIndicator: MemberLatestIndicator | null;
  statusHistory: MemberStatusHistoryEntry[];
};

export type UpdateMemberStatusInput = {
  membershipType?: MembershipType;
  officialMemberStatus?: OfficialMemberStatus;
  reason: string;
  confirmation: string;
};

export type MemberStatusHistoryEntry = {
  id: string;
  memberId: string;
  oldMembershipType: MembershipType | null;
  newMembershipType: MembershipType | null;
  oldOfficialStatus: OfficialMemberStatus | null;
  newOfficialStatus: OfficialMemberStatus | null;
  reason: string | null;
  changedBy: string;
  changedAt: Date;
};

export type UnifiedStatusHistoryEntry = {
  id: string;
  sourceModule: "Application" | "Member" | "Account";
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  oldStatus: string | null;
  newStatus: string;
  reason: string | null;
  actor: string | null;
  changedAt: Date;
};

export type MemberSummary = {
  total: number;
  pendingApproval: number;
  approved: number;
  associate: number;
  trueMember: number;
  active: number;
  inactive: number;
  suspended: number;
};

export type BarangayDistribution = {
  barangay: string;
  total: number;
};
