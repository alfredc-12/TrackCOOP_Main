import { z } from "zod";
import { AppError } from "../../utils/app-error";
import {
  addDays,
  resolvePeriod,
  resolveComparison,
  manilaToday,
  buildBuckets,
  daysBetween,
  type PeriodPreset,
  type ResolvedPeriod,
} from "../expense-overview/expense-periods";
import {
  cents,
  decimal,
} from "../finance-monitoring/finance-monitoring.schema";
export { cents, decimal, buildBuckets };
export const periods = [
  "today",
  "yesterday",
  "last_7_days",
  "last_30_days",
  "this_month",
  "last_month",
  "this_quarter",
  "this_year",
  "last_year",
  "custom",
  "all_time",
] as const;
export const sources = [
  "Manual",
  "Membership",
  "Payment",
  "Rental",
  "POS",
  "Document",
  "Other",
  "Share Capital",
] as const;
const id = z
  .string()
  .regex(/^\d{1,20}$/)
  .optional();
const amount = z
  .string()
  .regex(/^\d{1,12}(\.\d{1,2})?$/)
  .optional();
export const overviewFilterSchema = z.object({
  period: z.enum(periods).default("this_month"),
  startDate: z.iso.date().optional(),
  endDate: z.iso.date().optional(),
  compare: z.enum(["previous", "last_year", "none"]).default("previous"),
  view: z
    .enum(["posted", "income", "expense", "review", "history", "adjustments"])
    .default("posted"),
  categoryId: id,
  source: z.enum(["", ...sources]).default(""),
  search: z.string().trim().max(190).default(""),
  posting: z.enum(["", "posted", "unposted"]).default(""),
  recordStatus: z
    .enum(["", "Active", "Corrected", "Reversed", "Voided"])
    .default(""),
  amountMin: amount,
  amountMax: amount,
  recordedBy: id,
  approvedBy: id,
  seasonId: id,
  granularity: z.enum(["month", "quarter", "year", "day"]).default("month"),
  sortBy: z
    .enum(["date", "number", "type", "category", "source", "amount", "posting"])
    .default("date"),
  sortDirection: z.enum(["asc", "desc"]).default("desc"),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(10),
  focusCategoryId: id,
  focusSource: z.enum(["", ...sources]).default(""),
  focusStart: z.iso.date().optional(),
  focusEnd: z.iso.date().optional(),
  reviewKind: z
    .enum([
      "",
      "unpostedIncome",
      "unpostedExpense",
      "classification",
      "source",
      "relationships",
    ])
    .default(""),
});
export type OverviewFilters = z.infer<typeof overviewFilterSchema>;
export function periodFor(f: OverviewFilters, now = new Date()) {
  const today = manilaToday(now);
  let period: ResolvedPeriod;
  if (
    f.period === "custom" &&
    (!f.startDate || !f.endDate || f.startDate > f.endDate)
  )
    throw new AppError(
      "Choose both reporting dates in chronological order.",
      422,
      "OVERVIEW_DATE_RANGE",
    );
  if (f.period === "last_30_days")
    period = {
      preset: "custom",
      label: "Last 30 days",
      startDate: addDays(today, -29),
      endDate: today,
    };
  else
    period = resolvePeriod(
      {
        period: f.period as PeriodPreset,
        startDate: f.startDate,
        endDate: f.endDate,
      },
      today,
    );
  if (period.startDate && period.startDate > today)
    throw new AppError(
      "The reporting period has not started.",
      422,
      "OVERVIEW_DATE_RANGE",
    );
  for (const [low, high] of [[f.amountMin, f.amountMax]])
    if (low && high && cents(low) > cents(high))
      throw new AppError(
        "Minimum amount exceeds maximum amount.",
        422,
        "OVERVIEW_AMOUNT_RANGE",
      );
  if (
    Boolean(f.focusStart) !== Boolean(f.focusEnd) ||
    (f.focusStart && f.focusEnd && f.focusStart > f.focusEnd)
  )
    throw new AppError(
      "Choose a complete valid activity period.",
      422,
      "OVERVIEW_DATE_RANGE",
    );
  const comparison = resolveComparison(period, f.compare, today),
    endDate = period.endDate && period.endDate < today ? period.endDate : today;
  if (period.startDate && daysBetween(period.startDate, endDate) > 36525)
    throw new AppError(
      "Reporting range exceeds 100 years.",
      422,
      "OVERVIEW_DATE_RANGE",
    );
  return {
    today,
    preset: f.period,
    label: period.label,
    selected: { startDate: period.startDate, endDate: period.endDate },
    effective: { startDate: period.startDate, endDate },
    previous: comparison.previous,
    partial: comparison.current?.partial ?? false,
    comparisonReason: comparison.unavailableReason,
  };
}
export type OverviewPeriod = ReturnType<typeof periodFor>;
export function signedMoney(value: bigint) {
  const sign = value < BigInt(0) ? "-" : "";
  const absolute = value < BigInt(0) ? -value : value;
  return `${sign}${absolute / BigInt(100)}.${String(absolute % BigInt(100)).padStart(2, "0")}`;
}
export function change(current: string, previous: string | null) {
  if (previous === null) return { amount: null, percent: null };
  const diff = cents(current) - cents(previous),
    base = cents(previous);
  return {
    amount: signedMoney(diff),
    percent:
      base > BigInt(0) ? Number((diff * BigInt(10000)) / base) / 100 : null,
  };
}
