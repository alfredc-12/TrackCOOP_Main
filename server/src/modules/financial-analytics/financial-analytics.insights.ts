import type {
  Concentration, FinancialAnalyticsResult, Insight, IntegrityIssue, NetSurplusBridge, SeasonalPatterns,
} from "./financial-analytics.types";

/**
 * Documented, configurable thresholds. An observation is only surfaced when it clears the relevant
 * threshold; nothing is hidden by any other rule. These describe records; they are not statistical tests.
 */
export const INSIGHT_THRESHOLDS = {
  /** Minimum percentage change in income or expenses worth reporting. */
  minChangePercent: 10,
  /** Minimum absolute change, in pesos, worth reporting. */
  minChangeAmount: 1000,
  /** Share of recorded income, in percent, at which a source is described as the majority contributor. */
  concentrationShare: 50,
  /** Minimum share of the net surplus change, in percent, for a category to be called out. */
  driverShareOfChange: 25,
  /** Observations per month-of-year needed before seasonal language is used. */
  seasonalityMinYears: 3,
  /** A month must average at least this multiple of the typical month to be called high. */
  seasonalSpread: 1.25,
  /** Shift, in percentage points, of the three largest expense categories' share that is reported. */
  expenseShiftPoints: 10,
  /** Maximum number of observations shown. */
  maxInsights: 6,
} as const;

export const INSIGHT_RULES: Array<{ id: string; rule: string }> = [
  { id: "deficit", rule: "Priority 100. Shown when recorded income minus recorded expenses is below zero for the selected period." },
  { id: "integrity", rule: "Priority 90. Shown when any record-integrity check lists records that require review." },
  { id: "expenses-outpaced-income", rule: `Priority 80. Expenses rose by at least ${INSIGHT_THRESHOLDS.minChangePercent}% and ₱${INSIGHT_THRESHOLDS.minChangeAmount.toLocaleString("en-PH")}, faster than income.` },
  { id: "surplus-driver", rule: `Priority 75. One category accounts for at least ${INSIGHT_THRESHOLDS.driverShareOfChange}% of the net surplus change and at least ₱${INSIGHT_THRESHOLDS.minChangeAmount.toLocaleString("en-PH")}.` },
  { id: "income-change", rule: `Priority 70. Income changed by at least ${INSIGHT_THRESHOLDS.minChangePercent}% and ₱${INSIGHT_THRESHOLDS.minChangeAmount.toLocaleString("en-PH")}.` },
  { id: "income-concentration", rule: `Priority 65. One source accounts for at least ${INSIGHT_THRESHOLDS.concentrationShare}% of recorded income.` },
  { id: "expense-shift", rule: `Priority 55. The largest expense category changed, or the top three categories' share moved by at least ${INSIGHT_THRESHOLDS.expenseShiftPoints} percentage points.` },
  { id: "seasonality", rule: `Priority 45. At least ${INSIGHT_THRESHOLDS.seasonalityMinYears} comparable years exist for every calendar month and a month averages at least ${INSIGHT_THRESHOLDS.seasonalSpread}× the typical month.` },
];

const peso = (value: number) => new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 2 }).format(value);
const signedPeso = (value: number) => `${value < 0 ? "−" : "+"}${peso(Math.abs(value))}`;
const percent = (value: number) => `${new Intl.NumberFormat("en-PH", { maximumFractionDigits: 1 }).format(value)}%`;

type Core = Pick<FinancialAnalyticsResult, "overview" | "incomeSources" | "expenseCategories" | "netSurplusBridge" | "seasonalPatterns" | "recordIntegrity" | "periodLabel" | "comparisonLabel" | "comparison" | "filters">;

