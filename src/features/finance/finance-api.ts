"use client";

import { apiRequest } from "@/lib/api-client";
import { env } from "@/config/env";

export type ValidationStatus = "Pending" | "Validated" | "Rejected" | "Needs Clarification" | "Reversed";
export type PaymentReference = {
  id: string; memberId: string | null; submittedBy: string | null;
  payerName: string | null; payerEmail: string | null; payerContact: string | null;
  provider: string; referenceNumber: string; paymentPurpose: string;
  relatedEntityType: string | null; relatedEntityId: string | null; amount: number;
  proofFilePath: string | null; validationStatus: ValidationStatus;
  paymentChannel: "PayMongo" | "Manual GCash" | "Cash" | "Bank Transfer" | "Other";
  gatewayEnvironment: "Test" | "Live" | "Manual";
  gatewayCheckoutId: string | null; gatewayPaymentId: string | null;
  gatewayPaymentIntentId: string | null; gatewayStatus: string | null;
  gatewayPaymentMethod: string | null; gatewayFeeAmount: number | null;
  gatewayNetAmount: number | null; paidAt: string | null; webhookReceivedAt: string | null;
  validationSource: "Manual Bookkeeper" | "PayMongo Webhook" | "System" | null;
  validatedBy: string | null; validatedAt: string | null; rejectionReason: string | null;
  notes: string | null; submittedAt: string; updatedAt: string;
};
export type PaymentReferenceListItem = PaymentReference & {
  memberCode: string | null; memberName: string | null;
  applicationCode: string | null; applicationName: string | null;
  failedGatewayEvents: number;
};
export type PaymentReferencePage = {
  items: PaymentReferenceListItem[]; total: number; page: number; pageSize: number;
};
export type PaymentReferenceSummary = {
  total: number; pendingManual: number; needsClarification: number;
  validatedToday: number; paymongoTestPayments: number; rejected: number;
  validatedAmount: number;
};
export type PaymentGatewayEvent = {
  id: string; eventType: string; checkoutId: string | null; paymentId: string | null;
  paymentIntentId: string | null; livemode: boolean;
  processingStatus: "Received" | "Processing" | "Processed" | "Ignored" | "Failed";
  retryCount: number; signatureVerified: boolean; eligibleForRetry: boolean;
  errorCode: string | null; errorMessage: string | null;
  amount: number | null; currency: string | null; paymentStatus: string | null;
  paymentMethod: string | null; paidAt: string | null; receivedAt: string;
  processedAt: string | null;
};
export type PaymentCheckoutAttempt = {
  id: string; attemptNumber: number; checkoutId: string; gatewayStatus: string | null;
  gatewayEnvironment: "Test" | "Live"; amount: number; currency: "PHP";
  lastCheckedAt: string | null; reusableUntil: string; supersededAt: string | null;
  completedAt: string | null; active: boolean;
};
export type PaymentReceipt = {
  receiptNumber: string; processingStatus: "Pending" | "Processing" | "Generated" | "Failed";
  documentId: string | null; attemptCount: number; lastErrorCode: string | null;
  lastErrorMessage: string | null; generatedAt: string | null; reversedAt: string | null;
  reversalNote: string | null;
} | null;
export type PaymentReferenceDetail = PaymentReference & {
  memberCode: string | null; memberName: string | null;
  applicationCode: string | null; applicationName: string | null;
  submittedByName: string | null; validatedByName: string | null;
  validationHistory: Array<{
    id: string; oldStatus: ValidationStatus | null; newStatus: ValidationStatus;
    validationSource: "Manual Bookkeeper" | "PayMongo Webhook" | "System";
    reason: string | null; changedBy: string | null; changedByName: string | null;
    gatewayEventId: string | null; changedAt: string;
  }>;
  checkoutAttempts: PaymentCheckoutAttempt[]; activeAttemptId: string | null;
  gatewayEvents: PaymentGatewayEvent[]; receipt: PaymentReceipt;
  posting: {
    financialRecordId: string | null; financialRecordNumber: string | null;
    financialRecordStatus: "Active" | "Corrected" | "Reversed" | "Voided" | null;
    shareCapitalPaymentId: string | null;
    shareCapitalStatus: "Pending" | "Validated" | "Rejected" | "Reversed" | null;
    membershipRequirementId: string | null;
    membershipRequirementStatus: "Pending" | "Submitted" | "Verified" | "Rejected" | "Waived" | null;
    membershipApplicationStatus: string | null; warnings: string[];
  };
};
export type PaymongoPaymentStatus = {
  paymentReferenceId: string; referenceNumber: string; validationStatus: ValidationStatus;
  paymentChannel: PaymentReference["paymentChannel"];
  gatewayEnvironment: PaymentReference["gatewayEnvironment"];
  gatewayCheckoutId: string | null; gatewayPaymentId: string | null;
  gatewayPaymentIntentId: string | null; gatewayStatus: string | null;
  paidAt: string | null; amount: number; currency: "PHP";
};
export type GatewayRetryResult = {
  gatewayEventId: string; paymentReferenceId: string; processingStatus: "Processed";
  retryCount: number; alreadyProcessed: boolean;
  receiptStatus: "Pending" | "Processing" | "Generated" | "Failed" | null;
  receiptErrorCode: string | null;
};
export type ShareCapitalPayment = { id: string; memberCode: string; memberName: string; amount: number; paymentDate: string; paymentStatus: "Pending" | "Validated" | "Rejected" | "Reversed" };
export type ShareCapitalSummary = { validatedTotal: number; pendingTotal: number; validatedPayments: number; membersWithValidatedCapital: number; initialRequirement: number; fullRequirement: number; maximumAllowed: number };
export type FinancialCategory = { id: string; categoryCode: string; categoryName: string; categoryType: "Income" | "Expense" | "Both"; isActive: boolean };
export type FinancialRecord = { id: string; recordNumber: string; categoryName: string; recordType: "Income" | "Expense" | "Adjustment"; amount: number; recordDate: string; recordStatus: "Active" | "Corrected" | "Reversed" | "Voided"; approvedBy: string | null };
export type FinancialSummary = { incomeTotal: number; expenseTotal: number; adjustmentTotal: number; netTotal: number; activeRecords: number; voidedRecords: number };
export type PaymentReferenceFilters = {
  search?: string; validationStatus?: string; paymentPurpose?: string; paymentChannel?: string;
  validationSource?: string; gatewayManual?: "all" | "gateway" | "manual";
  failedEvents?: boolean; dateFrom?: string; dateTo?: string;
  amountMin?: string; amountMax?: string; page?: number; pageSize?: number;
  sortBy?: "submittedAt" | "amount" | "referenceNumber" | "paidAt";
  sortDirection?: "asc" | "desc";
};

