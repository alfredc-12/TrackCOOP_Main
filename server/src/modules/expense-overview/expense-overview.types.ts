import type { ClassificationBasis, ExpenseClass } from "./expense-classification";
import type { ComparisonMode, Granularity, PeriodPreset } from "./expense-periods";
import type { RentalExpenseEntry } from "./expense-record-details";
import type { ExpenseRecordView } from "./expense-overview.schema";

/** A closed range of record_date values. A null start means "from the beginning". */
export type ExpenseRange = { startDate: string | null; endDate: string };

export type ExpenseCapabilities = {
  /** financial_records.season_id and the seasons table exist. */
  seasons: boolean;
  /** budgets and budget_lines exist. */
  budgets: boolean;
};

export type CountAmount = { records: number; amount: number };

export type ExpensePeriodInfo = {
  preset: PeriodPreset;
  label: string;
  today: string;
  /** The selected period as asked for. */
  selected: { startDate: string | null; endDate: string | null };
  /** The elapsed part of it that every figure on the page is computed from. */
  effective: { startDate: string | null; endDate: string; days: number | null; periodDays: number | null; partial: boolean };
  compare: ComparisonMode;
  previous: { startDate: string; endDate: string; days: number } | null;
  comparisonNote: string | null;
};

export type ExpenseSummary = {
  period: ExpensePeriodInfo;
  capabilities: ExpenseCapabilities;
  totals: { amount: number; records: number; averageAmount: number | null };
  previousTotals: { amount: number; records: number } | null;
  change: { amount: number | null; percent: number | null; basis: "ok" | "no_previous_base" | "no_comparison" };
  largestCategory: { categoryId: string; name: string; amount: number; records: number; share: number | null } | null;
  secondary: {
    unposted: CountAmount;
    voided: CountAmount;
    correctedOrReversed: CountAmount;
    needsClassification: CountAmount;
  };
  reconciliation: ExpenseReconciliation;
  limitations: string[];
};

export type ExpenseReconciliation = {
  selectedClasses: ExpenseClass[];
  classTotals: Array<{ expenseClass: ExpenseClass; records: number; amount: number }>;
  /** Everything counted as a recognized expense (operating + other recognized + capital + unclassified). */
  recognizedExpenseTotal: number;
  /** Posted Expense rows excluding capital-movement rows: the population Financial Analytics reports as expenses. */
  analyticsComparableTotal: number;
  nonExpenseDisbursementTotal: number;
  reconciles: boolean;
};

export type TrendBucket = {
  key: string;
  label: string;
  startDate: string;
  endDate: string;
  amount: number;
  records: number;
  topCategory: { name: string; amount: number } | null;
  previous: { label: string; amount: number; records: number } | null;
};

export type ExpenseTrend = {
  granularity: Granularity;
  buckets: TrendBucket[];
  total: number;
  records: number;
  previousTotal: number | null;
};

export type CategoryTotal = {
  categoryId: string;
  code: string;
  name: string;
  isActive: boolean;
  expenseClass: ExpenseClass;
  amount: number;
  records: number;
  share: number | null;
  previousAmount: number | null;
};

export type ExpenseCategories = { items: CategoryTotal[]; total: number; records: number };

export type SourceTotal = {
  sourceModule: string;
  amount: number;
  records: number;
  share: number | null;
  previousAmount: number | null;
  change: number | null;
};

export type ExpenseSources = { items: SourceTotal[]; total: number };

export type DriverItem = {
  categoryId: string;
  name: string;
  current: number;
  previous: number;
  change: number;
  changePercent: number | null;
  /** This category's change as a share of the total change (null when the total change is zero). */
  contribution: number | null;
  state: "new" | "stopped" | "increase" | "decrease" | "unchanged";
};

export type ExpenseDrivers = {
  available: boolean;
  unavailableReason: string | null;
  currentTotal: number;
  previousTotal: number;
  totalChange: number;
  items: DriverItem[];
  largestIncrease: DriverItem | null;
  largestDecrease: DriverItem | null;
  reconciles: boolean;
};

