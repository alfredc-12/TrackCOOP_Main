import { AppError } from "../../utils/app-error";

export function moneyCents(value: number | string) {
  return Math.round(Number(value) * 100);
}

export function availablePatronageRefund(input: {
  refundAmount: number | string;
  paymentStatus: string;
  capitalizedAmount: number | string;
  pendingCapitalAmount: number | string;
}) {
  if (input.paymentStatus === "Paid") return 0;
  return Math.max(0, moneyCents(input.refundAmount) - moneyCents(input.capitalizedAmount) - moneyCents(input.pendingCapitalAmount)) / 100;
}

export function assertPatronageCapitalAmount(amount: number, availableRefund: number, availableCapacity: number) {
  if (!Number.isFinite(amount) || amount <= 0 || Math.abs(amount * 100 - moneyCents(amount)) > 0.000001) {
    throw new AppError("Enter a positive amount with no more than two decimal places.", 422, "PATRONAGE_CAPITAL_AMOUNT_INVALID");
  }
  if (moneyCents(amount) > moneyCents(availableRefund)) {
    throw new AppError("This amount is no longer available from your patronage refund.", 409, "PATRONAGE_REFUND_UNAVAILABLE");
  }
  if (moneyCents(amount) > moneyCents(availableCapacity)) {
    throw new AppError("This amount would exceed your Share Capital limit, including pending QRPH payments.", 409, "SHARE_CAPITAL_LIMIT_EXCEEDED");
  }
}
