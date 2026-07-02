import { listPayments } from "./repository";

export function getPaymentSummary() {
  const payments = listPayments();
  return {
    payments,
    total: payments.reduce((sum, payment) => sum + payment.amount, 0),
  };
}
