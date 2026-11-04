import { z } from "zod";
import { AppError } from "../../utils/app-error";
import { ALL_TIME_FLOOR, inclusiveDays, isValidDate, localDate, MAX_REPORTING_DAYS, resolveComparison, resolvePreset } from "./financial-analytics.periods";
import {
  COMPARE_MODES, GRANULARITIES, OPERATING_SOURCE_MODULES, RECORD_TYPE_FILTERS, REPORTING_PRESETS,
  type ComparisonRange, type FinancialAnalyticsFilters,
} from "./financial-analytics.types";

const dateField = z.string().refine(isValidDate, "Use a real calendar date in YYYY-MM-DD format");
const pipeList = z.preprocess(value => (typeof value === "string" ? value.split("|").filter(Boolean) : value ?? []), z.array(z.string().max(40)).max(50));
const amountField = z.preprocess(value => (value === "" || value === undefined ? null : Number(value)), z.number().min(0).max(99_999_999.99).nullable());

const querySchema = z.object({
  period: z.enum(REPORTING_PRESETS).default("this-year"),
  start: dateField.optional(),
  end: dateField.optional(),
  compare: z.enum(COMPARE_MODES).default("previous"),
  compareStart: dateField.optional(),
  compareEnd: dateField.optional(),
  recordType: z.enum(RECORD_TYPE_FILTERS).default("all"),
  categories: pipeList,
  sources: pipeList,
  minAmount: amountField,
  maxAmount: amountField,
  reference: z.string().trim().max(60).default(""),
  granularity: z.enum(GRANULARITIES).default("auto"),
});

function invalid(message: string): never {
  throw new AppError(message, 400, "VALIDATION_ERROR");
}

/** Validate a raw query string object and resolve every date to inclusive Asia/Manila calendar dates. */
export function parseFinancialAnalyticsFilters(query: Record<string, unknown>, now = new Date()): FinancialAnalyticsFilters {
  const parsed = querySchema.safeParse(query);
  if (!parsed.success) invalid(`Invalid financial analytics filters: ${parsed.error.issues.map(issue => `${issue.path.join(".")} ${issue.message}`).join("; ")}`);
  const input = parsed.data;
  const today = localDate(now);
  if (input.period === "custom" && (!input.start || !input.end)) invalid("Choose both a start and an end date for a custom range.");
  const range = resolvePreset(input.period, today, input.start, input.end);
  if (range.start > range.end) invalid("The reporting start date must be on or before the end date.");
  if (range.end > today) invalid("Future dates are unavailable; choose an end date on or before today.");
  if (input.period !== "all-time" && inclusiveDays(range.start, range.end) > MAX_REPORTING_DAYS) invalid("Use a reporting range of at most ten years.");
  const sourceModules = input.sources.map(source => {
    if (!(OPERATING_SOURCE_MODULES as readonly string[]).includes(source)) invalid(`"${source}" is not an operating source module. Share Capital is a capital movement and is reported separately.`);
    return source as FinancialAnalyticsFilters["sourceModules"][number];
  });
  if (input.categories.some(id => !/^\d{1,10}$/.test(id))) invalid("Category filters must be category ids.");
  if (input.minAmount !== null && input.maxAmount !== null && input.minAmount > input.maxAmount) invalid("The minimum amount must not exceed the maximum amount.");
  if (input.compare === "custom") {
    if (!input.compareStart || !input.compareEnd) invalid("Choose both a comparison start and end date.");
    if (input.compareStart > input.compareEnd) invalid("The comparison start date must be on or before its end date.");
    if (input.compareEnd >= range.start && input.compareStart <= range.end) invalid("The comparison range must not overlap the reporting period.");
  }
  const comparison = resolveComparison({ preset: input.period, ...range, today, mode: input.compare, compareStart: input.compareStart, compareEnd: input.compareEnd });
  return {
    period: input.period, start: range.start, end: range.end,
    compare: input.compare, compareStart: comparison.start, compareEnd: comparison.end,
    recordType: input.recordType, categoryIds: [...new Set(input.categories)], sourceModules: [...new Set(sourceModules)],
    minAmount: input.minAmount, maxAmount: input.maxAmount, reference: input.reference,
    granularity: input.granularity, asOf: today,
  };
}

/** All time is open-ended until the first eligible ledger date is known. */
export function closeAllTime(filters: FinancialAnalyticsFilters, firstRecordDate: string | null): FinancialAnalyticsFilters {
  if (filters.period !== "all-time" || filters.start !== ALL_TIME_FLOOR) return filters;
  const start = firstRecordDate && firstRecordDate <= filters.end ? firstRecordDate : filters.end;
  return { ...filters, start };
}

export function comparisonOf(filters: FinancialAnalyticsFilters): ComparisonRange {
  return resolveComparison({ preset: filters.period, start: filters.start, end: filters.end, today: filters.asOf, mode: filters.compare, compareStart: filters.compareStart, compareEnd: filters.compareEnd });
}

/** Query string that reproduces the filters (used for deep links and exports). */
export function filtersToParams(filters: FinancialAnalyticsFilters): URLSearchParams {
  const params = new URLSearchParams({ period: filters.period, compare: filters.compare, recordType: filters.recordType, granularity: filters.granularity });
  if (filters.period === "custom") { params.set("start", filters.start); params.set("end", filters.end); }
  if (filters.compare === "custom" && filters.compareStart && filters.compareEnd) { params.set("compareStart", filters.compareStart); params.set("compareEnd", filters.compareEnd); }
  if (filters.categoryIds.length) params.set("categories", filters.categoryIds.join("|"));
  if (filters.sourceModules.length) params.set("sources", filters.sourceModules.join("|"));
  if (filters.minAmount !== null) params.set("minAmount", String(filters.minAmount));
  if (filters.maxAmount !== null) params.set("maxAmount", String(filters.maxAmount));
  if (filters.reference) params.set("reference", filters.reference);
  return params;
}

/** Override the reporting window while keeping every other filter (used by drawers and period details). */
export function withWindow(filters: FinancialAnalyticsFilters, window: { start: string; end: string }): FinancialAnalyticsFilters {
  if (window.start > window.end || window.end > filters.asOf) invalid("Choose a window that ends on or before today.");
  const comparison = resolveComparison({ preset: "custom", start: window.start, end: window.end, today: filters.asOf, mode: filters.compare === "none" ? "none" : "previous" });
  return { ...filters, period: "custom", start: window.start, end: window.end, compare: comparison.enabled ? "custom" : "none", compareStart: comparison.start, compareEnd: comparison.end };
}
