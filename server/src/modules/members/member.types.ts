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
