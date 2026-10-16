import { apiPaginatedRequest, apiRequest } from "@/lib/api-client";
import type {
  MemberShareCapitalCheckout,
  MemberShareCapitalSummary,
  MemberCapitalGrowthPoint,
  MemberCapitalOverview,
  MemberCapitalTransaction,
  MemberDividend,
  DividendWithdrawalMethod,
} from "./types";

export function getMemberShareCapitalSummary() {
  return apiRequest<MemberShareCapitalSummary>(
    "/api/paymongo/members/me/share-capital",
  );
}

export function createMemberShareCapitalCheckout(input: {
  requestedAmount: number;
  clientRequestId: string;
}) {
  return apiRequest<MemberShareCapitalCheckout>(
    "/api/paymongo/checkouts/members/me/share-capital",
    { method: "POST", body: JSON.stringify(input) },
  );
}

export function refreshMemberShareCapitalPayment(paymentReferenceId: string) {
  return apiRequest(
    `/api/paymongo/payments/${encodeURIComponent(paymentReferenceId)}/status`,
  );
}

export function getMemberCapitalOverview() {
  return apiRequest<MemberCapitalOverview>("/api/members/me/share-capital/overview");
}

export type MemberCapitalTransactionFilters = {
  dateFrom?: string;
  dateTo?: string;
  direction?: "Credit" | "Debit";
  status?: "Posted" | "Reversed";
};

export function getMemberCapitalTransactions(
  page = 1,
  pageSize = 10,
  filters: MemberCapitalTransactionFilters = {},
) {
  const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (filters.dateFrom) query.set("dateFrom", filters.dateFrom);
  if (filters.dateTo) query.set("dateTo", filters.dateTo);
  if (filters.direction) query.set("direction", filters.direction);
  if (filters.status) query.set("status", filters.status);
  return apiPaginatedRequest<MemberCapitalTransaction[]>(
    `/api/members/me/share-capital/transactions?${query}`,
  );
}

export function getMemberCapitalGrowth() {
  return apiRequest<MemberCapitalGrowthPoint[]>("/api/members/me/share-capital/growth");
}

export function getMemberDividends() {
  return apiRequest<MemberDividend[]>("/api/members/me/dividends");
}

export function addDividendToShareCapital(dividendId: string) {
  return apiRequest<MemberDividend>(
    `/api/members/me/dividends/${encodeURIComponent(dividendId)}/add-to-capital`,
    { method: "POST", body: JSON.stringify({}) },
  );
}

export const requestDividendCapitalization = addDividendToShareCapital;

export function requestDividendWithdrawal(
  dividendId: string,
  input: {
    withdrawalMethod: DividendWithdrawalMethod;
    withdrawalProvider?: string | null;
    withdrawalAccountName?: string | null;
    withdrawalAccountNumber?: string | null;
    withdrawalQrCode?: string | null;
  } = { withdrawalMethod: "Cash" },
) {
  return apiRequest<MemberDividend>(
    `/api/members/me/dividends/${encodeURIComponent(dividendId)}/request-withdrawal`,
    { method: "POST", body: JSON.stringify(input) },
  );
}
