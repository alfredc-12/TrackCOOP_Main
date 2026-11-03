import { manilaToday, utcBoundary } from "../../utils/manila-calendar";
export { manilaToday, utcBoundary } from "../../utils/manila-calendar";
import { z } from "zod";
import { AppError } from "../../utils/app-error";
export const periods = ["today", "yesterday", "last7", "last30", "month", "lastMonth", "year", "custom", "all"] as const;
export const purposeOptions = ["Associate Membership Fee", "Share Capital", "Rental", "POS/Product", "Preorder", "Bulk Order", "Document/Certificate", "Other"] as const;
const text = z.string().trim().max(190).default("");
const amount = z.string().regex(/^\d{1,12}(\.\d{1,2})?$/).optional();
export const financeFilterSchema = z.object({
  page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(10),
  search: text, period: z.enum(periods).default("month"), start: z.iso.date().optional(), end: z.iso.date().optional(),
  dateType: z.enum(["submitted", "paid", "validated"]).default("submitted"),
  environment: z.enum(["Operational", "All", "Live", "Test", "Manual"]).default("Operational"),
  status: z.enum(["", "Pending", "Needs Clarification", "Validated", "Rejected", "Reversed"]).default(""),
  view: z.enum(["", "manual", "validations", "reversals", "gateway", "exceptions"]).default(""),
  purpose: z.enum(["", ...purposeOptions]).default(""), channel: z.enum(["", "PayMongo", "Cash", "Manual GCash", "Bank Transfer", "Other"]).default(""),
  validationSource: z.enum(["", "Manual Bookkeeper", "PayMongo Webhook", "System"]).default(""),
  minAmount: amount, maxAmount: amount, memberId: z.string().regex(/^\d+$/).optional(), reference: text,
  failedEvents: z.enum(["", "yes"]).default(""), receipt: z.enum(["", "Pending", "Processing", "Generated", "Failed", "Missing"]).default(""),
  financialPosting: z.enum(["", "Missing", "Posted", "Duplicate"]).default(""), capitalPosting: z.enum(["", "Missing", "Posted", "Duplicate"]).default(""),
  eligibilityOnly: z.enum(["", "yes"]).default(""),
  membershipType: z.enum(["", "Associate", "True Member"]).default(""), barangay: text, sector: text,
  stage: z.enum(["", "none", "belowInitial", "initialToFull", "fullToMax", "atMax", "aboveMax"]).default(""),
  deadline: z.enum(["", "met", "dueSoon", "overdue", "missing", "na"]).default(""),
  reconciliation: z.enum(["", "reconciled", "review", "noAccount"]).default(""),
  balanceMin: amount, balanceMax: amount, asOf: z.iso.date().optional(),
  dueSoonDays: z.coerce.number().int().min(1).max(90).default(7),
  transactionGroup: z.enum(["", "contributions"]).default(""),
  transactionType: text, direction: z.enum(["", "Credit", "Debit"]).default(""),
  transactionStatus: z.enum(["", "Posted", "Reversed"]).default(""),
  sortBy: z.enum(["date", "name", "amount", "balance", "reference"]).default("date"), sortDirection: z.enum(["asc", "desc"]).default("desc"),
});
export type FinanceFilters = z.infer<typeof financeFilterSchema>;
export type DateScope = { start: string | null; end: string | null; today: string; asOf: string; historical: boolean; patronageAvailable?: boolean };
const shiftDays = (s: string, n: number) => new Date(Date.parse(`${s}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
export function dateScope(f: FinanceFilters, now = new Date()): DateScope {
  const today = manilaToday(now), year = today.slice(0, 4), month = `${today.slice(0, 7)}-01`;
  let start: string | null = null, end: string | null = today;
  switch (f.period) {
    case "today": start = today; break;
    case "yesterday": start = end = shiftDays(today, -1); break;
    case "last7": start = shiftDays(today, -6); break;
    case "last30": start = shiftDays(today, -29); break;
    case "month": start = month; break;
    case "lastMonth": end = shiftDays(month, -1); start = `${end.slice(0, 7)}-01`; break;
    case "year": start = `${year}-01-01`; break;
    case "custom": start = f.start ?? null; end = f.end ?? null; if (!start || !end) throw new AppError("Choose both reporting dates.", 422, "FINANCE_DATE_RANGE"); break;
    case "all": end = null; break;
  }
  if (start && end && start > end) throw new AppError("Reporting start must be on or before its end.", 422, "FINANCE_DATE_RANGE");
  if (end && end > today) throw new AppError("Future reporting dates are unavailable.", 422, "FINANCE_DATE_RANGE");
  for (const [a,b] of [[f.minAmount,f.maxAmount],[f.balanceMin,f.balanceMax]]) if (a && b && cents(a) > cents(b)) throw new AppError("Minimum amount exceeds maximum amount.", 422, "FINANCE_AMOUNT_RANGE");
  const asOf = f.asOf ?? today;
  if (asOf > today) throw new AppError("Future balance dates are unavailable.", 422, "FINANCE_DATE_RANGE");
  return { start, end, today, asOf, historical: asOf !== today };
}
export function cents(value: string) { const [whole, fraction = ""] = value.split("."); const negative = whole.startsWith("-"); return BigInt(whole) * BigInt(100) + (negative ? BigInt(-1) : BigInt(1)) * BigInt(fraction.padEnd(2,"0").slice(0,2)); }
export function decimal(value: unknown): string { if (value === null || value === undefined) return "0.00"; const n = String(value); if (!/^-?\d+(\.\d{1,2})?$/.test(n)) throw new Error("Invalid database monetary value"); const [a,b=""] = n.split("."); return `${a}.${b.padEnd(2,"0")}`; }
export type SqlFilter = { clauses: string[]; values: Array<string | number> };
export function addDate(q: SqlFilter, column: string, scope: Pick<DateScope,"start"|"end">, timestamp: boolean) {
  if (scope.start) { q.clauses.push(`${column} >= ?`); q.values.push(timestamp ? utcBoundary(scope.start) : scope.start); }
  if (scope.end) { q.clauses.push(`${column} < ?`); q.values.push(timestamp ? utcBoundary(scope.end,true) : shiftDays(scope.end,1)); }
}
export const whereSql = (q: SqlFilter) => q.clauses.length ? ` WHERE ${q.clauses.join(" AND ")}` : "";

/** Reject cross-view parameters rather than displaying chips for filters a report cannot apply. */
export function validateFinanceKind(filters: FinanceFilters, kind: "payments" | "capital") {
  const unsupported: Array<keyof FinanceFilters> = kind === "payments"
    ? ["membershipType", "barangay", "sector", "stage", "deadline", "reconciliation", "balanceMin", "balanceMax", "asOf", "transactionType", "direction", "transactionStatus", "eligibilityOnly", "transactionGroup"]
    : ["view", "purpose", "validationSource", "failedEvents", "receipt", "financialPosting", "capitalPosting"];
  const active = unsupported.filter(key => filters[key] !== "" && filters[key] !== undefined);
  if (active.length || (kind === "capital" && (filters.status === "Needs Clarification" || filters.dateType !== "submitted")) || (kind === "payments" && (filters.dueSoonDays !== 7 || filters.sortBy === "balance"))) {
    throw new AppError("One or more filters do not apply to this finance view. Clear those filters and try again.", 422, "FINANCE_FILTER_COMBINATION");
  }
  return filters;
}
