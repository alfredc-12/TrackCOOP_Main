import { env } from "@/config/env";
import { ApiClientError, apiRequest } from "@/lib/api-client";
import { requireSummaryFields } from "@/features/people-management/summary-guard";
import type { FilterChip } from "@/features/people-management/people-filters";
import type { ExpenseClass } from "../../../server/src/modules/expense-overview/expense-classification";
import type { ComparisonMode, Granularity, PeriodPreset } from "../../../server/src/modules/expense-overview/expense-periods";
import type { ExpenseRecordView, ExpenseSortField, ExportKind } from "../../../server/src/modules/expense-overview/expense-overview.schema";
import type {
  ExpenseBudgetContext,
  ExpenseCategories,
  ExpenseDrivers,
  ExpenseFilterOptions,
  ExpenseInsight,
  ExpenseIntegrity,
  ExpenseMatrix,
  ExpenseRecordDetail,
  ExpenseRecordsPage,
  ExpenseSources,
  ExpenseSummary,
  ExpenseTrend,
} from "../../../server/src/modules/expense-overview/expense-overview.types";

export type {
  ComparisonMode, ExpenseBudgetContext, ExpenseCategories, ExpenseClass, ExpenseDrivers, ExpenseFilterOptions, ExpenseInsight, ExpenseIntegrity,
  ExpenseMatrix, ExpenseRecordDetail, ExpenseRecordView, ExpenseRecordsPage, ExpenseSources, ExpenseSummary, ExpenseTrend, ExportKind, Granularity, PeriodPreset,
};

export const periodOptions: Array<{ value: PeriodPreset; label: string }> = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "this_week", label: "This week" },
  { value: "last_7_days", label: "Last 7 days" },
  { value: "this_month", label: "This month" },
  { value: "last_month", label: "Last month" },
  { value: "last_3_months", label: "Last 3 months" },
  { value: "this_quarter", label: "This quarter" },
  { value: "this_year", label: "This year" },
  { value: "last_year", label: "Last year" },
  { value: "custom", label: "Custom range" },
  { value: "all_time", label: "All time" },
];
export const compareOptions: Array<{ value: ComparisonMode; label: string }> = [
  { value: "previous", label: "Previous equivalent period" },
  { value: "last_year", label: "Same period last year" },
  { value: "none", label: "No comparison" },
];
export const classOptions: Array<{ value: ExpenseClass; label: string }> = [
  { value: "operating", label: "Operating expenses" },
  { value: "other_recognized", label: "Other recognized expenses" },
  { value: "capital", label: "Capital expenditure" },
  { value: "non_expense_disbursement", label: "Non-expense disbursements" },
  { value: "unclassified", label: "Needs classification" },
];
export const viewOptions: Array<{ value: ExpenseRecordView; label: string }> = [
  { value: "posted", label: "Posted" },
  { value: "unposted", label: "Unposted" },
  { value: "voided", label: "Voided" },
  { value: "corrected", label: "Corrected or reversed" },
  { value: "all", label: "All statuses" },
];
export const sourceModuleOptions = ["Manual", "Membership", "Payment", "Share Capital", "Rental", "POS", "Document", "Other"];
export const sortOptions: Array<{ value: ExpenseSortField; label: string }> = [
  { value: "recordDate", label: "Expense date" },
  { value: "amount", label: "Amount" },
  { value: "recordNumber", label: "Record number" },
  { value: "category", label: "Category" },
  { value: "source", label: "Source module" },
];

export const classLabel = (value: ExpenseClass) => classOptions.find((option) => option.value === value)?.label ?? value;
export const periodLabel = (value: PeriodPreset) => periodOptions.find((option) => option.value === value)?.label ?? value;

