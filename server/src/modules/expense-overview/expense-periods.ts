/**
 * Reporting-period arithmetic for the Chairman Financial Overview.
 *
 * `financial_records.record_date` is a plain DATE, so every range here is an inclusive pair of
 * `YYYY-MM-DD` strings and no time-zone conversion happens in SQL. "Today" and the presets are read in
 * Asia/Manila (the cooperative's calendar), never in the server's own zone.
 */
export const periodPresets = [
  "today",
  "yesterday",
  "this_week",
  "last_7_days",
  "this_month",
  "last_month",
  "last_3_months",
  "this_quarter",
  "this_year",
  "last_year",
  "custom",
  "all_time",
] as const;
export type PeriodPreset = (typeof periodPresets)[number];
export type ComparisonMode = "previous" | "last_year" | "none";
export type Granularity = "day" | "week" | "month" | "quarter" | "year";

export const periodLabels: Record<PeriodPreset, string> = {
  today: "Today",
  yesterday: "Yesterday",
  this_week: "This week",
  last_7_days: "Last 7 days",
  this_month: "This month",
  last_month: "Last month",
  last_3_months: "Last 3 months",
  this_quarter: "This quarter",
  this_year: "This year",
  last_year: "Last year",
  custom: "Custom range",
  all_time: "All time",
};

export type DateRange = { startDate: string | null; endDate: string | null };
export type ResolvedPeriod = DateRange & { preset: PeriodPreset; label: string };

const ymdPattern = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isYmd(value: string | undefined | null): value is string {
  if (!value) return false;
  const match = ymdPattern.exec(value);
  if (!match) return false;
  const [, y, m, d] = match;
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  return date.getUTCFullYear() === Number(y) && date.getUTCMonth() === Number(m) - 1 && date.getUTCDate() === Number(d);
}

