import { apiRequest } from "@/lib/api-client";
import type {
  MemberShareCapitalCheckout,
  MemberShareCapitalSummary,
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