export function buildInsights(core: Core): Insight[] {
  const t = INSIGHT_THRESHOLDS;
  const { overview, periodLabel, comparisonLabel } = core;
  const insights: Insight[] = [];
  const base = (id: string, title: string, value: string, explanation: string, priority: number, drill: Insight["drill"], extra: Partial<Insight> = {}): Insight =>
    ({ id, title, value, period: periodLabel, comparisonPeriod: comparisonLabel, subject: null, explanation, caveat: null, priority, drill, ...extra });
  const scopeAll = overview.scope === "all";

  if (scopeAll && overview.net !== null && overview.net < 0) {
    insights.push(base("deficit", "Recorded net surplus is negative", `${signedPeso(overview.net)} (recorded deficit)`,
      `Recorded operating income ${peso(overview.income)} − recorded operating expenses ${peso(overview.expenses)}.`, 100, { kind: "bridge" },
      { caveat: "Indicative, based on posted ledger records only; not an audited result." }));
  }

  const review = core.recordIntegrity.issues.filter(issue => issue.available && issue.count > 0 && issue.label !== "Informational");
  if (review.length) {
    const total = review.reduce((sum, issue) => sum + issue.count, 0);
    insights.push(base("integrity", "Some financial records require review", `${total.toLocaleString("en-PH")} record${total === 1 ? "" : "s"} across ${review.length} check${review.length === 1 ? "" : "s"}`,
      review.map((issue: IntegrityIssue) => `${issue.title}: ${issue.count}`).join("; ") + ".", 90, { kind: "integrity", code: review[0].code },
      { caveat: "A flagged record does not mean money is missing; it means the ledger and a related record do not yet agree or are incomplete." }));
  }

  const { previous } = overview;
  if (previous && overview.incomeChangePct !== null && overview.expenseChangePct !== null && overview.expenseChange !== null
    && overview.expenseChange >= t.minChangeAmount && overview.expenseChangePct >= t.minChangePercent && overview.expenseChangePct > overview.incomeChangePct) {
    insights.push(base("expenses-outpaced-income", "Recorded expenses grew faster than recorded income",
      `Expenses ${signedPeso(overview.expenseChange)} (${percent(overview.expenseChangePct)}) vs income ${percent(overview.incomeChangePct)}`,
      "Percentage change = (current − comparison) ÷ comparison × 100, for each of income and expenses.", 80, { kind: "expense" },
      { caveat: "A rise in expenses is not necessarily unfavorable; review the category drivers for context." }));
  }

  const bridge: NetSurplusBridge = core.netSurplusBridge;
  const top = bridge.available ? bridge.drivers[0] : undefined;
  if (top && bridge.totalChange !== 0 && Math.abs(top.effect) >= t.minChangeAmount && Math.abs(top.effect) / Math.abs(bridge.totalChange) * 100 >= t.driverShareOfChange) {
    insights.push(base("surplus-driver", `${top.name} contributed most to the net surplus change`,
      `${signedPeso(top.effect)} of a ${signedPeso(bridge.totalChange)} change`,
      `${top.type === "Income" ? "Income" : "Expense"} category change (${peso(top.current)} vs ${peso(top.previous)}), signed so expense increases lower the surplus.`, 75, { kind: "bridge" },
      { subject: top.name, caveat: "Describes which category moved numerically; it does not establish why." }));
  }

  if (previous && overview.incomeChange !== null && overview.incomeChangePct !== null
    && Math.abs(overview.incomeChange) >= t.minChangeAmount && Math.abs(overview.incomeChangePct) >= t.minChangePercent) {
    insights.push(base("income-change", `Recorded income ${overview.incomeChange > 0 ? "increased" : "decreased"} against the comparison period`,
      `${signedPeso(overview.incomeChange)} (${overview.incomeChangePct > 0 ? "+" : ""}${percent(overview.incomeChangePct)})`,
      `Recorded operating income ${peso(overview.income)} vs ${peso(previous.income)}.`, 70, { kind: "income" }));
  }

  const concentration: Concentration = core.incomeSources.concentration;
  if (concentration.topShare !== null && concentration.topName && concentration.topShare >= t.concentrationShare) {
    insights.push(base("income-concentration", `${concentration.topName} accounts for ${percent(concentration.topShare)} of recorded income`,
      `${percent(concentration.topShare)} of ${peso(core.incomeSources.total)}`, "Largest source income ÷ total recorded operating income × 100.", 65, { kind: "sources" },
      { subject: concentration.topName, caveat: concentration.contributors === 1 ? "Only one source recorded income in this period." : "Concentration is descriptive and is not a risk score." }));
  }

  const expenses = core.expenseCategories;
  const prior = expenses.previousConcentration;
  if (prior && expenses.rows[0]) {
    const changedTop = prior.top1Name !== null && expenses.rows[0].name !== prior.top1Name;
    const shift = expenses.concentration.top3 !== null && prior.top3 !== null ? expenses.concentration.top3 - prior.top3 : null;
    if (changedTop || (shift !== null && Math.abs(shift) >= t.expenseShiftPoints)) {
      insights.push(base("expense-shift", changedTop ? `${expenses.rows[0].name} is now the largest expense category` : "Expense concentration shifted",
        `${shift !== null ? `Top three share ${shift > 0 ? "+" : ""}${new Intl.NumberFormat("en-PH", { maximumFractionDigits: 1 }).format(shift)} points` : `Previously ${prior.top1Name}`}`,
        "Share of recorded operating expenses held by the largest categories, current vs comparison.", 55, { kind: "expense" }, { subject: expenses.rows[0].name }));
    }
  }

  const seasonal: SeasonalPatterns = core.seasonalPatterns;
  if (seasonal.established && seasonal.strongest.expense) {
    const averages = seasonal.months.map(month => month.expenseAverage).filter((value): value is number => value !== null);
    const typical = averages.reduce((sum, value) => sum + value, 0) / (averages.length || 1);
    const month = seasonal.strongest.expense;
    if (typical > 0 && month.expenseAverage !== null && month.expenseAverage >= typical * t.seasonalSpread) {
      insights.push(base("seasonality", `${month.name} has historically recorded the highest expenses`,
        `${peso(month.expenseAverage)} average across ${month.observations} years`,
        `Average of ${month.name} expenses over ${month.observations} complete comparable years vs ${peso(typical)} for a typical month.`, 45, { kind: "seasonality" },
        { period: "Historical months", comparisonPeriod: null, subject: month.name, caveat: "Reflects recorded ledger timing; it is not attributed to agricultural seasons or used to forecast." }));
    }
  }

  return insights.sort((a, b) => b.priority - a.priority).slice(0, t.maxInsights);
}