function toDate(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function toYmd(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function addDays(ymd: string, days: number) {
  const date = toDate(ymd);
  date.setUTCDate(date.getUTCDate() + days);
  return toYmd(date);
}

export function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Shifts by whole months, clamping the day to the target month's length (31 Mar - 1 month = 28/29 Feb). */
export function addMonths(ymd: string, months: number) {
  const date = toDate(ymd);
  const total = date.getUTCFullYear() * 12 + date.getUTCMonth() + months;
  const year = Math.floor(total / 12);
  const month = total - year * 12;
  const day = Math.min(date.getUTCDate(), daysInMonth(year, month + 1));
  return toYmd(new Date(Date.UTC(year, month, day)));
}

export function startOfMonth(ymd: string) {
  return `${ymd.slice(0, 7)}-01`;
}

export function endOfMonth(ymd: string) {
  const [y, m] = ymd.split("-").map(Number);
  return `${ymd.slice(0, 7)}-${String(daysInMonth(y, m)).padStart(2, "0")}`;
}

function isLastDayOfMonth(ymd: string) {
  return ymd === endOfMonth(ymd);
}

/** Monday of the ISO week containing `ymd`. */
export function startOfWeek(ymd: string) {
  const weekday = toDate(ymd).getUTCDay();
  return addDays(ymd, -((weekday + 6) % 7));
}

function startOfQuarter(ymd: string) {
  const [y, m] = ymd.split("-").map(Number);
  const month = Math.floor((m - 1) / 3) * 3 + 1;
  return `${y}-${String(month).padStart(2, "0")}-01`;
}

/** Inclusive day count. */
export function daysBetween(startDate: string, endDate: string) {
  return Math.round((toDate(endDate).getTime() - toDate(startDate).getTime()) / 86_400_000) + 1;
}

export function manilaToday(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function resolvePeriod(input: { period?: PeriodPreset; startDate?: string; endDate?: string }, today: string): ResolvedPeriod {
  const preset = input.period ?? (input.startDate || input.endDate ? "custom" : "this_month");
  const label = periodLabels[preset];
  switch (preset) {
    case "today": return { preset, label, startDate: today, endDate: today };
    case "yesterday": { const day = addDays(today, -1); return { preset, label, startDate: day, endDate: day }; }
    case "this_week": { const start = startOfWeek(today); return { preset, label, startDate: start, endDate: addDays(start, 6) }; }
    case "last_7_days": return { preset, label, startDate: addDays(today, -6), endDate: today };
    case "this_month": return { preset, label, startDate: startOfMonth(today), endDate: endOfMonth(today) };
    case "last_month": { const last = addMonths(startOfMonth(today), -1); return { preset, label, startDate: last, endDate: endOfMonth(last) }; }
    case "last_3_months": return { preset, label, startDate: addMonths(startOfMonth(today), -2), endDate: today };
    case "this_quarter": { const start = startOfQuarter(today); return { preset, label, startDate: start, endDate: endOfMonth(addMonths(start, 2)) }; }
    case "this_year": return { preset, label, startDate: `${today.slice(0, 4)}-01-01`, endDate: `${today.slice(0, 4)}-12-31` };
    case "last_year": { const year = Number(today.slice(0, 4)) - 1; return { preset, label, startDate: `${year}-01-01`, endDate: `${year}-12-31` }; }
    case "all_time": return { preset, label, startDate: null, endDate: null };
    case "custom":
    default:
      return { preset: "custom", label: periodLabels.custom, startDate: input.startDate ?? null, endDate: input.endDate ?? null };
  }
}

export type ComparisonWindow = {
  mode: ComparisonMode;
  /** The part of the selected period that has already elapsed (the period clamped at today). */
  current: { startDate: string; endDate: string; days: number; periodDays: number; partial: boolean } | null;
  previous: { startDate: string; endDate: string; days: number } | null;
  /** Why there is no comparison, when there is none. */
  unavailableReason: string | null;
};

const monthShift: Partial<Record<PeriodPreset, number>> = {
  this_month: 1,
  last_month: 1,
  last_3_months: 3,
  this_quarter: 3,
  this_year: 12,
  last_year: 12,
};

/**
 * Equal-elapsed-day comparison window. A period that has not finished (this month on the 12th) is
 * compared with the same number of elapsed days of the earlier period, never with the whole of it.
 */
export function resolveComparison(period: ResolvedPeriod, mode: ComparisonMode, today: string): ComparisonWindow {
  const none = (reason: string | null): ComparisonWindow => ({ mode, current: null, previous: null, unavailableReason: reason });
  if (!period.startDate || !period.endDate) {
    return none(mode === "none" ? null : "A comparison needs a bounded reporting period; All time has no earlier equivalent.");
  }
  const periodDays = daysBetween(period.startDate, period.endDate);
  if (periodDays < 1) return none("The end date is before the start date.");
  if (period.startDate > today) return { mode, current: null, previous: null, unavailableReason: "The selected period has not started yet." };
  const endDate = period.endDate < today ? period.endDate : today;
  const partial = endDate < period.endDate;
  const days = daysBetween(period.startDate, endDate);
  const current = { startDate: period.startDate, endDate, days, periodDays, partial };
  if (mode === "none") return { mode, current, previous: null, unavailableReason: null };

  const months = mode === "last_year" ? 12 : (monthShift[period.preset] ?? 0);
  let previousStart: string;
  let previousEnd: string;
  if (months > 0) {
    previousStart = addMonths(period.startDate, -months);
    previousEnd = !partial && isLastDayOfMonth(endDate)
      ? endOfMonth(addMonths(endDate, -months))
      : addMonths(endDate, -months);
  } else {
    previousEnd = addDays(period.startDate, -1);
    previousStart = addDays(previousEnd, -(days - 1));
  }
  return { mode, current, previous: { startDate: previousStart, endDate: previousEnd, days: daysBetween(previousStart, previousEnd) }, unavailableReason: null };
}

export function chooseGranularity(range: { startDate: string; endDate: string }): Granularity {
  const days = daysBetween(range.startDate, range.endDate);
  if (days <= 45) return "day";
  if (days <= 200) return "week";
  if (days <= 1100) return "month";
  if (days <= 3650) return "quarter";
  return "year";
}

export type Bucket = { key: string; label: string; startDate: string; endDate: string };

const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function bucketStart(ymd: string, granularity: Granularity) {
  switch (granularity) {
    case "day": return ymd;
    case "week": return startOfWeek(ymd);
    case "month": return startOfMonth(ymd);
    case "quarter": return startOfQuarter(ymd);
    case "year": return `${ymd.slice(0, 4)}-01-01`;
  }
}

function bucketEnd(start: string, granularity: Granularity) {
  switch (granularity) {
    case "day": return start;
    case "week": return addDays(start, 6);
    case "month": return endOfMonth(start);
    case "quarter": return endOfMonth(addMonths(start, 2));
    case "year": return `${start.slice(0, 4)}-12-31`;
  }
}

function bucketLabel(start: string, end: string, granularity: Granularity) {
  const [y, m, d] = start.split("-").map(Number);
  switch (granularity) {
    case "day": return `${monthNames[m - 1]} ${d}, ${y}`;
    case "week": {
      const [, em, ed] = end.split("-").map(Number);
      return `${monthNames[m - 1]} ${d} - ${monthNames[em - 1]} ${ed}, ${y}`;
    }
    case "month": return `${monthNames[m - 1]} ${y}`;
    case "quarter": return `Q${Math.floor((m - 1) / 3) + 1} ${y}`;
    case "year": return String(y);
  }
}

export function bucketKey(ymd: string, granularity: Granularity) {
  return bucketStart(ymd, granularity);
}

/** Every bucket from start to end, including empty ones, clamped to the range for drill-down. */
export function buildBuckets(range: { startDate: string; endDate: string }, granularity: Granularity): Bucket[] {
  const buckets: Bucket[] = [];
  let cursor = bucketStart(range.startDate, granularity);
  while (cursor <= range.endDate) {
    const fullEnd = bucketEnd(cursor, granularity);
    const startDate = cursor < range.startDate ? range.startDate : cursor;
    const endDate = fullEnd > range.endDate ? range.endDate : fullEnd;
    buckets.push({ key: cursor, label: bucketLabel(cursor, fullEnd, granularity), startDate, endDate });
    cursor = addDays(fullEnd, 1);
  }
  return buckets;
}
