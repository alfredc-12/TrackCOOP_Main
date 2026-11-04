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

/** Filters shared by the directory list and its KPI summary. */
export type MemberFilters = {
  /** Internal analytics selection; public filter schemas never accept member IDs. */
  memberIds?: string[];
  search?: string;
  approvalStatus?: ApprovalStatus;
  officialMemberStatus?: OfficialMemberStatus;
  membershipType?: MembershipType;
  barangay?: string;
  sector?: string;
  accountLink?: "linked" | "unlinked";
  /** Inclusive Asia/Manila calendar dates (YYYY-MM-DD) for the approval date. */
  approvedFrom?: string;
  approvedTo?: string;
};

export type MemberListQuery = MemberFilters & {
  page: number;
  pageSize: number;
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

export type HistoryChangeType =
  | "application-status"
  | "member-status"
  | "membership-type"
  | "member-status-and-type"
  | "account-status"
  | "account-role";

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
  actorId: string | null;
  changeType: HistoryChangeType;
  changedAt: Date;
};

export type UnifiedStatusHistoryFilters = {
  search?: string;
  sourceModule?: "All" | "Application" | "Member" | "Account";
  /** One exact Asia/Manila calendar date; takes precedence over `from`/`to`. */
  date?: string;
  from?: string;
  to?: string;
  /** A user id, or `none` for events with no recorded actor. */
  actorId?: string;
  changeType?: "application-status" | "member-status" | "membership-type" | "account-status" | "account-role";
};

export type UnifiedStatusHistoryQuery = UnifiedStatusHistoryFilters & { page: number; pageSize: number };

/** Counts are history events, not distinct people. */
export type UnifiedStatusHistorySummary = {
  total: number;
  application: number;
  member: number;
  account: number;
  /** Distinct application/member/account records the events belong to. */
  distinctSubjects: number;
  /** Events visible with no filter at all. */
  overallTotal: number;
};

export type HistoryActorOptions = {
  actors: Array<{ id: string; name: string; total: number }>;
  /** Events with no recorded actor. */
  withoutActor: number;
};

/**
 * Counts for the population matching every filter except approval status, official status and
 * membership type, so the cards keep showing the distribution those filters select from.
 * `approvedMembers` and its parts describe approved profiles only; `all` fields cover every profile.
 */
export type MemberSummary = {
  /** Every profile in scope, including pending and rejected ones. */
  total: number;
  pendingApproval: number;
  needsInformation: number;
  rejected: number;
  approved: number;
  /** Profile counts regardless of approval status. Prefer `approvedMembers` for membership KPIs. */
  associate: number;
  trueMember: number;
  active: number;
  inactive: number;
  suspended: number;
  approvedMembers: {
    total: number;
    /** Official status within approved members: Active + Inactive + Suspended + Terminated + Pending = total. */
    active: number;
    inactive: number;
    suspended: number;
    terminated: number;
    pendingOfficial: number;
    /** Associate + True Member = total. */
    associate: number;
    trueMember: number;
    /** Approved members with no linked user account. */
    unlinked: number;
  };
  /** Profiles visible with no filter at all. */
  overallTotal: number;
};

export type BarangayDistribution = {
  barangay: string;
  total: number;
};
