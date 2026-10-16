"use client";

import { ApiClientError, apiPaginatedRequest, apiRequest } from "@/lib/api-client";
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
export type DividendDeclaration = {
  id: string;
  name: string;
  coverageStart: string;
  coverageEnd: string;
  declaredAt: string | null;
  availableAt: string | null;
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
  createdAt: string;
};
export type DividendActionRequest = {
  id: string;
  declarationId: string;
  declarationName: string;
  memberId: string;
  memberCode: string;
  memberName: string;
  coverageStart: string;
  coverageEnd: string;
  declaredAt: string | null;
  distributionDate: string | null;
  amount: number;
  status: "Withdrawal Requested" | "Capitalization Requested" | "Withdrawn" | "Added to Share Capital";
  decision: "Withdraw" | "Add to Share Capital";
  withdrawalMethod: "Cash" | "Online Transfer" | null;
  withdrawalProvider: string | null;
  withdrawalAccountName: string | null;
  withdrawalAccountNumber: string | null;
  withdrawalQrCode: string | null;
  withdrawalReceipt: string | null;
  withdrawalReceiptName: string | null;
  decidedAt: string | null;
  processedAt: string | null;
  capitalTransactionId: null;
  withdrawalReference: string | null;
  createdAt: string;
};
export type DividendWithdrawalRequest = DividendActionRequest;
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
export type DividendDeclarationMember = {
  memberId: string;
  memberCode: string;
  memberName: string;
  membershipType: "Associate" | "True Member";
  totalShareMonths: number;
  averageShareMonth: number;
  dividendAmount: number;
  status: "Pending" | "Available" | "Withdrawal Requested" | "Capitalization Requested" | "Withdrawn" | "Added to Share Capital" | "Cancelled" | "Reversed";
  decision: "Withdraw" | "Add to Share Capital" | null;
};
export type PaymentReferenceListItem = PaymentReference & {
  memberCode: string | null; memberName: string | null;
  applicationCode: string | null; applicationName: string | null;
  failedGatewayEvents: number;
  rentalNumber: string | null; rentalEquipmentName: string | null;
  rentalStartAt: string | null; rentalEndAt: string | null;
  rentalQuantity: string | null; rentalUnit: string | null; posItemQuantity: number | null;
};
export type PaymentReferencePage = {
  items: PaymentReferenceListItem[]; total: number; page: number; pageSize: number;
};
export type PaymentReferenceSummary = {
  total: number; pendingTotal: number; pendingManual: number; needsClarification: number;
  validatedToday: number; validatedTotal: number; paymongoTestPayments: number; rejected: number; reversed: number;
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
  rentalNumber: string | null; rentalEquipmentName: string | null;
  rentalStartAt: string | null; rentalEndAt: string | null;
  rentalQuantity: string | null; rentalUnit: string | null; posItemQuantity: number | null;
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
export type ShareCapitalPayment = { id: string; memberCode: string; memberName: string; amount: number; paymentDate: string; paymentStatus: "Pending" | "Validated" | "Rejected" | "Reversed"; paymentChannel?: string | null; referenceNumber?: string | null };
export type ShareCapitalSummary = { validatedTotal: number; pendingTotal: number; validatedPayments: number; membersWithValidatedCapital: number; initialRequirement: number; fullRequirement: number; maximumAllowed: number };
export type ShareCapitalAccount = {
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
  updatedAt: string;
};
export type ShareCapitalLedgerTransaction = {
  id: string;
  memberId: string;
  memberCode: string;
  memberName: string;
  membershipType: "Associate" | "True Member";
  transactionDate: string;
  transactionType: "Initial Share Capital" | "Additional Capital Contribution" | "Dividend Added to Share Capital" | "Capital Adjustment Credit" | "Capital Adjustment Debit" | "Reversal";
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
export type ShareCapitalLedgerFilters = {
  page?: number;
  pageSize?: number;
  search?: string;
  memberId?: string;
  direction?: "Credit" | "Debit";
  status?: "Posted" | "Reversed";
};
export type CreatePaymentReferenceInput = {
  memberId?: string | null;
  payerName?: string | null;
  payerEmail?: string | null;
  payerContact?: string | null;
  provider?: string;
  paymentChannel?: PaymentReference["paymentChannel"];
  referenceNumber: string;
  paymentPurpose: PaymentReference["paymentPurpose"];
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
  amount: number;
  notes?: string | null;
};
export type FinancialCategory = { id: string; categoryCode: string; categoryName: string; categoryType: "Income" | "Expense" | "Both"; isActive: boolean };
export type FinancialRecord = { id: string; recordNumber: string; categoryName: string; recordType: "Income" | "Expense" | "Adjustment"; amount: number; recordDate: string; recordStatus: "Active" | "Corrected" | "Reversed" | "Voided"; approvedBy: string | null };
export type FinancialSummary = { incomeTotal: number; expenseTotal: number; adjustmentTotal: number; netTotal: number; activeRecords: number; voidedRecords: number };
export type OperatingExpenseType = "Salaries" | "Fuel" | "Electricity" | "Repairs" | "Office expenses" | "Insurance" | "Other";
export const operatingExpenseTypes: OperatingExpenseType[] = ["Salaries", "Fuel", "Electricity", "Repairs", "Office expenses", "Insurance", "Other"];
export type OperatingExpenseRecord = {
  id: string; recordNumber: string; expenseType: OperatingExpenseType; categoryCode: string;
  categoryName: string; amount: number; expenseDate: string; remarks: string | null;
  recordedBy: string; approvedBy: string | null; createdAt: string;
};
export type OperatingExpenseSummary = {
  items: OperatingExpenseRecord[];
  byType: Array<{ expenseType: OperatingExpenseType; total: number; count: number }>;
  total: number; count: number; startDate: string | null; endDate: string | null;
};
export type OperatingExpenseFilters = { startDate?: string; endDate?: string };
export type CreateOperatingExpenseInput = {
  expenseType: OperatingExpenseType;
  otherDescription?: string | null;
  amount: number;
  expenseDate: string;
  remarks?: string | null;
};
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
export const createPaymentReference = (input: CreatePaymentReferenceInput) => apiRequest<PaymentReference>("/api/payment-references", { method: "POST", body: JSON.stringify(input) });
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
export function listShareCapital(search?: string, paymentStatus?: ShareCapitalPayment["paymentStatus"]) { const params = new URLSearchParams({ pageSize: "50", sortBy: "createdAt", sortDirection: "desc" }); if (search?.trim()) params.set("search", search.trim()); if (paymentStatus) params.set("paymentStatus", paymentStatus); return apiRequest<ShareCapitalPayment[]>(`/api/share-capital?${params}`); }
export const getShareCapitalSummary = () => apiRequest<ShareCapitalSummary>("/api/share-capital/summary");
export function listShareCapitalAccounts(search?: string, page = 1, pageSize = 25) {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (search?.trim()) params.set("search", search.trim());
  return apiPaginatedRequest<ShareCapitalAccount[]>(`/api/share-capital/accounts?${params}`);
}
export function listShareCapitalLedgerTransactions(filters: ShareCapitalLedgerFilters = {}) {
  const params = new URLSearchParams({ page: String(filters.page ?? 1), pageSize: String(filters.pageSize ?? 25) });
  if (filters.search?.trim()) params.set("search", filters.search.trim());
  if (filters.memberId) params.set("memberId", filters.memberId);
  if (filters.direction) params.set("direction", filters.direction);
  if (filters.status) params.set("status", filters.status);
  return apiPaginatedRequest<ShareCapitalLedgerTransaction[]>(`/api/share-capital/transactions?${params}`);
}
export const listDividendDeclarations = () => apiRequest<DividendDeclaration[]>("/api/dividends/declarations");
export const getDividendFinancialBasis = (coverageStart: string, coverageEnd: string) => {
  const query = new URLSearchParams({ coverageStart, coverageEnd });
  return apiRequest<DividendFinancialBasis>(`/api/dividends/financial-basis?${query}`);
};
export const previewDividendDeclaration = (input: { coverageStart: string; coverageEnd: string; netSurplus: number; statutoryReserves: number; interestAllocationRate: number }) => apiRequest<DividendDeclarationPreview>("/api/dividends/declarations/preview", { method: "POST", body: JSON.stringify(input) });
export const listDividendDeclarationMembers = (declarationId: string) => apiRequest<DividendDeclarationMember[]>(`/api/dividends/declarations/${encodeURIComponent(declarationId)}/members`);
export const createDividendDeclaration = (input: { name: string; coverageStart: string; coverageEnd: string; availableAt: string; netSurplus: number; statutoryReserves: number; interestAllocationRate: number; notes?: string | null }) => apiRequest<DividendDeclaration>("/api/dividends/declarations", { method: "POST", body: JSON.stringify(input) });
export const approveDividendDeclaration = (id: string) => apiRequest<DividendDeclaration>(`/api/dividends/declarations/${encodeURIComponent(id)}/approve`, { method: "POST", body: JSON.stringify({}) });
export const rejectDividendDeclaration = (id: string) => apiRequest<DividendDeclaration>(`/api/dividends/declarations/${encodeURIComponent(id)}/reject`, { method: "POST", body: JSON.stringify({}) });
export const publishDividendDeclaration = (id: string) => apiRequest<DividendDeclaration>(`/api/dividends/declarations/${encodeURIComponent(id)}/publish`, { method: "POST", body: JSON.stringify({}) });
export const listDividendActionRequests = () => apiRequest<DividendActionRequest[]>("/api/dividends/withdrawals");
export const listDividendActionHistory = () => apiRequest<DividendActionRequest[]>("/api/dividends/withdrawals/history");
export const completeDividendAction = (id: string, input: { referenceNumber?: string; notes?: string | null; withdrawalReceipt?: string | null; withdrawalReceiptName?: string | null }) => apiRequest(`/api/dividends/withdrawals/${encodeURIComponent(id)}/complete`, { method: "POST", body: JSON.stringify(input) });
export const listDividendWithdrawalRequests = listDividendActionRequests;
export const completeDividendWithdrawal = completeDividendAction;
export const listFinancialCategories = () => apiRequest<FinancialCategory[]>("/api/financial-categories");
export function listFinancialRecords(search?: string) { const params = new URLSearchParams({ pageSize: "50", sortBy: "createdAt", sortDirection: "desc" }); if (search?.trim()) params.set("search", search.trim()); return apiRequest<FinancialRecord[]>(`/api/financial-records?${params}`); }
export const getFinancialSummary = () => apiRequest<FinancialSummary>("/api/financial-records/summary");
function operatingExpenseQuery(filters: OperatingExpenseFilters = {}) {
  const params = new URLSearchParams();
  if (filters.startDate) params.set("startDate", filters.startDate);
  if (filters.endDate) params.set("endDate", filters.endDate);
  return params.toString();
}
export function listOperatingExpenses(filters: OperatingExpenseFilters = {}) {
  const query = operatingExpenseQuery(filters);
  return apiRequest<OperatingExpenseSummary>(`/api/operating-expenses${query ? `?${query}` : ""}`);
}
export function createOperatingExpense(input: CreateOperatingExpenseInput) {
  return apiRequest<OperatingExpenseRecord>("/api/operating-expenses", { method: "POST", body: JSON.stringify(input) });
}
export async function getOperatingExpenseReport(filters: OperatingExpenseFilters = {}) {
  const query = operatingExpenseQuery(filters);
  const response = await fetch(`${env.apiUrl}/api/operating-expenses/report${query ? `?${query}` : ""}`, {
    credentials: "include",
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { message?: string } | null;
    throw new ApiClientError(payload?.message ?? "The operating expense report could not be downloaded.", response.status);
  }
  const disposition = response.headers.get("Content-Disposition") ?? "";
  const quoted = /filename="([^"]+)"/.exec(disposition)?.[1];
  return {
    blob: await response.blob(),
    fileName: quoted ?? `trackcoop-operating-expenses-${new Date().toISOString().slice(0, 10)}.pdf`,
  };
}
