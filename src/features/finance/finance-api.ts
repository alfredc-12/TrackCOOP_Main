"use client";

import { apiRequest } from "@/lib/api-client";
import { env } from "@/config/env";

export type ValidationStatus =
  | "Pending"
  | "Validated"
  | "Rejected"
  | "Needs Clarification"
  | "Reversed";

export type PaymentReference = {
  id: string;
  memberId: string | null;
  submittedBy: string | null;
  payerName: string | null;
  payerEmail: string | null;
  payerContact: string | null;
  provider: string;
  referenceNumber: string;
  paymentPurpose: string;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  amount: number;
  proofFilePath: string | null;
  validationStatus: ValidationStatus;
  paymentChannel: "PayMongo" | "Manual GCash" | "Cash" | "Bank Transfer" | "Other";
  gatewayEnvironment: "Test" | "Live" | "Manual";
  gatewayCheckoutId: string | null;
  gatewayPaymentId: string | null;
  gatewayPaymentIntentId: string | null;
  gatewayStatus: string | null;
  gatewayPaymentMethod: string | null;
  gatewayFeeAmount: number | null;
  gatewayNetAmount: number | null;
  paidAt: string | null;
  webhookReceivedAt: string | null;
  validationSource: "Manual Bookkeeper" | "PayMongo Webhook" | "System" | null;
  validatedBy: string | null;
  validatedAt: string | null;
  rejectionReason: string | null;
  notes: string | null;
  submittedAt: string;
  updatedAt: string;
};

export type PaymentReferenceSummary = {
  total: number;
  pendingManual: number;
  needsClarification: number;
  validatedToday: number;
  paymongoTestPayments: number;
  rejected: number;
  validatedAmount: number;
};

export type PaymentReferenceDetail = PaymentReference & {
  memberCode: string | null;
  memberName: string | null;
  submittedByName: string | null;
  validatedByName: string | null;
  validationHistory: Array<{
    id: string;
    oldStatus: ValidationStatus | null;
    newStatus: ValidationStatus;
    validationSource: "Manual Bookkeeper" | "PayMongo Webhook" | "System";
    reason: string | null;
    changedBy: string | null;
    changedByName: string | null;
    gatewayEventId: string | null;
    changedAt: string;
  }>;
  gatewayEvents: Array<{
    id: string;
    eventType: string;
    checkoutId: string | null;
    paymentId: string | null;
    paymentIntentId: string | null;
    livemode: boolean;
    payloadHash: string;
    processingStatus: "Received" | "Processed" | "Ignored" | "Failed";
    errorCode: string | null;
    errorMessage: string | null;
    receivedAt: string;
    processedAt: string | null;
  }>;
  posting: {
    financialRecordId: string | null;
    financialRecordNumber: string | null;
    financialRecordStatus: "Active" | "Corrected" | "Reversed" | "Voided" | null;
    shareCapitalPaymentId: string | null;
    shareCapitalStatus: "Pending" | "Validated" | "Rejected" | "Reversed" | null;
    membershipRequirementId: string | null;
    membershipRequirementStatus: "Pending" | "Submitted" | "Verified" | "Rejected" | "Waived" | null;
    membershipApplicationStatus: string | null;
    warnings: string[];
  };
};

export type PaymongoPaymentStatus = {
  paymentReferenceId: string;
  referenceNumber: string;
  validationStatus: ValidationStatus;
  paymentChannel: PaymentReference["paymentChannel"];
  gatewayEnvironment: PaymentReference["gatewayEnvironment"];
  gatewayCheckoutId: string | null;
  gatewayPaymentId: string | null;
  gatewayPaymentIntentId: string | null;
  gatewayStatus: string | null;
  paidAt: string | null;
  amount: number;
  currency: "PHP";
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

export type PaymentReferenceFilters = {
  search?: string;
  validationStatus?: string;
  paymentPurpose?: string;
  paymentChannel?: string;
  validationSource?: string;
  gatewayManual?: "all" | "gateway" | "manual";
  dateFrom?: string;
  dateTo?: string;
  amountMin?: string;
  amountMax?: string;
  sortBy?: "submittedAt" | "amount" | "referenceNumber" | "paidAt";
  sortDirection?: "asc" | "desc";
};

export function listPaymentReferences(filters: PaymentReferenceFilters = {}) {
  const params = new URLSearchParams({
    pageSize: "50",
    sortBy: filters.sortBy ?? "submittedAt",
    sortDirection: filters.sortDirection ?? "desc",
  });
  if (filters.search?.trim()) params.set("search", filters.search.trim());
  if (filters.validationStatus) params.set("validationStatus", filters.validationStatus);
  if (filters.paymentPurpose) params.set("paymentPurpose", filters.paymentPurpose);
  if (filters.paymentChannel) params.set("paymentChannel", filters.paymentChannel);
  if (filters.validationSource) params.set("validationSource", filters.validationSource);
  if (filters.gatewayManual === "gateway") params.set("gatewayOnly", "true");
  if (filters.gatewayManual === "manual") params.set("manualOnly", "true");
  if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
  if (filters.dateTo) params.set("dateTo", filters.dateTo);
  if (filters.amountMin) params.set("amountMin", filters.amountMin);
  if (filters.amountMax) params.set("amountMax", filters.amountMax);
  return apiRequest<PaymentReference[]>(`/api/payment-references?${params}`);
}

export function getPaymentReferenceSummary() {
  return apiRequest<PaymentReferenceSummary>("/api/payment-references/summary");
}

export function getPaymentReferenceDetail(paymentReferenceId: string) {
  return apiRequest<PaymentReferenceDetail>(`/api/payment-references/${paymentReferenceId}`);
}

export function validatePaymentReference(paymentReferenceId: string) {
  return apiRequest<PaymentReference>(`/api/payment-references/${paymentReferenceId}/validate`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function rejectPaymentReference(paymentReferenceId: string, reason: string) {
  return apiRequest<PaymentReference>(`/api/payment-references/${paymentReferenceId}/reject`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export function requestPaymentClarification(paymentReferenceId: string, reason: string) {
  return apiRequest<PaymentReference>(`/api/payment-references/${paymentReferenceId}/request-clarification`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export function reversePaymentReference(paymentReferenceId: string, reason: string, confirmation: string) {
  return apiRequest<PaymentReferenceDetail>(`/api/payment-references/${paymentReferenceId}/reverse`, {
    method: "POST",
    body: JSON.stringify({ reason, confirmation }),
  });
}

export function updatePaymentReference(paymentReferenceId: string, input: Partial<PaymentReference>) {
  return apiRequest<PaymentReference>(`/api/payment-references/${paymentReferenceId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function getPaymongoPaymentStatus(paymentReferenceId: string) {
  return apiRequest<PaymongoPaymentStatus>(`/api/paymongo/payments/${paymentReferenceId}/status`);
}

export function paymentReferenceProofUrl(paymentReferenceId: string) {
  return `${env.apiUrl}/api/payment-references/${paymentReferenceId}/proof`;
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

export interface CreateShareCapitalInput {
  memberId: string;
  amount: number;
  paymentDate: string;
  paymentStatus: "Pending" | "Validated" | "Rejected" | "Reversed";
  remarks?: string | null;
}

export function createShareCapital(input: CreateShareCapitalInput) {
  return apiRequest<ShareCapitalPayment>("/api/share-capital", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
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
