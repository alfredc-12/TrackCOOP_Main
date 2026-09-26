"use client";

import { apiRequest } from "@/lib/api-client";

export type PatronagePeriodStatus = "Draft" | "Finalized" | "Paid";
export type PatronagePaymentStatus = "Pending" | "Paid";

export type PatronagePeriod = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  refundPool: number;
  status: PatronagePeriodStatus;
  notes: string | null;
  finalizedAt: string | null;
  paidAt: string | null;
  createdAt: string;
  totalPatronage: number;
  purchasePatronage: number;
  rentalPatronage: number;
  allocatedRefund: number;
  memberCount: number;
  paidCount: number;
};

export type PatronageAllocation = {
  id: string;
  periodId: string;
  memberId: string;
  memberCode: string;
  memberName: string;
  membershipType: "Associate" | "True Member";
  purchasePatronage: number;
  rentalPatronage: number;
  totalPatronage: number;
  patronageSharePercent: number;
  refundAmount: number;
  paymentStatus: PatronagePaymentStatus;
  paidAt: string | null;
  paymentNotes: string | null;
};

export type PatronageOverview = {
  periods: PatronagePeriod[];
  selectedPeriod: PatronagePeriod | null;
  allocations: PatronageAllocation[];
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

export type MemberPatronageSummary = {
  member: { code: string; name: string; membershipType: "Associate" | "True Member" };
  currentYear: { startDate: string; endDate: string; purchasePatronage: number; rentalPatronage: number; totalPatronage: number };
  refunds: { allocatedTotal: number; paidTotal: number; pendingTotal: number };
  history: Array<{
    periodId: string;
    periodName: string;
    startDate: string;
    endDate: string;
    periodStatus: PatronagePeriodStatus;
    totalPatronage: number;
    refundAmount: number;
    paymentStatus: PatronagePaymentStatus;
    paidAt: string | null;
  }>;
};

export function getPatronageOverview(periodId?: string) {
  const query = periodId ? `?periodId=${encodeURIComponent(periodId)}` : "";
  return apiRequest<PatronageOverview>(`/api/patronage${query}`);
}

export function getPatronageFinancialBasis(startDate: string, endDate: string) {
  const query = new URLSearchParams({ startDate, endDate });
  return apiRequest<PatronageFinancialBasis>(`/api/patronage/financial-basis?${query}`);
}

export function createPatronagePeriod(input: { name: string; startDate: string; endDate: string; refundPool: number; notes?: string | null }) {
  return apiRequest<PatronagePeriod>("/api/patronage/periods", { method: "POST", body: JSON.stringify(input) });
}

export function recalculatePatronagePeriod(id: string) {
  return apiRequest<PatronagePeriod>(`/api/patronage/periods/${id}/recalculate`, { method: "POST", body: JSON.stringify({}) });
}

export function finalizePatronagePeriod(id: string) {
  return apiRequest<PatronagePeriod>(`/api/patronage/periods/${id}/finalize`, { method: "POST", body: JSON.stringify({}) });
}

export function markPatronageRefundPaid(id: string, notes?: string) {
  return apiRequest<PatronageAllocation>(`/api/patronage/allocations/${id}/paid`, { method: "POST", body: JSON.stringify({ notes: notes || null }) });
}

export function getMemberPatronage() {
  return apiRequest<MemberPatronageSummary>("/api/members/me/patronage");
}
