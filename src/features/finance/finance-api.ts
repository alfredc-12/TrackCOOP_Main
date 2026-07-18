"use client";

import { apiRequest } from "@/lib/api-client";

export type ValidationStatus =
  | "Pending"
  | "Validated"
  | "Rejected"
  | "Needs Clarification";

export type PaymentReference = {
  id: string;
  payerName: string | null;
  provider: string;
  referenceNumber: string;
  paymentPurpose: string;
  amount: number;
  validationStatus: ValidationStatus;
  submittedAt: string;
};

export type ShareCapitalPayment = {
  id: string;
  memberCode: string;
  memberName: string;
  amount: number;
  paymentDate: string;
  paymentStatus: "Pending" | "Validated" | "Rejected" | "Reversed";
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

export type FinancialCategory = {
  id: string;
  categoryCode: string;
  categoryName: string;
  categoryType: "Income" | "Expense" | "Both";
  isActive: boolean;
};

export type FinancialRecord = {
  id: string;
  recordNumber: string;
  categoryName: string;
  recordType: "Income" | "Expense" | "Adjustment";
  amount: number;
  recordDate: string;
  recordStatus: "Active" | "Corrected" | "Reversed" | "Voided";
  approvedBy: string | null;
};

export type FinancialSummary = {
  incomeTotal: number;
  expenseTotal: number;
  adjustmentTotal: number;
  netTotal: number;
  activeRecords: number;
  voidedRecords: number;
};

export function listPaymentReferences(search?: string) {
  const params = new URLSearchParams({
    pageSize: "50",
    sortBy: "submittedAt",
    sortDirection: "desc",
  });
  if (search?.trim()) params.set("search", search.trim());
  return apiRequest<PaymentReference[]>(`/api/payment-references?${params}`);
}

export function listShareCapital(search?: string) {
  const params = new URLSearchParams({
    pageSize: "50",
    sortBy: "paymentDate",
    sortDirection: "desc",
  });
  if (search?.trim()) params.set("search", search.trim());
  return apiRequest<ShareCapitalPayment[]>(`/api/share-capital?${params}`);
}

export function getShareCapitalSummary() {
  return apiRequest<ShareCapitalSummary>("/api/share-capital/summary");
}

export function listFinancialCategories() {
  return apiRequest<FinancialCategory[]>("/api/financial-categories");
}

export function listFinancialRecords(search?: string) {
  const params = new URLSearchParams({
    pageSize: "50",
    sortBy: "recordDate",
    sortDirection: "desc",
  });
  if (search?.trim()) params.set("search", search.trim());
  return apiRequest<FinancialRecord[]>(`/api/financial-records?${params}`);
}

export function getFinancialSummary() {
  return apiRequest<FinancialSummary>("/api/financial-records/summary");
}
