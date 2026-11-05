import { AppError } from "../../utils/app-error";

export const PATRONAGE_POLICY = "Rental3PercentAnnual";
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
  if (policy !== PATRONAGE_POLICY) throw new AppError("This is a legacy allocation. Review it against the annual 3% rental-only policy before any further payment or transfer. Existing paid records have been preserved.", 409, "PATRONAGE_LEGACY_REVIEW_REQUIRED");
}

// Store member refunds independently, rounded to the nearest cent; there is no shared pool to divide.
export function rentalRefund(amount: number) {
  const cents = Math.round(Math.max(0, Number(amount) || 0) * 100);
  return Math.round(cents * PATRONAGE_RATE / 100) / 100;
}
