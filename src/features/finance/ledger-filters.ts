/** Drill-down filters accepted by the Financial Ledger; all optional and validated before they reach the API. */
export type LedgerFilters = {
  startDate?: string; endDate?: string; financialCategoryIds?: string[]; sourceModules?: string[];
  recordType?: "Income" | "Expense" | "Adjustment"; recordStatus?: "Active" | "Corrected" | "Reversed" | "Voided"; posting?: "posted" | "unposted"; search?: string;
};
const LEDGER_SOURCES = ["Manual", "Membership", "Payment", "Share Capital", "Rental", "POS", "Document", "Other"];
export function parseLedgerFilters(raw: Record<string, string | string[] | undefined>): LedgerFilters {
  const one = (key: string) => { const value = raw[key]; return typeof value === "string" ? value : Array.isArray(value) ? value[0] : undefined; };
  const date = (key: string) => { const value = one(key); return value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) ? value : undefined; };
  const list = (key: string) => (one(key) ?? "").split("|").filter(Boolean);
  const pick = <T extends string>(key: string, allowed: readonly T[]) => { const value = one(key); return allowed.includes(value as T) ? (value as T) : undefined; };
  const filters: LedgerFilters = {
    startDate: date("startDate"), endDate: date("endDate"),
    financialCategoryIds: list("financialCategoryIds").filter(id => /^\d{1,10}$/.test(id)), sourceModules: list("sourceModules").filter(source => LEDGER_SOURCES.includes(source)),
    recordType: pick("recordType", ["Income", "Expense", "Adjustment"] as const), recordStatus: pick("recordStatus", ["Active", "Corrected", "Reversed", "Voided"] as const),
    posting: pick("posting", ["posted", "unposted"] as const), search: one("search")?.trim().slice(0, 190) || undefined,
  };
  if (filters.startDate && filters.endDate && filters.startDate > filters.endDate) { delete filters.startDate; delete filters.endDate; }
  if (!filters.financialCategoryIds?.length) delete filters.financialCategoryIds;
  if (!filters.sourceModules?.length) delete filters.sourceModules;
  for (const key of Object.keys(filters) as Array<keyof LedgerFilters>) if (filters[key] === undefined) delete filters[key];
  return filters;
}