/** Everything the page's filters, table and URL describe. */
export type ExpenseUiQuery = {
  period: PeriodPreset;
  startDate?: string;
  endDate?: string;
  compare: ComparisonMode;
  categoryIds: string[];
  sourceModules: string[];
  classes: ExpenseClass[];
  amountMin?: string;
  amountMax?: string;
  recordedBy?: string;
  postedBy?: string;
  seasonId?: string;
  budget?: "covered" | "uncovered";
  search: string;
  view: ExpenseRecordView;
  page: number;
  pageSize: number;
  sortBy: ExpenseSortField;
  sortDirection: "asc" | "desc";
};

export const defaultQuery: ExpenseUiQuery = {
  period: "this_month",
  compare: "previous",
  categoryIds: [],
  sourceModules: [],
  classes: ["operating"],
  search: "",
  view: "posted",
  page: 1,
  pageSize: 20,
  sortBy: "recordDate",
  sortDirection: "desc",
};

const periods = new Set<string>(periodOptions.map((option) => option.value));
const compares = new Set<string>(compareOptions.map((option) => option.value));
const classSet = new Set<string>(classOptions.map((option) => option.value));
const views = new Set<string>(viewOptions.map((option) => option.value));
const sorts = new Set<string>(sortOptions.map((option) => option.value));
const sources = new Set<string>(sourceModuleOptions);
const pageSizes = [10, 20, 50, 100];

const isDate = (value: string | null): value is string => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};
const list = (value: string | null) => (value ? value.split(",").map((part) => part.trim()).filter(Boolean) : []);
const money = (value: string | null) => (value !== null && /^\d{1,12}(\.\d{1,2})?$/.test(value) ? value : undefined);
const id = (value: string | null) => (value && /^\d{1,20}$/.test(value) ? value : undefined);

/** Reads the address bar. Anything unrecognised falls back to the default instead of failing. */
export function queryFromParams(params: URLSearchParams): ExpenseUiQuery {
  const startDate = params.get("startDate");
  const endDate = params.get("endDate");
  const rawPeriod = params.get("period");
  let period: PeriodPreset = rawPeriod && periods.has(rawPeriod) ? (rawPeriod as PeriodPreset) : defaultQuery.period;
  const validRange = isDate(startDate) && isDate(endDate) && startDate <= endDate;
  if (period === "custom" && !validRange) period = defaultQuery.period;
  if (!rawPeriod && validRange) period = "custom";
  const classes = list(params.get("classes")).filter((item): item is ExpenseClass => classSet.has(item));
  const amountMin = money(params.get("amountMin"));
  const amountMax = money(params.get("amountMax"));
  const budget = params.get("budget");
  const view = params.get("view");
  const sortBy = params.get("sort");
  const pageSize = Number(params.get("pageSize"));
  const page = Number(params.get("page"));
  return {
    period,
    startDate: period === "custom" ? (startDate ?? undefined) : undefined,
    endDate: period === "custom" ? (endDate ?? undefined) : undefined,
    compare: compares.has(params.get("compare") ?? "") ? (params.get("compare") as ComparisonMode) : defaultQuery.compare,
    categoryIds: list(params.get("categoryIds")).filter((item) => /^\d{1,20}$/.test(item)),
    sourceModules: list(params.get("sourceModules")).filter((item) => sources.has(item)),
    classes: classes.length ? classes : [...defaultQuery.classes],
    amountMin,
    amountMax: amountMin !== undefined && amountMax !== undefined && Number(amountMin) > Number(amountMax) ? undefined : amountMax,
    recordedBy: id(params.get("recordedBy")),
    postedBy: id(params.get("postedBy")),
    seasonId: id(params.get("seasonId")),
    budget: budget === "covered" || budget === "uncovered" ? budget : undefined,
    search: (params.get("q") ?? "").slice(0, 190),
    view: view && views.has(view) ? (view as ExpenseRecordView) : defaultQuery.view,
    page: Number.isInteger(page) && page > 0 ? page : 1,
    pageSize: pageSizes.includes(pageSize) ? pageSize : defaultQuery.pageSize,
    sortBy: sortBy && sorts.has(sortBy) ? (sortBy as ExpenseSortField) : defaultQuery.sortBy,
    sortDirection: params.get("dir") === "asc" ? "asc" : "desc",
  };
}

