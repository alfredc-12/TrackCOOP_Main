export type MemberIndicatorStatus = "Active" | "Needs Monitoring" | "Inactive";

export type MemberIndicator = {
  id: string;
  memberId: string;
  memberCode: string;
  fullName: string;
  membershipType: string;
  officialMemberStatus: string;
  basisPeriodStart: Date | null;
  basisPeriodEnd: Date | null;
  recencyScore: number;
  frequencyScore: number;
  contributionScore: number;
  totalScore: number;
  statusLabel: MemberIndicatorStatus;
  basisSummary: string | null;
  computedBy: string | null;
  computedAt: Date;
};

export type MemberIndicatorListQuery = {
  page: number;
  pageSize: number;
  search?: string;
  statusLabel?: MemberIndicatorStatus;
  sortBy: "fullName" | "totalScore" | "computedAt";
  sortDirection: "asc" | "desc";
};

export type MemberIndicatorListResult = {
  indicators: MemberIndicator[];
  total: number;
  page: number;
  pageSize: number;
};

export type MemberIndicatorSummary = {
  totalTracked: number;
  active: number;
  needsMonitoring: number;
  inactive: number;
  averageScore: number;
};

export type RecalculateIndicatorsInput = {
  memberId?: string;
  basisPeriodStart?: string | null;
  basisPeriodEnd?: string | null;
};

export type RecalculateIndicatorsResult = {
  recalculated: number;
  basisPeriodStart: string | null;
  basisPeriodEnd: string | null;
};
