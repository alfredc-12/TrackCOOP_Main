import type { Payment } from "./types";

export const payments: Payment[] = [
  { id: "P-9001", memberId: "M-1001", type: "Share capital", amount: 18500, status: "Posted" },
  { id: "P-9002", memberId: "M-1002", type: "Loan amortization", amount: 9700, status: "Pending" },
  { id: "P-9003", memberId: "M-1003", type: "Membership dues", amount: 1200, status: "Review" },
];

export function listPayments() {
  return payments;
}
