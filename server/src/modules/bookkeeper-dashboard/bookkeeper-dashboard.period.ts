import { manilaToday } from "../../utils/manila-calendar";
import { AppError } from "../../utils/app-error";

export const dashboardPeriodKeys = ["today", "week", "month", "quarter", "year", "custom"] as const;
export type DashboardPeriodKey = (typeof dashboardPeriodKeys)[number];

export type DashboardPeriod = {
  key: DashboardPeriodKey;
  label: string;
  /** Inclusive Asia/Manila calendar dates (YYYY-MM-DD). */
  start: string;
  end: string;
  previousStart: string;
  previousEnd: string;
  previousLabel: string;
  today: string;
  dayCount: number;
  /** First days (YYYY-MM-01) of the months shown by the trend chart. */
  trendMonths: string[];
  /** Inclusive window covered by the trend chart. */
  trendStart: string;
  trendEnd: string;
};

const DAY = 86_400_000;
const MAX_RANGE_DAYS = 1830;
const MAX_TREND_MONTHS = 24;
const MIN_TREND_MONTHS = 6;

const toTime = (day: string) => Date.parse(`${day}T00:00:00Z`);
const fromTime = (time: number) => new Date(time).toISOString().slice(0, 10);
const addDays = (day: string, days: number) => fromTime(toTime(day) + days * DAY);
const diffDays = (from: string, to: string) => Math.round((toTime(to) - toTime(from)) / DAY);
const monthStart = (day: string) => `${day.slice(0, 7)}-01`;

function addMonths(day: string, months: number) {
  const [year, month] = day.split("-").map(Number);
  const index = year * 12 + (month - 1) + months;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}-01`;
}

function endOfMonth(day: string) {
  return addDays(addMonths(day, 1), -1);
}

function assertDate(value: string | undefined, label: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(toTime(value)) || fromTime(toTime(value)) !== value) {
    throw new AppError(`Choose a valid ${label} date.`, 422, "FINANCE_DATE_RANGE");
  }
  return value;
}

const labels: Record<DashboardPeriodKey, [string, string]> = {
  today: ["Today", "Yesterday"],
  week: ["This week", "Previous week"],
  month: ["This month", "Previous month"],
  quarter: ["This quarter", "Previous quarter"],
  year: ["This year", "Previous year"],
  custom: ["Custom range", "Previous period of equal length"],
};

/**
 * Resolves the reporting window in Asia/Manila calendar days. The comparison period covers the same
 * number of elapsed days in the preceding unit (for example 1–4 November vs 1–4 October), so a
 * partial current month is never compared with a complete previous month.
 */
export function resolveDashboardPeriod(
  input: { period?: DashboardPeriodKey; start?: string; end?: string },
  now = new Date(),
): DashboardPeriod {
  const key = input.period ?? "month";
  const today = manilaToday(now);
  let start: string;
  let end = today;
  let previousUnitStart: string;
  let previousUnitEnd: string;

  switch (key) {
    case "today":
      start = today;
      previousUnitStart = previousUnitEnd = addDays(today, -1);
      break;
    case "week": {
      const weekday = new Date(`${today}T00:00:00Z`).getUTCDay();
      start = addDays(today, -((weekday + 6) % 7)); // Monday start
      previousUnitStart = addDays(start, -7);
      previousUnitEnd = addDays(start, -1);
      break;
    }
    case "month":
      start = monthStart(today);
      previousUnitStart = addMonths(start, -1);
      previousUnitEnd = addDays(start, -1);
      break;
    case "quarter": {
      const month = Number(today.slice(5, 7));
      start = `${today.slice(0, 4)}-${String(Math.floor((month - 1) / 3) * 3 + 1).padStart(2, "0")}-01`;
      previousUnitStart = addMonths(start, -3);
      previousUnitEnd = addDays(start, -1);
      break;
    }
    case "year":
      start = `${today.slice(0, 4)}-01-01`;
      previousUnitStart = `${Number(today.slice(0, 4)) - 1}-01-01`;
      previousUnitEnd = addDays(start, -1);
      break;
    case "custom": {
      start = assertDate(input.start, "start");
      end = assertDate(input.end, "end");
      previousUnitEnd = addDays(start, -1);
      previousUnitStart = addDays(previousUnitEnd, -(diffDays(start, end)));
      break;
    }
  }

  if (start > end) throw new AppError("The reporting start date must be on or before the end date.", 422, "FINANCE_DATE_RANGE");
  if (end > today) throw new AppError("Future reporting dates are unavailable.", 422, "FINANCE_DATE_RANGE");
  const dayCount = diffDays(start, end) + 1;
  if (dayCount > MAX_RANGE_DAYS) throw new AppError("Choose a reporting range of five years or less.", 422, "FINANCE_DATE_RANGE");

  const previousStart = previousUnitStart;
  const previousEnd = [addDays(previousStart, dayCount - 1), previousUnitEnd].sort()[0];

  // Trend: at least the six months ending at the period end, widened to include the period start, capped.
  const lastMonth = monthStart(end);
  let firstMonth = addMonths(lastMonth, -(MIN_TREND_MONTHS - 1));
  if (monthStart(start) < firstMonth) firstMonth = monthStart(start);
  const earliestAllowed = addMonths(lastMonth, -(MAX_TREND_MONTHS - 1));
  if (firstMonth < earliestAllowed) firstMonth = earliestAllowed;
  const trendMonths: string[] = [];
  for (let cursor = firstMonth; cursor <= lastMonth; cursor = addMonths(cursor, 1)) trendMonths.push(cursor);
  const trendEnd = [endOfMonth(lastMonth), today].sort()[0];

  return {
    key,
    label: labels[key][0],
    start,
    end,
    previousStart,
    previousEnd,
    previousLabel: labels[key][1],
    today,
    dayCount,
    trendMonths,
    trendStart: firstMonth,
    trendEnd,
  };
}
