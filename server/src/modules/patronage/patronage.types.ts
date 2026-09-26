export type PatronagePeriodStatus = "Draft" | "Finalized" | "Paid";
export type PatronagePaymentStatus = "Pending" | "Paid";

export type PatronageSourceAmount = {
  memberId: string;
  memberCode: string;
  memberName: string;
  membershipType: "Associate" | "True Member";
  purchasePatronage: number;
  rentalPatronage: number;
};

export type PatronageAllocation = PatronageSourceAmount & {
  id: string;
  periodId: string;
  totalPatronage: number;
  patronageSharePercent: number;
  refundAmount: number;
  paymentStatus: PatronagePaymentStatus;
  paidAt: Date | null;
  paymentNotes: string | null;
};

export type PatronagePeriod = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  refundPool: number;
  status: PatronagePeriodStatus;
  notes: string | null;
  finalizedAt: Date | null;
  paidAt: Date | null;
  createdAt: Date;
  totalPatronage: number;
  purchasePatronage: number;
  rentalPatronage: number;
  allocatedRefund: number;
  memberCount: number;
  paidCount: number;
};

export type CreatePatronagePeriodInput = {
  name: string;
  startDate: string;
  endDate: string;
  refundPool: number;
  notes?: string | null;
};

export type PatronageFinancialBasis = {
  startDate: string;
  endDate: string;
  posIncome: number;
  rentalIncome: number;
  totalOperatingIncome: number;
  posExpenses: number;
  rentalExpenses: number;
  otherExpenses: number;
  totalOperatingExpenses: number;
  adjustments: number;
  netOperatingSurplus: number;
  postedRecordCount: number;
  unpostedRecordCount: number;
};

export type PatronageMemberSummary = {
  member: {
    code: string;
    name: string;
    membershipType: "Associate" | "True Member";
  };
  currentYear: {
    startDate: string;
    endDate: string;
    purchasePatronage: number;
    rentalPatronage: number;
    totalPatronage: number;
  };
  refunds: {
    allocatedTotal: number;
    paidTotal: number;
    pendingTotal: number;
  };
  history: Array<{
    periodId: string;
    periodName: string;
    startDate: string;
    endDate: string;
    periodStatus: PatronagePeriodStatus;
    totalPatronage: number;
    refundAmount: number;
    paymentStatus: PatronagePaymentStatus;
    paidAt: Date | null;
  }>;
};
