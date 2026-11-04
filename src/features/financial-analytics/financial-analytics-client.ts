import type {
  BridgeDriver, CompareMode, FinancialAnalyticsResult, Granularity, IntegrityIssue, OperatingSourceModule, PeriodDetail, RecordTypeFilter, ReportingPreset,
  ShareRow, SourceCategoryMatrix, TrendPoint,
} from "../../../server/src/modules/financial-analytics/financial-analytics.types";
import { apiRequest } from "@/lib/api-client";
import { env } from "@/config/env";

export type { BridgeDriver, FinancialAnalyticsResult, IntegrityIssue, PeriodDetail, ShareRow, SourceCategoryMatrix, TrendPoint };
export type MatrixResponse = {
  filters: FinancialAnalyticsResult["filters"]; periodLabel: string; comparisonLabel: string | null; comparison: FinancialAnalyticsResult["comparison"];
  income: SourceCategoryMatrix; expense: SourceCategoryMatrix;
};

/** Filters as edited in the UI. Amounts stay text so an empty field means "no limit", not zero. */
export type FinancialFilters = {
  period: ReportingPreset; start: string; end: string;
  compare: CompareMode; compareStart: string; compareEnd: string;
  recordType: RecordTypeFilter; categoryIds: string[]; sourceModules: OperatingSourceModule[];
  minAmount: string; maxAmount: string; reference: string; granularity: Granularity;
};

