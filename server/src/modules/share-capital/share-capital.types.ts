export type ShareCapitalStatus = "Pending" | "Validated" | "Rejected" | "Reversed";

export type ShareCapitalPayment = {
  id: string;
  memberId: string;
  memberCode: string;
  memberName: string;
  paymentReferenceId: string | null;
  amount: number;
  paymentDate: Date;
  paymentStatus: ShareCapitalStatus;
  verifiedBy: string | null;
  verifiedAt: Date | null;
  reversalOfPaymentId: string | null;
  remarks: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ShareCapitalListQuery = {
  page: number;
  pageSize: number;
  search?: string;
  memberId?: string;
  paymentStatus?: ShareCapitalStatus;
  sortBy: "paymentDate" | "amount" | "createdAt";
  sortDirection: "asc" | "desc";
};

export type ShareCapitalListResult = {
  payments: ShareCapitalPayment[];
  total: number;
  page: number;
  pageSize: number;
};

export type ShareCapitalInput = {
  memberId: string;
  paymentReferenceId?: string | null;
  amount: number;
  paymentDate: string;
  paymentStatus?: ShareCapitalStatus;
  remarks?: string | null;
};

export type UpdateShareCapitalInput = Partial<ShareCapitalInput>;

export type MemberShareCapitalProgress = {
  memberId: string;
  memberCode: string;
  memberName: string;
  validatedTotal: number;
  initialRequirement: number;
  fullRequirement: number;
  maximumAllowed: number;
  remainingToInitial: number;
  remainingToFull: number;
  remainingAllowed: number;
  initialMet: boolean;
  fullRequirementMet: boolean;
  deadline: Date | null;
};

export type ShareCapitalSummary = {
  validatedTotal: number;
  pendingTotal: number;
  validatedPayments: number;
  membersWithValidatedCapital: number;
  initialRequirement: number;
  fullRequirement: number;
  maximumAllowed: number;
};
