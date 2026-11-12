import { AppError } from "../../utils/app-error";

export const PATRONAGE_POLICY = "RentalSurplusAnnual";
export const CONFIGURED_RENTAL_POLICY = "RentalConfiguredAnnual";
export const FIXED_RENTAL_POLICY = "Rental3PercentAnnual";
export const PATRONAGE_ALLOCATION_RATE = 30;
// Retained only to validate periods saved under the previous policy.
export const PATRONAGE_RATE = 3;

export function patronageToday() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  return ["year", "month", "day"].map((key) => parts.find((part) => part.type === key)?.value).join("-");
}

export function assertAnnualPatronage(startDate: string, endDate: string, closed = false) {
  const year = startDate.slice(0, 4);
  if (!/^\d{4}-01-01$/.test(startDate) || endDate !== `${year}-12-31`) {
    throw new AppError("Patronage refunds must cover January 1 to December 31 of the same year.", 400, "PATRONAGE_ANNUAL_REQUIRED");
  }
  if (closed && endDate >= patronageToday()) {
    throw new AppError("Finish the calendar year before finalizing its yearly refund.", 409, "PATRONAGE_YEAR_NOT_CLOSED");
  }
}

export function assertCurrentPatronagePolicy(policy: string | undefined) {
  if (!isSupportedPatronagePolicy(policy)) throw new AppError("This is a legacy allocation. Review its calculation before any further payment or transfer. Existing paid records have been preserved.", 409, "PATRONAGE_LEGACY_REVIEW_REQUIRED");
}

export function isSupportedPatronagePolicy(policy: string | undefined) {
  return policy === PATRONAGE_POLICY || policy === FIXED_RENTAL_POLICY || policy === CONFIGURED_RENTAL_POLICY;
}

export function surplusRefundPool(netSurplus: number, statutoryReserves: number, allocationRate = PATRONAGE_ALLOCATION_RATE) {
  if (![netSurplus, statutoryReserves, allocationRate].every(Number.isFinite) || netSurplus < 0 || statutoryReserves < 0 || statutoryReserves > netSurplus || allocationRate < 30 || allocationRate > 100) {
    throw new AppError("Enter a non-negative reviewed net surplus, statutory reserves no greater than surplus, and a patronage allocation from 30% to 100%.", 422, "PATRONAGE_FINANCIAL_BASIS_INVALID");
  }
  const availableCents = Math.round(netSurplus * 100) - Math.round(statutoryReserves * 100);
  const basisPoints = Math.round(allocationRate * 100);
  const poolCents = (BigInt(availableCents) * BigInt(basisPoints) + BigInt(5000)) / BigInt(10000);
  return Number(poolCents) / 100;
}

// Apply the saved rental percentage independently and round each member to cents.
export function rentalRefund(amount: number, rate = PATRONAGE_RATE) {
  if (!Number.isFinite(rate) || rate <= 0 || rate > 100) throw new AppError("Review the member rental refund rate.", 422, "PATRONAGE_RATE_INVALID");
  const cents = Math.round(Math.max(0, Number(amount) || 0) * 100);
  return Number((BigInt(cents) * BigInt(Math.round(rate * 100)) + BigInt(5000)) / BigInt(10000)) / 100;
}