const sameList = (a: string[], b: string[]) => a.length === b.length && a.every((item, index) => item === b[index]);

/** The address-bar form: defaults are left out so a clean page has a clean URL. */
export function paramsFromQuery(query: ExpenseUiQuery) {
  const params = new URLSearchParams();
  if (query.period !== defaultQuery.period) params.set("period", query.period);
  if (query.period === "custom" && query.startDate && query.endDate) {
    params.set("startDate", query.startDate);
    params.set("endDate", query.endDate);
  }
  if (query.compare !== defaultQuery.compare) params.set("compare", query.compare);
  if (query.categoryIds.length) params.set("categoryIds", query.categoryIds.join(","));
  if (query.sourceModules.length) params.set("sourceModules", query.sourceModules.join(","));
  if (!sameList(query.classes, defaultQuery.classes)) params.set("classes", query.classes.join(","));
  if (query.amountMin) params.set("amountMin", query.amountMin);
  if (query.amountMax) params.set("amountMax", query.amountMax);
  if (query.recordedBy) params.set("recordedBy", query.recordedBy);
  if (query.postedBy) params.set("postedBy", query.postedBy);
  if (query.seasonId) params.set("seasonId", query.seasonId);
  if (query.budget) params.set("budget", query.budget);
  if (query.search.trim()) params.set("q", query.search.trim());
  if (query.view !== defaultQuery.view) params.set("view", query.view);
  if (query.page > 1) params.set("page", String(query.page));
  if (query.pageSize !== defaultQuery.pageSize) params.set("pageSize", String(query.pageSize));
  if (query.sortBy !== defaultQuery.sortBy) params.set("sort", query.sortBy);
  if (query.sortDirection !== defaultQuery.sortDirection) params.set("dir", query.sortDirection);
  return params;
}

/** The filters every analytic panel shares (no table paging or sorting). */
export function filterParams(query: ExpenseUiQuery, extra: Partial<Record<"granularity", string>> = {}) {
  const params = new URLSearchParams();
  params.set("period", query.period);
  if (query.period === "custom" && query.startDate && query.endDate) {
    params.set("startDate", query.startDate);
    params.set("endDate", query.endDate);
  }
  params.set("compare", query.compare);
  if (query.categoryIds.length) params.set("categoryIds", query.categoryIds.join(","));
  if (query.sourceModules.length) params.set("sourceModules", query.sourceModules.join(","));
  params.set("classes", query.classes.join(","));
  if (query.amountMin) params.set("amountMin", query.amountMin);
  if (query.amountMax) params.set("amountMax", query.amountMax);
  if (query.recordedBy) params.set("recordedBy", query.recordedBy);
  if (query.postedBy) params.set("postedBy", query.postedBy);
  if (query.seasonId) params.set("seasonId", query.seasonId);
  if (query.budget) params.set("budget", query.budget);
  if (query.search.trim()) params.set("search", query.search.trim());
  for (const [key, value] of Object.entries(extra)) if (value) params.set(key, value);
  return params;
}

export function recordParams(query: ExpenseUiQuery) {
  const params = filterParams(query);
  params.set("view", query.view);
  params.set("page", String(query.page));
  params.set("pageSize", String(query.pageSize));
  params.set("sortBy", query.sortBy);
  params.set("sortDirection", query.sortDirection);
  return params;
}

/** How many of the "More filters" are set, for the badge on the toggle. */
export function moreFilterCount(query: ExpenseUiQuery) {
  return [query.amountMin || query.amountMax, query.recordedBy, query.postedBy, query.seasonId, query.budget, query.view !== "posted" ? query.view : ""].filter(Boolean).length;
}

export function hasActiveFilters(query: ExpenseUiQuery) {
  return buildChips(query, { categories: [], recordedBy: [], postedBy: [], seasons: [] }).length > 0;
}

