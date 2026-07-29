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
