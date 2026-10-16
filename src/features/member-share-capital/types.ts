export type MemberShareCapitalHistoryItem = {
  paymentReferenceId: string;
  referenceNumber: string;
  amount: number;
  validationStatus: "Pending" | "Validated" | "Rejected" | "Needs Clarification" | "Reversed";
  gatewayStatus: string | null;
  submittedAt: string;
  paidAt: string | null;
  receiptNumber: string | null;
};

export type MemberShareCapitalSummary = {
  memberId: string;
  memberCode: string;
  membershipType: "Associate" | "True Member";
  officialMemberStatus: string;
  validatedCapital: number;
  activePendingCapital: number;
  remainingToTrueMember: number;
  maximumShareCapital: number;
  availableCapacity: number;
  mode: "test" | "live";
  eligible: boolean;
  activeCheckout: {
    paymentReferenceId: string;
    checkoutId: string | null;
    checkoutUrl: string;
    attemptNumber: number | null;
    gatewayStatus: string | null;
    amount: number;
  } | null;
  history: MemberShareCapitalHistoryItem[];
};

export type MemberShareCapitalCheckout = {
  paymentReferenceId: string;
  referenceNumber: string;
  checkoutId: string;
  checkoutUrl: string;
  gatewayStatus: string | null;
  validationStatus: MemberShareCapitalHistoryItem["validationStatus"];
  amount: number;
  currency: "PHP";
  mode: "test" | "live";
  attemptNumber: number;
  reused: boolean;
};

export type MemberCapitalOverview = {
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
    updatedAt: string | null;
  };
  transactionCount: number;
  reconciliation: {
    expectedBalance: number;
    recordedBalance: number;
    difference: number;
    reconciled: boolean;
  };
};

export type MemberCapitalTransaction = {
  id: string;
  memberId: string;
  transactionDate: string;
  transactionType:
    | "Initial Share Capital"
    | "Additional Capital Contribution"
    | "Dividend Added to Share Capital"
    | "Capital Adjustment Credit"
    | "Capital Adjustment Debit"
    | "Reversal";
  direction: "Credit" | "Debit";
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  referenceNumber: string;
  sourceType: string;
  sourceId: string;
  status: "Posted" | "Reversed";
  remarks: string | null;
  createdAt: string;
};

export type MemberCapitalGrowthPoint = {
  date: string;
  balance: number;
  transactionCount: number;
};

export type MemberDividendStatus =
  | "Pending"
  | "Available"
  | "Withdrawal Requested"
  | "Capitalization Requested"
  | "Withdrawn"
  | "Added to Share Capital"
  | "Cancelled"
  | "Reversed";

export type DividendWithdrawalMethod = "Cash" | "Online Transfer";

export type MemberDividend = {
  id: string;
  declarationId: string;
  declarationName: string;
  declarationStatus: "Draft" | "Approved" | "Published" | "Cancelled";
  coverageStart: string;
  coverageEnd: string;
  declaredAt: string | null;
  distributionDate: string | null;
  amount: number;
  status: MemberDividendStatus;
  decision: "Withdraw" | "Add to Share Capital" | null;
  withdrawalMethod: DividendWithdrawalMethod | null;
  withdrawalProvider: string | null;
  withdrawalAccountName: string | null;
  withdrawalAccountNumber: string | null;
  withdrawalQrCode: string | null;
  withdrawalReceipt: string | null;
  withdrawalReceiptName: string | null;
  decidedAt: string | null;
  processedAt: string | null;
  capitalTransactionId: string | null;
  withdrawalReference: string | null;
  createdAt: string;
};