type NameLookups = {
  categories: Array<{ id: string; name: string }>;
  recordedBy: Array<{ id: string; name: string }>;
  postedBy: Array<{ id: string; name: string }>;
  seasons: Array<{ id: string; name: string }>;
};

export function buildChips(query: ExpenseUiQuery, names: NameLookups): Array<FilterChip<ExpenseUiQuery>> {
  const chips: Array<FilterChip<ExpenseUiQuery>> = [];
  const name = (items: Array<{ id: string; name: string }>, value: string) => items.find((item) => item.id === value)?.name ?? `#${value}`;
  if (query.period !== defaultQuery.period) {
    chips.push({
      key: "period",
      label: query.period === "custom" ? `Period: ${query.startDate} to ${query.endDate}` : `Period: ${periodLabel(query.period)}`,
      clear: { period: defaultQuery.period, startDate: undefined, endDate: undefined, page: 1 },
    });
  }
  if (query.compare !== defaultQuery.compare) {
    chips.push({ key: "compare", label: `Compare: ${compareOptions.find((option) => option.value === query.compare)?.label}`, clear: { compare: defaultQuery.compare, page: 1 } });
  }
  for (const value of query.categoryIds) {
    chips.push({ key: `category-${value}`, label: `Category: ${name(names.categories, value)}`, clear: { categoryIds: query.categoryIds.filter((item) => item !== value), page: 1 } });
  }
  for (const value of query.sourceModules) {
    chips.push({ key: `source-${value}`, label: `Source: ${value}`, clear: { sourceModules: query.sourceModules.filter((item) => item !== value), page: 1 } });
  }
  if (!sameList(query.classes, defaultQuery.classes)) {
    chips.push({ key: "classes", label: `Classification: ${query.classes.map(classLabel).join(", ")}`, clear: { classes: [...defaultQuery.classes], page: 1 } });
  }
  if (query.amountMin || query.amountMax) {
    chips.push({ key: "amount", label: `Amount: ${query.amountMin ? `from ${query.amountMin}` : ""}${query.amountMin && query.amountMax ? " " : ""}${query.amountMax ? `up to ${query.amountMax}` : ""}`, clear: { amountMin: undefined, amountMax: undefined, page: 1 } });
  }
  if (query.recordedBy) chips.push({ key: "recordedBy", label: `Recorded by: ${name(names.recordedBy, query.recordedBy)}`, clear: { recordedBy: undefined, page: 1 } });
  if (query.postedBy) chips.push({ key: "postedBy", label: `Posted by: ${name(names.postedBy, query.postedBy)}`, clear: { postedBy: undefined, page: 1 } });
  if (query.seasonId) chips.push({ key: "season", label: `Season: ${name(names.seasons, query.seasonId)}`, clear: { seasonId: undefined, page: 1 } });
  if (query.budget) chips.push({ key: "budget", label: query.budget === "covered" ? "Budget: covered" : "Budget: no approved line", clear: { budget: undefined, page: 1 } });
  if (query.view !== defaultQuery.view) chips.push({ key: "view", label: `Records: ${viewOptions.find((option) => option.value === query.view)?.label}`, clear: { view: defaultQuery.view, page: 1 } });
  if (query.search.trim()) chips.push({ key: "search", label: `Search: ${query.search.trim()}`, clear: { search: "", page: 1 } });
  return chips;
}

// ---------------------------------------------------------------- formatting

const pesoFormat = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const compactFormat = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", notation: "compact", maximumFractionDigits: 1 });
export const peso = (value: number | null | undefined) => (value === null || value === undefined ? "—" : pesoFormat.format(value));
export const pesoCompact = (value: number) => compactFormat.format(value);
export const signedPeso = (value: number | null) => (value === null ? "—" : `${value > 0 ? "+" : value < 0 ? "−" : ""}${pesoFormat.format(Math.abs(value))}`);
export const percentText = (value: number | null | undefined, signed = false) =>
  value === null || value === undefined ? "N/A" : `${signed && value > 0 ? "+" : value < 0 ? "−" : ""}${new Intl.NumberFormat("en-PH", { maximumFractionDigits: 2 }).format(Math.abs(value))}%`;