export type MatrixCell = {
  categoryId: string;
  sourceModule: string;
  amount: number;
  records: number;
  share: number | null;
  previousAmount: number | null;
};

export type ExpenseMatrix = {
  categories: Array<{ categoryId: string; name: string; amount: number; records: number }>;
  sources: Array<{ sourceModule: string; amount: number; records: number }>;
  cells: MatrixCell[];
  total: number;
  records: number;
  reconciles: boolean;
  hasPrevious: boolean;
};

export type ExpenseRecordRow = {
  id: string;
  recordNumber: string;
  recordDate: string;
  categoryId: string;
  categoryCode: string;
  categoryName: string;
  expenseClass: ExpenseClass;
  classificationBasis: ClassificationBasis;
  sourceModule: string;
  sourceRecordId: string | null;
  amount: number;
  recordStatus: "Active" | "Corrected" | "Reversed" | "Voided";
  postingStatus: "Posted" | "Unposted" | "Voided" | "Corrected" | "Reversed";
  description: string;
  recordedBy: { id: string; name: string };
  postedBy: { id: string; name: string } | null;
  season: { id: string; name: string } | null;
  createdAt: string;
};

export type ExpenseRecordsPage = {
  records: ExpenseRecordRow[];
  total: number;
  totalAmount: number;
  page: number;
  pageSize: number;
  view: ExpenseRecordView;
};

export type ExpenseRecordDetail = ExpenseRecordRow & {
  remarks: string | null;
  rental: RentalExpenseEntry | null;
  correctionOf: { id: string; recordNumber: string; recordStatus: string } | null;
  reversalOf: { id: string; recordNumber: string; recordStatus: string } | null;
  correctedBy: Array<{ id: string; recordNumber: string; recordStatus: string }>;
  reversedBy: Array<{ id: string; recordNumber: string; recordStatus: string; amount: number }>;
  history: Array<{ action: string; at: string; by: string | null; description: string | null }>;
  evidence: { available: false; note: string };
  disbursement: { verified: false; note: string };
  budget: { budgetName: string; limitAmount: number } | null;
};

export type IntegrityCheck = {
  id: string;
  label: string;
  /** ok = nothing found, review = needs a person to look, info = worth knowing, not a fault. */
  status: "ok" | "review" | "info";
  records: number;
  amount: number;
  description: string;
  /** How to open the matching rows in the records table. */
  drill: { view?: ExpenseRecordView; classes?: ExpenseClass[] } | null;
};

export type ExpenseIntegrity = { checks: IntegrityCheck[]; reviewCount: number };

export type BudgetContextLine = {
  budgetLineId: string;
  budgetId: string;
  budgetName: string;
  categoryId: string;
  categoryName: string;
  seasonName: string | null;
  coverageStart: string;
  coverageEnd: string;
  limitAmount: number;
  warningPercentage: number;
  hardLimit: boolean;
  spentAmount: number;
  records: number;
  utilization: number | null;
  remaining: number;
  state: "within" | "warning" | "over" | "no_limit";
};

export type ExpenseBudgetContext = {
  available: boolean;
  unavailableReason: string | null;
  lines: BudgetContextLine[];
  unbudgeted: { categories: Array<{ categoryId: string; name: string; amount: number; records: number }>; amount: number; records: number };
};

export type ExpenseInsight = {
  id: string;
  text: string;
  basis: string;
  drill: { categoryId?: string; view?: ExpenseRecordView; classes?: ExpenseClass[]; panel?: "drivers" | "integrity" | "budget" } | null;
};

export type ExpenseFilterOptions = {
  capabilities: ExpenseCapabilities;
  categories: Array<{ id: string; code: string; name: string; isActive: boolean; expenseClass: ExpenseClass; records: number }>;
  sourceModules: Array<{ value: string; records: number }>;
  classes: Array<{ value: ExpenseClass; records: number }>;
  recordedBy: Array<{ id: string; name: string }>;
  postedBy: Array<{ id: string; name: string }>;
  seasons: Array<{ id: string; name: string }>;
};
