import type { CompareMode, ComparisonRange, Granularity, ReportingPreset, ResolvedGranularity } from "./financial-analytics.types";

/** Date math on `YYYY-MM-DD` strings. Asia/Manila has no daylight saving, so a fixed +8h offset is exact. */
const DAY_MS = 86_400_000;
const utc = (date: string) => Date.parse(`${date}T00:00:00Z`);
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const SHORT_MONTHS = MONTH_NAMES.map(name => name.slice(0, 3));
export const MAX_REPORTING_DAYS = 3660;
export const MAX_BUCKETS = 400;
/** First calendar date the cooperative's ledger can start; used as the open lower bound for All time. */
export const ALL_TIME_FLOOR = "1970-01-01";

export function localDate(value: string | Date) {
  return iso(new Date(value).getTime() + 8 * 3_600_000);
}
export function isValidDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && iso(utc(value)) === value;
}
export function addDays(date: string, days: number) { return iso(utc(date) + days * DAY_MS); }
export function daysBetween(from: string, to: string) { return Math.round((utc(to) - utc(from)) / DAY_MS); }
export function inclusiveDays(from: string, to: string) { return daysBetween(from, to) + 1; }
export function startOfMonth(date: string) { return `${date.slice(0, 7)}-01`; }
export function endOfMonth(date: string) {
  const [year, month] = date.split("-").map(Number);
  return iso(Date.UTC(year, month, 0));
}
export function addMonths(date: string, months: number) {
  const [year, month, day] = date.split("-").map(Number);
  const target = new Date(Date.UTC(year, month - 1 + months, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  return iso(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), Math.min(day, last)));
}
export function startOfQuarter(date: string) {
  const month = Number(date.slice(5, 7));
  return `${date.slice(0, 4)}-${String(Math.floor((month - 1) / 3) * 3 + 1).padStart(2, "0")}-01`;
}
export function endOfQuarter(date: string) { return endOfMonth(addMonths(startOfQuarter(date), 2)); }
export function quarterOf(date: string) { return Math.ceil(Number(date.slice(5, 7)) / 3); }
export function startOfWeek(date: string) { return addDays(date, -((new Date(utc(date)).getUTCDay() + 6) % 7)); }
const min = (a: string, b: string) => (a < b ? a : b);

export function resolvePreset(preset: ReportingPreset, today: string, customStart?: string, customEnd?: string): { start: string; end: string; label: string } {
  const year = Number(today.slice(0, 4));
  switch (preset) {
    case "today": return { start: today, end: today, label: "Today" };
    case "this-month": return { start: startOfMonth(today), end: today, label: "This month" };
    case "last-month": { const start = addMonths(startOfMonth(today), -1); return { start, end: endOfMonth(start), label: "Last month" }; }
    case "last-3-months": return { start: addMonths(startOfMonth(today), -2), end: today, label: "Last 3 months" };
    case "last-6-months": return { start: addMonths(startOfMonth(today), -5), end: today, label: "Last 6 months" };
    case "this-quarter": return { start: startOfQuarter(today), end: today, label: "This quarter" };
    case "this-year": return { start: `${year}-01-01`, end: today, label: "This year" };
    case "last-year": return { start: `${year - 1}-01-01`, end: `${year - 1}-12-31`, label: "Last year" };
    case "all-time": return { start: ALL_TIME_FLOOR, end: today, label: "All time" };
    case "custom": return { start: customStart ?? startOfMonth(today), end: customEnd ?? today, label: "Custom range" };
  }
}

const noComparison = (mode: CompareMode, currentDays: number, note: string | null, label = "No comparison"): ComparisonRange =>
  ({ enabled: false, mode, start: null, end: null, label, days: null, currentDays, note });

/**
 * Comparison ranges never pit a partial period against a whole one. Calendar presets compare with the
 * previous calendar unit truncated to the same elapsed days; other ranges use the immediately preceding
 * range of equal length.
 */
export function resolveComparison(input: {
  preset: ReportingPreset; start: string; end: string; today: string; mode: CompareMode; compareStart?: string | null; compareEnd?: string | null;
}): ComparisonRange {
  const { preset, start, end, mode } = input;
  const currentDays = inclusiveDays(start, end);
  if (mode === "none") return noComparison(mode, currentDays, null);
  if (preset === "all-time" && mode !== "custom") return noComparison(mode, currentDays, "All time has no equivalent earlier period.");
  let compareStart: string; let compareEnd: string; let label: string;
  if (mode === "custom") {
    if (!input.compareStart || !input.compareEnd) return noComparison(mode, currentDays, "Choose a comparison start and end date.");
    compareStart = input.compareStart; compareEnd = input.compareEnd; label = "Custom comparison";
  } else if (mode === "last-year") {
    compareStart = addMonths(start, -12); compareEnd = addMonths(end, -12); label = "Same period last year";
  } else {
    label = "Previous equivalent period";
    const elapsed = currentDays;
    if (preset === "today") { compareStart = compareEnd = addDays(start, -1); }
    else if (preset === "this-month") { compareStart = addMonths(start, -1); compareEnd = min(addDays(compareStart, elapsed - 1), endOfMonth(compareStart)); }
    else if (preset === "last-month") { compareStart = addMonths(start, -1); compareEnd = endOfMonth(compareStart); }
    else if (preset === "this-quarter") { compareStart = addMonths(start, -3); compareEnd = min(addDays(compareStart, elapsed - 1), endOfQuarter(compareStart)); }
    else if (preset === "this-year") { compareStart = `${Number(start.slice(0, 4)) - 1}-01-01`; compareEnd = min(addDays(compareStart, elapsed - 1), `${compareStart.slice(0, 4)}-12-31`); }
    else if (preset === "last-year") { compareStart = `${Number(start.slice(0, 4)) - 1}-01-01`; compareEnd = `${compareStart.slice(0, 4)}-12-31`; }
    else { compareEnd = addDays(start, -1); compareStart = addDays(compareEnd, -(currentDays - 1)); }
  }
  const days = inclusiveDays(compareStart, compareEnd);
  const note = days === currentDays ? null : `The comparison covers ${days} day${days === 1 ? "" : "s"} against ${currentDays} in the reporting period, so totals are not like-for-like.`;
  return { enabled: true, mode, start: compareStart, end: compareEnd, label, days, currentDays, note };
}