export const count = (value: number) => new Intl.NumberFormat("en-PH").format(value);

const dateFormat = new Intl.DateTimeFormat("en-PH", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
export const shortDate = (ymd: string | null) => (ymd ? dateFormat.format(new Date(`${ymd}T00:00:00Z`)) : "—");
export const dateTime = (iso: string) =>
  new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" }).format(new Date(iso));

// ---------------------------------------------------------------- API

const base = "/api/financial-overview/expenses";
type Options = { signal?: AbortSignal };
const get = <T>(path: string, params: URLSearchParams, options: Options) => apiRequest<T>(`${base}/${path}?${params.toString()}`, { signal: options.signal });

export async function getExpenseSummary(query: ExpenseUiQuery, options: Options = {}) {
  const summary = await get<ExpenseSummary>("summary", filterParams(query), options);
  return requireSummaryFields(summary, ["totals.amount", "totals.records", "reconciliation.recognizedExpenseTotal", "secondary.unposted.records"], "expense");
}
export const getExpenseTrends = (query: ExpenseUiQuery, options: Options = {}, granularity?: string) => get<ExpenseTrend>("trends", filterParams(query, { granularity }), options);
export const getExpenseCategories = (query: ExpenseUiQuery, options: Options = {}) => get<ExpenseCategories>("categories", filterParams(query), options);
export const getExpenseSources = (query: ExpenseUiQuery, options: Options = {}) => get<ExpenseSources>("sources", filterParams(query), options);
export const getExpenseDrivers = (query: ExpenseUiQuery, options: Options = {}) => get<ExpenseDrivers>("drivers", filterParams(query), options);
export const getExpenseMatrix = (query: ExpenseUiQuery, options: Options = {}) => get<ExpenseMatrix>("matrix", filterParams(query), options);
export const getExpenseIntegrity = (query: ExpenseUiQuery, options: Options = {}) => get<ExpenseIntegrity>("integrity", filterParams(query), options);
export const getExpenseBudget = (query: ExpenseUiQuery, options: Options = {}) => get<ExpenseBudgetContext>("budget", filterParams(query), options);
export const getExpenseInsights = (query: ExpenseUiQuery, options: Options = {}) => get<ExpenseInsight[]>("insights", filterParams(query), options);
export const getExpenseRecords = (query: ExpenseUiQuery, options: Options = {}) => get<ExpenseRecordsPage>("records", recordParams(query), options);
export const getExpenseOptions = (options: Options = {}) => apiRequest<ExpenseFilterOptions>(`${base}/options`, { signal: options.signal });
export const getExpenseRecord = (id: string, options: Options = {}) => apiRequest<ExpenseRecordDetail>(`${base}/records/${encodeURIComponent(id)}`, { signal: options.signal });

export async function downloadExpenseReport(query: ExpenseUiQuery, kind: ExportKind, format: "xlsx" | "pdf") {
  const params = recordParams(query);
  params.delete("page");
  params.delete("pageSize");
  params.set("kind", kind);
  params.set("format", format);
  let response: Response;
  try {
    response = await fetch(`${env.apiUrl}${base}/export?${params.toString()}`, { credentials: "include" });
  } catch {
    throw new ApiClientError("TrackCOOP could not reach the server. Please try again.", 0);
  }
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new ApiClientError(payload?.message ?? "The report could not be created.", response.status);
  }
  const disposition = response.headers.get("Content-Disposition") ?? "";
  const filename = /filename="([^"]+)"/.exec(disposition)?.[1] ?? `trackcoop-expenses.${format}`;
  return { blob: await response.blob(), filename };
}

export function errorMessage(error: unknown, fallback = "Something went wrong. Please try again.") {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function isAbort(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

/** Hands a downloaded file to the browser. */
export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