export const PERIOD_OPTIONS: Array<{ value: ReportingPreset; label: string }> = [
  { value: "today", label: "Today" }, { value: "this-month", label: "This month" }, { value: "last-month", label: "Last month" },
  { value: "last-3-months", label: "Last 3 months" }, { value: "last-6-months", label: "Last 6 months" }, { value: "this-quarter", label: "This quarter" },
  { value: "this-year", label: "This year" }, { value: "last-year", label: "Last year" }, { value: "all-time", label: "All time" }, { value: "custom", label: "Custom date range" },
];
export const COMPARE_OPTIONS: Array<{ value: CompareMode; label: string }> = [
  { value: "previous", label: "Previous equivalent period" }, { value: "last-year", label: "Same period last year" },
  { value: "none", label: "No comparison" }, { value: "custom", label: "Custom comparison range" },
];
export const RECORD_TYPE_OPTIONS: Array<{ value: RecordTypeFilter; label: string }> = [
  { value: "all", label: "All eligible operating records" }, { value: "Income", label: "Income" }, { value: "Expense", label: "Expense" },
];
export const GRANULARITY_OPTIONS: Array<{ value: Granularity; label: string }> = [
  { value: "auto", label: "Automatic" }, { value: "daily", label: "Daily" }, { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" }, { value: "quarterly", label: "Quarterly" }, { value: "yearly", label: "Yearly" },
];
const valid = <T extends string>(options: Array<{ value: T }>, value: string | null, fallback: T): T => (options.some(option => option.value === value) ? (value as T) : fallback);
export const labelFor = <T extends string>(options: Array<{ value: T; label: string }>, value: T) => options.find(option => option.value === value)?.label ?? value;

export function defaultFinancialFilters(): FinancialFilters {
  return { period: "this-year", start: "", end: "", compare: "previous", compareStart: "", compareEnd: "", recordType: "all", categoryIds: [], sourceModules: [], minAmount: "", maxAmount: "", reference: "", granularity: "auto" };
}

const SOURCES: OperatingSourceModule[] = ["Manual", "Membership", "Payment", "Rental", "POS", "Document", "Other"];
export function filtersFromParams(params: URLSearchParams): FinancialFilters {
  const base = defaultFinancialFilters();
  const list = (name: string) => (params.get(name) ?? "").split("|").filter(Boolean);
  return {
    period: valid(PERIOD_OPTIONS, params.get("period"), base.period), start: params.get("start") ?? "", end: params.get("end") ?? "",
    compare: valid(COMPARE_OPTIONS, params.get("compare"), base.compare), compareStart: params.get("compareStart") ?? "", compareEnd: params.get("compareEnd") ?? "",
    recordType: valid(RECORD_TYPE_OPTIONS, params.get("recordType"), "all"),
    categoryIds: list("categories").filter(id => /^\d{1,10}$/.test(id)), sourceModules: list("sources").filter((s): s is OperatingSourceModule => (SOURCES as string[]).includes(s)),
    minAmount: params.get("minAmount") ?? "", maxAmount: params.get("maxAmount") ?? "", reference: params.get("reference") ?? "",
    granularity: valid(GRANULARITY_OPTIONS, params.get("granularity"), "auto"),
  };
}

/** Only non-default values are written, so URLs stay short and shareable. */
export function filtersToParams(filters: FinancialFilters): URLSearchParams {
  const base = defaultFinancialFilters();
  const params = new URLSearchParams();
  if (filters.period !== base.period) params.set("period", filters.period);
  if (filters.period === "custom") { if (filters.start) params.set("start", filters.start); if (filters.end) params.set("end", filters.end); }
  if (filters.compare !== base.compare) params.set("compare", filters.compare);
  if (filters.compare === "custom") { if (filters.compareStart) params.set("compareStart", filters.compareStart); if (filters.compareEnd) params.set("compareEnd", filters.compareEnd); }
  if (filters.recordType !== "all") params.set("recordType", filters.recordType);
  if (filters.categoryIds.length) params.set("categories", filters.categoryIds.join("|"));
  if (filters.sourceModules.length) params.set("sources", filters.sourceModules.join("|"));
  if (filters.minAmount) params.set("minAmount", filters.minAmount);
  if (filters.maxAmount) params.set("maxAmount", filters.maxAmount);
  if (filters.reference) params.set("reference", filters.reference);
  if (filters.granularity !== "auto") params.set("granularity", filters.granularity);
  return params;
}

/** Returns a message for the first problem, or "" when the draft can be applied. */
export function validateFilters(filters: FinancialFilters, today: string): string {
  if (filters.period === "custom") {
    if (!filters.start || !filters.end) return "Choose both a start and an end date for the custom range.";
    if (filters.start > filters.end) return "The reporting start date must be on or before the end date.";
    if (filters.end > today) return "Future dates are unavailable; choose an end date on or before today.";
  }
  if (filters.compare === "custom") {
    if (!filters.compareStart || !filters.compareEnd) return "Choose both a comparison start and end date.";
    if (filters.compareStart > filters.compareEnd) return "The comparison start date must be on or before its end date.";
  }
  const min = filters.minAmount === "" ? null : Number(filters.minAmount); const max = filters.maxAmount === "" ? null : Number(filters.maxAmount);
  if ((min !== null && (!Number.isFinite(min) || min < 0)) || (max !== null && (!Number.isFinite(max) || max < 0))) return "Amounts must be zero or greater.";
  if (min !== null && max !== null && min > max) return "The minimum amount must not exceed the maximum amount.";
  return "";
}

export type ActiveChip = { id: string; label: string; clear: Partial<FinancialFilters> };
export function activeChips(filters: FinancialFilters, categoryName: (id: string) => string): ActiveChip[] {
  const chips: ActiveChip[] = [];
  if (filters.recordType !== "all") chips.push({ id: "recordType", label: `Type: ${filters.recordType}`, clear: { recordType: "all" } });
  for (const id of filters.categoryIds) chips.push({ id: `category:${id}`, label: `Category: ${categoryName(id)}`, clear: { categoryIds: filters.categoryIds.filter(value => value !== id) } });
  for (const source of filters.sourceModules) chips.push({ id: `source:${source}`, label: `Source: ${source}`, clear: { sourceModules: filters.sourceModules.filter(value => value !== source) } });
  if (filters.minAmount) chips.push({ id: "min", label: `Min ${peso(Number(filters.minAmount))}`, clear: { minAmount: "" } });
  if (filters.maxAmount) chips.push({ id: "max", label: `Max ${peso(Number(filters.maxAmount))}`, clear: { maxAmount: "" } });
  if (filters.reference) chips.push({ id: "reference", label: `Reference: ${filters.reference}`, clear: { reference: "" } });
  if (filters.granularity !== "auto") chips.push({ id: "granularity", label: `Detail: ${labelFor(GRANULARITY_OPTIONS, filters.granularity)}`, clear: { granularity: "auto" } });
  return chips;
}

/** Extra API parameters (drawers override the window without touching the page filters). */
const query = (filters: FinancialFilters, extra: Record<string, string> = {}) => {
  const params = filtersToParams(filters);
  for (const [key, value] of Object.entries(extra)) params.set(key, value);
  return params.toString();
};
export const getFinancialAnalytics = (filters: FinancialFilters, signal?: AbortSignal) =>
  apiRequest<FinancialAnalyticsResult>(`/api/chairman/financial-analytics?${query(filters)}`, { signal });
export const getFinancialMatrix = (filters: FinancialFilters, signal?: AbortSignal) =>
  apiRequest<MatrixResponse>(`/api/chairman/financial-analytics/matrix?${query(filters)}`, { signal });
export const getFinancialPeriod = (filters: FinancialFilters, from: string, to: string, signal?: AbortSignal) =>
  apiRequest<PeriodDetail>(`/api/chairman/financial-analytics/period?${query(filters, { from, to })}`, { signal });

export async function downloadFinancialAnalytics(filters: FinancialFilters, scope: "full" | "matrix" | "period" = "full", range?: { from: string; to: string }) {
  const response = await fetch(`${env.apiUrl}/api/chairman/financial-analytics/export?${query(filters, { scope, ...(range ?? {}) })}`, { credentials: "include" });
  if (!response.ok) throw new Error("The analytics export could not be created. Please try again.");
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url; link.download = `financial-analytics-${scope}.xlsx`; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Financial Ledger deep link. Dates default to the analytics reporting window. */
export function ledgerLink(report: Pick<FinancialAnalyticsResult, "filters">, extra: Record<string, string | undefined> = {}, range?: { from: string; to: string }) {
  const params = new URLSearchParams();
  params.set("startDate", range?.from ?? report.filters.start);
  params.set("endDate", range?.to ?? report.filters.end);
  if (report.filters.categoryIds.length) params.set("financialCategoryIds", report.filters.categoryIds.join("|"));
  if (report.filters.sourceModules.length) params.set("sourceModules", report.filters.sourceModules.join("|"));
  if (report.filters.recordType !== "all") params.set("recordType", report.filters.recordType);
  for (const [key, value] of Object.entries(extra)) { if (value === undefined) params.delete(key); else params.set(key, value); }
  params.set("from", "analytics");
  return `/portal/chairman/financial-ledger?${params}`;
}
export const ledgerSearchLink = (term: string) => `/portal/chairman/financial-ledger?${new URLSearchParams({ search: term.trim(), from: "analytics" })}`;
export function integrityLedgerLink(issue: IntegrityIssue) {
  if (!issue.link) return null;
  if (issue.link.href.includes("financial-ledger")) return `${issue.link.href}?${new URLSearchParams({ ...(issue.ledgerQuery ?? {}), from: "analytics" })}`;
  return issue.link.href;
}

const pesoFormat = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pesoWhole = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 });
export const peso = (value: number | null | undefined) => (value === null || value === undefined || !Number.isFinite(value) ? "N/A" : (value < 0 ? "−" : "") + pesoFormat.format(Math.abs(value)));
export const pesoCompact = (value: number | null | undefined) => (value === null || value === undefined || !Number.isFinite(value) ? "N/A" : (value < 0 ? "−" : "") + pesoWhole.format(Math.abs(value)));
export const signedPeso = (value: number | null | undefined) => (value === null || value === undefined ? "N/A" : `${value > 0 ? "+" : value < 0 ? "−" : ""}${pesoFormat.format(Math.abs(value))}`);
export const percent = (value: number | null | undefined, digits = 1) => (value === null || value === undefined ? "N/A" : `${new Intl.NumberFormat("en-PH", { maximumFractionDigits: digits }).format(value)}%`);
export const signedPercent = (value: number | null | undefined) => (value === null || value === undefined ? "N/A" : `${value > 0 ? "+" : value < 0 ? "−" : ""}${percent(Math.abs(value))}`);
export const count = (value: number) => value.toLocaleString("en-PH");

export type Tone = "good" | "warning" | "danger" | "neutral";
export const toneColors: Record<Tone, string> = { good: "#1f6b43", warning: "#8a6200", danger: "#9a392a", neutral: "#5d6d63" };
/** Direction tone for a signed change: income-like values are good when rising, expense-like values are neutral, never "bad". */
export function changeTone(change: number | null, kind: "income" | "expense" | "net"): Tone {
  if (change === null || change === 0) return "neutral";
  if (kind === "expense") return "neutral";
  return change > 0 ? "good" : "danger";
}
/** A cell may carry an explicit sort key so formatted text (₱, %, signs) still sorts numerically. */
export type TableCell = string | number | null | { sort: number | string | null; node: import("react").ReactNode };
export const sortKey = (cell: TableCell): number | string | null => (cell !== null && typeof cell === "object" ? cell.sort : cell);
export function compareCells(a: TableCell, b: TableCell) {
  const x = sortKey(a); const y = sortKey(b);
  if (x === null && y === null) return 0;
  if (x === null) return 1;
  if (y === null) return -1;
  if (typeof x === "number" && typeof y === "number") return x - y;
  return String(x).localeCompare(String(y), "en", { numeric: true });
}
