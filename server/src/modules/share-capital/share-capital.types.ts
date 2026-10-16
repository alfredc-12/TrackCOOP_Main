export type ShareCapitalStatus = "Pending" | "Validated" | "Rejected" | "Reversed";

export type ShareCapitalPayment = {
  id: string;
  memberId: string;
  memberCode: string;
  memberName: string;
  paymentReferenceId: string | null;
  paymentChannel?: string | null;
  referenceNumber?: string | null;
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

export type ShareCapitalAccountListQuery = {
  page: number;
  pageSize: number;
  search?: string;
};

export type ShareCapitalAccountListItem = {
  accountId: string;
  memberId: string;
  memberCode: string;
  memberName: string;
  membershipType: "Associate" | "True Member";
  initialCapital: number;
  additionalContributions: number;
  dividendsAdded: number;
  totalDeductions: number;
  currentBalance: number;
  transactionCount: number;
  reconciled: boolean;
  updatedAt: Date;
};

export type ShareCapitalLedgerListQuery = {
  page: number;
  pageSize: number;
  search?: string;
  memberId?: string;
  direction?: "Credit" | "Debit";
  status?: "Posted" | "Reversed";
};

export type ShareCapitalStaffTransaction = ShareCapitalTransaction & {
  memberCode: string;
  memberName: string;
  membershipType: "Associate" | "True Member";
};

export type ShareCapitalStaffTransactionListResult = {
  transactions: ShareCapitalStaffTransaction[];
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

export type ShareCapitalTransactionType =
  | "Initial Share Capital"
  | "Additional Capital Contribution"
  | "Dividend Added to Share Capital"
  | "Capital Adjustment Credit"
  | "Capital Adjustment Debit"
  | "Reversal";

export type ShareCapitalTransaction = {
  id: string;
  memberId: string;
  transactionDate: Date;
  transactionType: ShareCapitalTransactionType;
  direction: "Credit" | "Debit";
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  referenceNumber: string;
  sourceType: string;
  sourceId: string;
  status: "Posted" | "Reversed";
  remarks: string | null;
  createdAt: Date;
};

export type MemberShareCapitalTransactionsQuery = {
  page: number;
  pageSize: number;
  dateFrom?: string;
  dateTo?: string;
  direction?: "Credit" | "Debit";
  status?: "Posted" | "Reversed";
};

export type ShareCapitalTransactionPage = {
  transactions: ShareCapitalTransaction[];
  page: number;
  pageSize: number;
  total: number;
};

export type ShareCapitalGrowthPoint = {
  date: Date;
  balance: number;
  transactionCount: number;
};

export type MemberShareCapitalOverview = {
  member: {
    memberId: string;
    memberCode: string;
    memberName: string;
    membershipType: "Associate" | "True Member";
  };
  summary: {
    initialCapital: number;
    additionalContributions: number;
    dividendsAdded: number;
    totalDeductions: number;
    currentBalance: number;
    updatedAt: Date | null;
  };
  transactionCount: number;
  reconciliation: {
    expectedBalance: number;
    recordedBalance: number;
    difference: number;
    reconciled: boolean;
  };
};

export type DividendStatus =
  | "Pending"
  | "Available"
  | "Withdrawal Requested"
  | "Capitalization Requested"
  | "Withdrawn"
  | "Added to Share Capital"
  | "Cancelled"
  | "Reversed";

export type DividendWithdrawalMethod = "Cash" | "Online Transfer";

export type DividendWithdrawalInput = {
  withdrawalMethod: DividendWithdrawalMethod;
  withdrawalProvider?: string | null;
  withdrawalAccountName?: string | null;
  withdrawalAccountNumber?: string | null;
  withdrawalQrCode?: string | null;
};

export type DividendCompletionInput = {
  referenceNumber?: string;
  notes?: string | null;
  withdrawalReceipt?: string | null;
  withdrawalReceiptName?: string | null;
};

export type MemberDividend = {
  id: string;
  declarationId: string;
  declarationName: string;
  declarationStatus: "Draft" | "Approved" | "Published" | "Cancelled";
  coverageStart: Date;
  coverageEnd: Date;
  declaredAt: Date | null;
  distributionDate: Date | null;
  amount: number;
  status: DividendStatus;
  decision: "Withdraw" | "Add to Share Capital" | null;
  withdrawalMethod: DividendWithdrawalMethod | null;
  withdrawalProvider: string | null;
  withdrawalAccountName: string | null;
  withdrawalAccountNumber: string | null;
  withdrawalQrCode: string | null;
  withdrawalReceipt: string | null;
  withdrawalReceiptName: string | null;
  decidedAt: Date | null;
  processedAt: Date | null;
  capitalTransactionId: string | null;
  withdrawalReference: string | null;
  createdAt: Date;
};

export type DividendDeclaration = {
  id: string;
  name: string;
  coverageStart: Date;
  coverageEnd: Date;
  declaredAt: Date | null;
  availableAt: Date | null;
  totalDeclaredAmount: number;
  calculationMethod: string;
  netSurplus: number | null;
  statutoryReserves: number | null;
  interestAllocationRate: number | null;
  totalAverageShareMonth: number | null;
  interestRate: number | null;
  status: "Draft" | "Approved" | "Published" | "Cancelled";
  notes: string | null;
  memberCount: number;
  availableCount: number;
  capitalizedCount: number;
  withdrawalRequestedCount: number;
  capitalizationRequestedCount: number;
  withdrawnCount: number;
  createdAt: Date;
};

export type CreateDividendDeclarationInput = {
  name: string;
  coverageStart: string;
  coverageEnd: string;
  availableAt: string;
  netSurplus: number;
  statutoryReserves: number;
  interestAllocationRate: number;
  notes?: string | null;
};

export type DividendPreviewInput = Pick<
  CreateDividendDeclarationInput,
  "coverageStart" | "coverageEnd" | "netSurplus" | "statutoryReserves" | "interestAllocationRate"
>;

export type DividendFinancialBasis = {
  coverageStart: string;
  coverageEnd: string;
  incomeTotal: number;
  expenseTotal: number;
  adjustmentTotal: number;
  netSurplus: number;
  postedRecordCount: number;
  unpostedRecordCount: number;
};

export type DividendAllocationPreview = {
  memberId: string;
  memberCode: string;
  memberName: string;
  membershipType: "Associate" | "True Member";
  totalShareMonths: number;
  averageShareMonth: number;
  dividendAmount: number;
};

export type DividendDeclarationPreview = {
  calculationMethod: string;
  netSurplus: number;
  statutoryReserves: number;
  distributableSurplus: number;
  interestAllocationRate: number;
  totalAverageShareMonth: number;
  interestRate: number;
  interestAllocationAmount: number;
  qualifiedMemberCount: number;
  dividendPool: number;
  qualifiedMembers: DividendAllocationPreview[];
};

export type DividendDeclarationMember = {
  memberId: string;
  memberCode: string;
  memberName: string;
  membershipType: "Associate" | "True Member";
  totalShareMonths: number;
  averageShareMonth: number;
  dividendAmount: number;
  status: DividendStatus;
  decision: "Withdraw" | "Add to Share Capital" | null;
};

export type DividendActionRequest = MemberDividend & {
  memberId: string;
  memberCode: string;
  memberName: string;
};

export type DividendWithdrawalRequest = DividendActionRequest;
