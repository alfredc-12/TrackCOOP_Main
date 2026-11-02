/**
 * Decimal-safe money helpers. Amounts are DECIMAL(12,2) in MySQL; they are summed as integer cents so no
 * floating-point drift reaches a total, a share or a reconciliation check.
 */
export function toCents(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return 0;
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? Math.round(number * 100) : 0;
}

export function fromCents(cents: number) {
  return Math.round(cents) / 100;
}

/** Percentage rounded to two decimals, or null when the denominator is not positive. */
export function percentOf(part: number, whole: number) {
  return whole > 0 ? Math.round((part * 10_000) / whole) / 100 : null;
}

/** Percentage change, or null when there is no positive base to compare with. */
export function percentChange(current: number, previous: number) {
  return previous > 0 ? Math.round(((current - previous) * 10_000) / previous) / 100 : null;
}
