import type { CategoryOption, FinancialAnalyticsFilters, FinancialAnalyticsSources, FinancialFact } from "./financial-analytics.types";

export const fixtureCategories: CategoryOption[] = [
  { id: "1", code: "POS_SALES", name: "POS Sales", type: "Income", isActive: true },
  { id: "2", code: "RENTAL_INCOME", name: "Equipment Rental", type: "Income", isActive: true },
  { id: "3", code: "DONATIONS_GRANTS", name: "Donations and Grants", type: "Income", isActive: true },
  { id: "4", code: "FUEL", name: "Fuel", type: "Expense", isActive: true },
  { id: "5", code: "SALARIES", name: "Salaries", type: "Expense", isActive: false },
  { id: "6", code: "REPAIRS", name: "Repairs", type: "Expense", isActive: true },
];

const fact = (date: string, type: FinancialFact["type"], categoryId: string, source: FinancialFact["source"], cents: number, count = 1): FinancialFact => ({ date, type, categoryId, source, cents, count });

/** September (comparison): income 15,000.00 expenses 5,000.00. October (current): income 15,000.00 expenses 4,500.00. */
export const fixtureFacts: FinancialFact[] = [
  fact("2026-09-05", "Income", "1", "POS", 1_000_000, 4),
  fact("2026-09-12", "Income", "2", "Rental", 500_000, 2),
  fact("2026-09-15", "Expense", "4", "Manual", 200_000),
  fact("2026-09-20", "Expense", "5", "Manual", 300_000),
  fact("2026-10-03", "Income", "1", "POS", 1_200_000, 5),
  fact("2026-10-10", "Income", "3", "Other", 300_000),
  fact("2026-10-18", "Expense", "4", "Manual", 350_000, 2),
  fact("2026-10-22", "Expense", "6", "Manual", 100_000),
];

export function fixtureSources(patch: Partial<FinancialAnalyticsSources> = {}): FinancialAnalyticsSources {
  return {
    facts: fixtureFacts,
    categories: fixtureCategories,
    firstRecordDate: "2026-09-05",
    capabilities: { financial_records: true },
    capital: { available: true, totalBalance: 100_000, addedInPeriod: 5_000, memberContributions: 4_000, interestAdditions: 1_000, otherCredits: 0, deductions: 0, excludedIncome: 0, excludedExpense: 0, excludedCount: 0 },
    integrity: { postedCount: 8, issues: [], reconciliation: [] },
    ...patch,
  };
}

export function fixtureFilters(patch: Partial<FinancialAnalyticsFilters> = {}): FinancialAnalyticsFilters {
  return {
    period: "custom", start: "2026-10-01", end: "2026-10-31",
    compare: "custom", compareStart: "2026-09-01", compareEnd: "2026-09-30",
    recordType: "all", categoryIds: [], sourceModules: [], minAmount: null, maxAmount: null, reference: "",
    granularity: "monthly", asOf: "2026-11-02", ...patch,
  };
}