export function listPaymentReferences(filters: PaymentReferenceFilters = {}) {
  const params = new URLSearchParams({
    page: String(filters.page ?? 1), pageSize: String(filters.pageSize ?? 20),
    sortBy: filters.sortBy ?? "submittedAt", sortDirection: filters.sortDirection ?? "desc",
  });
  if (filters.search?.trim()) params.set("search", filters.search.trim());
  if (filters.validationStatus) params.set("validationStatus", filters.validationStatus);
  if (filters.paymentPurpose) params.set("paymentPurpose", filters.paymentPurpose);
  if (filters.paymentChannel) params.set("paymentChannel", filters.paymentChannel);
  if (filters.validationSource) params.set("validationSource", filters.validationSource);
  if (filters.gatewayManual === "gateway") params.set("gatewayOnly", "true");
  if (filters.gatewayManual === "manual") params.set("manualOnly", "true");
  if (filters.failedEvents) params.set("failedEvents", "true");
  if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
  if (filters.dateTo) params.set("dateTo", filters.dateTo);
  if (filters.amountMin) params.set("amountMin", filters.amountMin);
  if (filters.amountMax) params.set("amountMax", filters.amountMax);
  return apiRequest<PaymentReferencePage>(`/api/payment-references?${params}`);
}
export const getPaymentReferenceSummary = () => apiRequest<PaymentReferenceSummary>("/api/payment-references/summary");
export const getPaymentReferenceDetail = (id: string) => apiRequest<PaymentReferenceDetail>(`/api/payment-references/${id}`);
export const validatePaymentReference = (id: string) => apiRequest<PaymentReference>(`/api/payment-references/${id}/validate`, { method: "POST", body: JSON.stringify({}) });
export const rejectPaymentReference = (id: string, reason: string) => apiRequest<PaymentReference>(`/api/payment-references/${id}/reject`, { method: "POST", body: JSON.stringify({ reason }) });
export const requestPaymentClarification = (id: string, reason: string) => apiRequest<PaymentReference>(`/api/payment-references/${id}/request-clarification`, { method: "POST", body: JSON.stringify({ reason }) });
export const reversePaymentReference = (id: string, reason: string, confirmation: string) => apiRequest<PaymentReferenceDetail>(`/api/payment-references/${id}/reverse`, { method: "POST", body: JSON.stringify({ reason, confirmation }) });
export const updatePaymentReference = (id: string, input: Partial<PaymentReference>) => apiRequest<PaymentReference>(`/api/payment-references/${id}`, { method: "PATCH", body: JSON.stringify(input) });
export const getPaymongoPaymentStatus = (id: string) => apiRequest<PaymongoPaymentStatus>(`/api/paymongo/payments/${id}/status`);
export const retryGatewaySettlement = (eventId: string, note: string) => apiRequest<GatewayRetryResult>(`/api/payment-gateway-events/${eventId}/retry`, { method: "POST", body: JSON.stringify({ note }) });
export const retryPaymentReceipt = (id: string) => apiRequest<PaymentReceipt>(`/api/payment-references/${id}/receipt/retry`, { method: "POST", body: JSON.stringify({}) });
export const paymentReferenceProofUrl = (id: string) => `${env.apiUrl}/api/payment-references/${id}/proof`;
export function listShareCapital(search?: string) { const params = new URLSearchParams({ pageSize: "50", sortBy: "paymentDate", sortDirection: "desc" }); if (search?.trim()) params.set("search", search.trim()); return apiRequest<ShareCapitalPayment[]>(`/api/share-capital?${params}`); }
export const getShareCapitalSummary = () => apiRequest<ShareCapitalSummary>("/api/share-capital/summary");
export const listFinancialCategories = () => apiRequest<FinancialCategory[]>("/api/financial-categories");
export function listFinancialRecords(search?: string) { const params = new URLSearchParams({ pageSize: "50", sortBy: "recordDate", sortDirection: "desc" }); if (search?.trim()) params.set("search", search.trim()); return apiRequest<FinancialRecord[]>(`/api/financial-records?${params}`); }
export const getFinancialSummary = () => apiRequest<FinancialSummary>("/api/financial-records/summary");