export function resolveGranularity(requested: Granularity, start: string, end: string): { granularity: ResolvedGranularity; note: string | null } {
  const days = inclusiveDays(start, end);
  const auto: ResolvedGranularity = days <= 35 ? "daily" : days <= 62 ? "weekly" : days <= 1100 ? "monthly" : days <= 3660 ? "quarterly" : "yearly";
  let granularity: ResolvedGranularity = requested === "auto" ? auto : requested;
  let note: string | null = null;
  if (granularity === "daily" && days > 92) { granularity = auto; note = `Daily detail is limited to 92 days; showing ${auto} periods instead.`; }
  if (bucketCount(granularity, start, end) > MAX_BUCKETS) {
    const coarser: ResolvedGranularity = granularity === "daily" ? "weekly" : granularity === "weekly" ? "monthly" : "quarterly";
    granularity = coarser; note = `That many ${requested} periods would be unreadable; showing ${coarser} periods instead.`;
  }
  return { granularity, note };
}

export function bucketKey(granularity: ResolvedGranularity, date: string) {
  if (granularity === "daily") return date;
  if (granularity === "weekly") return startOfWeek(date);
  if (granularity === "monthly") return date.slice(0, 7);
  if (granularity === "quarterly") return `${date.slice(0, 4)}-Q${quarterOf(date)}`;
  return date.slice(0, 4);
}

export type Bucket = { key: string; label: string; from: string; to: string };
export function bucketLabel(granularity: ResolvedGranularity, key: string) {
  if (granularity === "daily") return `${SHORT_MONTHS[Number(key.slice(5, 7)) - 1]} ${Number(key.slice(8, 10))}, ${key.slice(0, 4)}`;
  if (granularity === "weekly") return `${SHORT_MONTHS[Number(key.slice(5, 7)) - 1]} ${Number(key.slice(8, 10))}, ${key.slice(0, 4)}`;
  if (granularity === "monthly") return `${SHORT_MONTHS[Number(key.slice(5, 7)) - 1]} ${key.slice(0, 4)}`;
  if (granularity === "quarterly") return `${key.slice(5)} ${key.slice(0, 4)}`;
  return key;
}
/** "Oct 5–11, 2026" or "Oct 29 – Nov 4, 2026": weekly buckets are named by the dates they actually cover. */
export function rangeLabel(from: string, to: string) {
  const [fy, fm, fd] = from.split("-").map(Number); const [ty, tm, td] = to.split("-").map(Number);
  if (from === to) return `${SHORT_MONTHS[fm - 1]} ${fd}, ${fy}`;
  if (fy === ty && fm === tm) return `${SHORT_MONTHS[fm - 1]} ${fd}–${td}, ${fy}`;
  return fy === ty ? `${SHORT_MONTHS[fm - 1]} ${fd} – ${SHORT_MONTHS[tm - 1]} ${td}, ${fy}` : `${SHORT_MONTHS[fm - 1]} ${fd}, ${fy} – ${SHORT_MONTHS[tm - 1]} ${td}, ${ty}`;
}
function bucketBounds(granularity: ResolvedGranularity, key: string): { from: string; to: string } {
  if (granularity === "daily") return { from: key, to: key };
  if (granularity === "weekly") return { from: key, to: addDays(key, 6) };
  if (granularity === "monthly") return { from: `${key}-01`, to: endOfMonth(`${key}-01`) };
  if (granularity === "quarterly") { const from = `${key.slice(0, 4)}-${String((Number(key.slice(6)) - 1) * 3 + 1).padStart(2, "0")}-01`; return { from, to: endOfQuarter(from) }; }
  return { from: `${key}-01-01`, to: `${key}-12-31` };
}
function nextBucketStart(granularity: ResolvedGranularity, date: string) {
  if (granularity === "daily") return addDays(date, 1);
  if (granularity === "weekly") return addDays(startOfWeek(date), 7);
  if (granularity === "monthly") return addMonths(startOfMonth(date), 1);
  if (granularity === "quarterly") return addMonths(startOfQuarter(date), 3);
  return `${Number(date.slice(0, 4)) + 1}-01-01`;
}
function bucketCount(granularity: ResolvedGranularity, start: string, end: string) {
  const days = inclusiveDays(start, end);
  const approximate = { daily: 1, weekly: 7, monthly: 30.4, quarterly: 91.3, yearly: 365.25 }[granularity];
  return Math.ceil(days / approximate) + 1;
}

/** Calendar buckets covering [from, to], clipped to the range so partial edge periods are labelled by their real dates. */
export function buildBuckets(granularity: ResolvedGranularity, from: string, to: string): Bucket[] {
  const buckets: Bucket[] = [];
  let cursor = from;
  while (cursor <= to) {
    const key = bucketKey(granularity, cursor);
    const bounds = bucketBounds(granularity, key);
    const clipped = { from: bounds.from < from ? from : bounds.from, to: bounds.to > to ? to : bounds.to };
    buckets.push({ key, label: granularity === "weekly" ? rangeLabel(clipped.from, clipped.to) : bucketLabel(granularity, key), ...clipped });
    cursor = nextBucketStart(granularity, cursor);
  }
  return buckets;
}
