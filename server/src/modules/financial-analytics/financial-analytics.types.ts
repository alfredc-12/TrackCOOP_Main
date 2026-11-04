/**
 * Contract for the Chairman Financial Analytics report.
 *
 * Money crossing this boundary is Philippine pesos with at most two decimals,
 * derived from integer centavos so aggregation never accumulates float error.
 * `null` means "not calculable" (for example a percentage with a zero
 * denominator) and is never replaced by zero.
 */
export const REPORTING_PRESETS = [
  "today", "this-month", "last-month", "last-3-months", "last-6-months",
  "this-quarter", "this-year", "last-year", "all-time", "custom",
] as const;
export type ReportingPreset = (typeof REPORTING_PRESETS)[number];

export const COMPARE_MODES = ["previous", "last-year", "none", "custom"] as const;
export type CompareMode = (typeof COMPARE_MODES)[number];

export const GRANULARITIES = ["auto", "daily", "weekly", "monthly", "quarterly", "yearly"] as const;
export type Granularity = (typeof GRANULARITIES)[number];
export type ResolvedGranularity = Exclude<Granularity, "auto">;

export const RECORD_TYPE_FILTERS = ["all", "Income", "Expense"] as const;
export type RecordTypeFilter = (typeof RECORD_TYPE_FILTERS)[number];
export type OperatingType = "Income" | "Expense";

/** Source modules that may appear in operating analytics. Share Capital is a capital movement and is excluded. */
export const OPERATING_SOURCE_MODULES = ["Manual", "Membership", "Payment", "Rental", "POS", "Document", "Other"] as const;
export type OperatingSourceModule = (typeof OPERATING_SOURCE_MODULES)[number];

export type FinancialAnalyticsFilters = {
  period: ReportingPreset;
  /** Inclusive Asia/Manila calendar dates. */
  start: string;
  end: string;
  compare: CompareMode;
  compareStart: string | null;
  compareEnd: string | null;
  recordType: RecordTypeFilter;
  categoryIds: string[];
  sourceModules: OperatingSourceModule[];
  minAmount: number | null;
  maxAmount: number | null;
  reference: string;
  granularity: Granularity;
  /** Cooperative-local "today" used to resolve presets. */
  asOf: string;
};

export type ComparisonRange = {
  enabled: boolean;
  mode: CompareMode;
  start: string | null;
  end: string | null;
  label: string;
  days: number | null;
  currentDays: number;
  /** Set when the comparison cannot be made or is not equal in length. */
  note: string | null;
};

/** One aggregated fact: eligible records for a day, type, category and source module. */
export type FinancialFact = {
  date: string;
  type: OperatingType;
  categoryId: string;
  source: OperatingSourceModule;
  cents: number;
  count: number;
};

export type CategoryOption = {
  id: string;
  code: string;
  name: string;
  type: "Income" | "Expense" | "Both";
  isActive: boolean;
};

export type IntegrityIssueCode =
  | "unposted"
  | "voided"
  | "corrected-or-reversed"
  | "adjustments"
  | "unmatched-payment-postings"
  | "classification"
  | "pos-reconciliation"
  | "payment-reconciliation"
  | "excluded-capital";

export type IntegrityIssue = {
  code: IntegrityIssueCode;
  title: string;
  /** Neutral wording only: Requires Review, Unposted, Unmatched, Classification Issue, Reconciliation Difference. */
  label: "Requires Review" | "Unposted" | "Unmatched" | "Classification Issue" | "Reconciliation Difference" | "Informational";
  available: boolean;
  count: number;
  amount: number | null;
  dateRange: { from: string; to: string };
  rule: string;
  limitation: string | null;
  /** Affected reference numbers, capped; `truncated` when more exist. */
  references: Array<{ reference: string; date: string | null; amount: number | null; module: string | null }>;
  truncated: boolean;
  modules: string[];
  ledgerQuery: Record<string, string> | null;
  link: { href: string; label: string } | null;
};

