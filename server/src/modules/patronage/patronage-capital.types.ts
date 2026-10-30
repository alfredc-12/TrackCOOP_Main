export type PatronageCapitalTransfer = {
  id: string;
  allocationId: string;
  memberId: string;
  memberName: string;
  memberCode: string;
  periodName: string;
  amount: number;
  status: "Pending" | "Approved" | "Rejected";
  requestedAt: Date;
  processedAt: Date | null;
  notes: string | null;
  capitalTransactionId: string | null;
};

export type PatronageCapitalOverview = {
  currentCapital: number;
  availableCapacity: number;
  refunds: Array<{ allocationId: string; periodName: string; availableAmount: number }>;
  transfers: PatronageCapitalTransfer[];
};

export type PatronageCapitalRequest = { allocationId: string; amount: number; requestKey: string };
export type PatronageCapitalDecision = { decision: "Approve" | "Reject"; notes?: string | null };
