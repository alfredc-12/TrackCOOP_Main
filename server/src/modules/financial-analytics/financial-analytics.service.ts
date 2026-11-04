import { closeAllTime } from "./financial-analytics.filters";
import { createFinancialAnalyticsEngine } from "./financial-analytics.engine";
import { createFinancialAnalyticsRepository } from "./financial-analytics.repository";
import type { FinancialAnalyticsFilters, FinancialAnalyticsSources } from "./financial-analytics.types";

type Repository = Pick<ReturnType<typeof createFinancialAnalyticsRepository>, "firstRecordDate" | "load">;

export function createFinancialAnalyticsService(repository: Repository = createFinancialAnalyticsRepository(), clock: () => Date = () => new Date()) {
  async function prepare(requested: FinancialAnalyticsFilters) {
    const first = await repository.firstRecordDate(requested.asOf);
    const filters = closeAllTime(requested, first);
    const sources: FinancialAnalyticsSources = await repository.load(filters, first);
    return { filters, engine: createFinancialAnalyticsEngine(sources, filters, clock()) };
  }
  return {
    async report(requested: FinancialAnalyticsFilters) { return (await prepare(requested)).engine.result; },
    /** Both classifications are returned so the drawer can switch without another request. */
    async matrix(requested: FinancialAnalyticsFilters) {
      const { filters, engine } = await prepare(requested);
      const { periodLabel, comparison, comparisonLabel } = engine.result;
      return { filters, periodLabel, comparisonLabel, comparison, income: engine.matrix("Income"), expense: engine.matrix("Expense") };
    },
    async period(requested: FinancialAnalyticsFilters, window: { from: string; to: string }) {
      const { engine } = await prepare(requested);
      return engine.periodDetail(window);
    },
    /** Everything the workbook needs, computed once from one consistent read. */
    async workbookSource(requested: FinancialAnalyticsFilters, window?: { from: string; to: string }) {
      const { filters, engine } = await prepare(requested);
      return { report: engine.result, income: engine.matrix("Income"), expense: engine.matrix("Expense"), period: window ? engine.periodDetail(window) : null, filters };
    },
  };
}
export type FinancialAnalyticsService = ReturnType<typeof createFinancialAnalyticsService>;