export type IntegritySources = {
  postedCount: number;
  issues: IntegrityIssue[];
  reconciliation: Array<{
    module: "POS" | "Rental" | "Membership";
    operationalLabel: string;
    operationalAmount: number | null;
    postedAmount: number;
    difference: number | null;
    operationalCount: number | null;
    postedCount: number;
    available: boolean;
    caveat: string;
  }>;
};

export type CapitalContext = {
  available: boolean;
  totalBalance: number | null;
  addedInPeriod: number | null;
  memberContributions: number | null;
  interestAdditions: number | null;
  otherCredits: number | null;
  deductions: number | null;
  /** Capital-related ledger rows kept out of operating totals. */
  excludedIncome: number;
  excludedExpense: number;
  excludedCount: number;
};

/** Everything the pure engine needs; produced by the repository. */
export type FinancialAnalyticsSources = {
  facts: FinancialFact[];
  categories: CategoryOption[];
  integrity: IntegritySources;
  capital: CapitalContext;
  firstRecordDate: string | null;
  capabilities: Record<string, boolean>;
};

export type Amounts = { income: number; expenses: number; net: number };

export type TrendPoint = {
  key: string;
  label: string;
  from: string;
  to: string;
  income: number;
  expenses: number;
  net: number;
  recordCount: number;
  /** Aligned bucket from the comparison range, if any. */
  previous: Amounts | null;
  change: { income: number; expenses: number; net: number; incomePct: number | null; expensesPct: number | null; netPct: number | null } | null;
  changeBasis: "comparison" | "preceding" | null;
};

export type ShareRow = {
  key: string;
  name: string;
  amount: number;
  share: number | null;
  recordCount: number;
  previousAmount: number | null;
  change: number | null;
  changePct: number | null;
  isNew: boolean;
  /** Amount per trend bucket, aligned with performanceTrend.points. */
  series: number[];
};

export type Concentration = {
  topShare: number | null;
  topName: string | null;
  topTwoShare: number | null;
  topThreeShare: number | null;
  contributors: number;
};

export type BridgeDriver = {
  key: string;
  categoryId: string;
  name: string;
  type: OperatingType;
  current: number;
  previous: number;
  /** Signed effect on net surplus: income change, or the negative of the expense change. */
  effect: number;
  share: number | null;
  status: "new" | "discontinued" | "continuing";
};

export type NetSurplusBridge = {
  available: boolean;
  reason: string | null;
  previousNet: number;
  currentNet: number;
  totalChange: number;
  incomeChange: number;
  expenseChange: number;
  drivers: BridgeDriver[];
  reconciles: boolean;
};

export type MatrixCell = {
  amount: number;
  count: number;
  previousAmount: number | null;
  change: number | null;
  shareOfTotal: number | null;
  shareOfSource: number | null;
};

export type SourceCategoryMatrix = {
  classification: OperatingType;
  sources: OperatingSourceModule[];
  rows: Array<{ categoryId: string; name: string; total: number; count: number; previousTotal: number | null; change: number | null; cells: Record<string, MatrixCell> }>;
  sourceTotals: Record<string, { amount: number; count: number; previousAmount: number | null }>;
  total: number;
  previousTotal: number | null;
  reconciles: boolean;
};

export type SeasonMonth = {
  month: number;
  name: string;
  observations: number;
  years: number[];
  incomeAverage: number | null;
  incomeMedian: number | null;
  expenseAverage: number | null;
  expenseMedian: number | null;
  netAverage: number | null;
  netMedian: number | null;
  highNet: { year: number; value: number } | null;
  lowNet: { year: number; value: number } | null;
};

export type SeasonalPatterns = {
  firstFullMonth: string | null;
  lastFullMonth: string | null;
  completeMonths: number;
  yearsObserved: number;
  minimumYears: number;
  established: boolean;
  statement: string;
  months: SeasonMonth[];
  grid: Array<{ year: number; month: number; income: number; expenses: number; net: number; complete: boolean }>;
  strongest: { income: SeasonMonth | null; expense: SeasonMonth | null; net: SeasonMonth | null };
  weakest: { net: SeasonMonth | null };
};

export type InsightDrill =
  | { kind: "bridge" } | { kind: "income" } | { kind: "expense" } | { kind: "sources" }
  | { kind: "seasonality" } | { kind: "integrity"; code?: IntegrityIssueCode } | { kind: "ledger"; query: Record<string, string> };

export type Insight = {
  id: string;
  title: string;
  value: string;
  period: string;
  comparisonPeriod: string | null;
  subject: string | null;
  explanation: string;
  caveat: string | null;
  priority: number;
  drill: InsightDrill;
};

export type FinancialAnalyticsResult = {
  metadata: {
    generatedAt: string;
    timezone: "Asia/Manila";
    currency: "PHP";
    firstRecordDate: string | null;
    eligibleRecordCount: number;
    definitions: Array<{ metric: string; definition: string }>;
    limitations: Array<{ code: string; message: string }>;
    insightRules: Array<{ id: string; rule: string }>;
    thresholds: Record<string, number>;
  };
  filters: FinancialAnalyticsFilters;
  periodLabel: string;
  comparisonLabel: string | null;
  comparison: ComparisonRange;
  options: { categories: CategoryOption[]; sourceModules: readonly OperatingSourceModule[] };
  overview: {
    /** Record Type filter in force. Net surplus and margin are N/A unless it is "all". */
    scope: RecordTypeFilter;
    income: number;
    expenses: number;
    net: number | null;
    margin: number | null;
    previous: { income: number; expenses: number; net: number | null; margin: number | null } | null;
    comparisonUnavailableReason: string | null;
    incomeChange: number | null;
    incomeChangePct: number | null;
    expenseChange: number | null;
    expenseChangePct: number | null;
    netChange: number | null;
    netChangePct: number | null;
    marginChangePoints: number | null;
    largestExpenseCategory: { name: string; amount: number; share: number | null } | null;
    recordCount: number;
    incomeCount: number;
    expenseCount: number;
    state: "ok" | "no-records" | "no-income" | "no-expenses" | "deficit";
  };
  performanceTrend: {
    granularity: ResolvedGranularity;
    requested: Granularity;
    note: string | null;
    coverageStart: string | null;
    points: TrendPoint[];
  };
  incomeSources: { total: number; rows: ShareRow[]; concentration: Concentration };
  incomeCategories: { total: number; rows: ShareRow[] };
  expenseCategories: {
    total: number;
    rows: ShareRow[];
    count: number;
    averageAmount: number | null;
    concentration: { top1: number | null; top3: number | null; top5: number | null };
    previousConcentration: { top1Name: string | null; top3: number | null } | null;
  };
  netSurplusBridge: NetSurplusBridge;
  seasonalPatterns: SeasonalPatterns;
  recordIntegrity: IntegritySources & { refreshedAt: string };
  operationalSources: Array<{
    module: "POS" | "Rental";
    income: number;
    share: number | null;
    previousIncome: number | null;
    change: number | null;
    recordCount: number;
    categories: Array<{ name: string; amount: number }>;
    link: string;
  }>;
  insights: Insight[];
  capitalContext: CapitalContext;
};

export type PeriodDetail = {
  from: string;
  to: string;
  income: number;
  expenses: number;
  net: number;
  recordCount: number;
  incomeCategories: Array<{ name: string; amount: number; count: number }>;
  expenseCategories: Array<{ name: string; amount: number; count: number }>;
  sources: Array<{ source: string; income: number; expenses: number }>;
  daily: Array<{ date: string; income: number; expenses: number; net: number; count: number }>;
  previous: Amounts | null;
};
