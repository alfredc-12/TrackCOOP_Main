import type { PercentChange } from "./bookkeeper-dashboard.money";

/** Decimal peso string with exactly two decimals, for example "1250.05". Never a float. */
export type Money = string;

export type DashboardSectionKey = "attention" | "overview" | "trend" | "incomeBySource" | "memberCapitalReceived" | "expenseByCategory" | "member" | "recent";

export type AttentionItem = {
  id: string;
  referenceNumber: string;
  payer: string | null;
  purpose: string;
  channel: string;
  amount: Money;
  status: string;
  submittedAt: string;
  /** "exception" when a reliably detectable posting/receipt/gateway problem exists. */
  reason: "manual-review" | "clarification" | "exception";
};

export type DashboardAttention = {
  basis: "current-backlog";
  awaitingReview: number;
  awaitingGateway: number;
  needsClarification: number;
  approvedToday: number;
  recordsNeedingAttention: number;
  testPaymentsExcluded: number;
  items: AttentionItem[];
};

export type DashboardOverview = {
  income: Money;
  expenses: Money;
  /** Operating income minus operating expenses. Adjustments are never netted in. */
  net: Money;
  incomeCount: number;
  expenseCount: number;
  previous: { income: Money; expenses: Money; net: Money; start: string; end: string; label: string };
  change: PercentChange;
  adjustments: { total: Money; count: number; reversalTotal: Money; reversalCount: number };
};

export type TrendPoint = { month: string; income: Money; expenses: Money; net: Money };

export type SourceKey = "pos" | "rental" | "membership" | "donations" | "other";
export type IncomeSourceItem = { key: SourceKey; label: string; amount: Money; count: number; sharePercent: string | null };

export type ExpenseCategoryItem = {
  id: string;
  name: string;
  amount: Money;
  count: number;
  sharePercent: string | null;
  previousAmount: Money;
  change: PercentChange;
};

export type DashboardMember = {
  capitalBalance: Money;
  capitalHolders: number;
  patronageOutstanding: Money;
  patronageAllocations: number;
  interestAwaitingAction: {
    withdrawalCount: number;
    withdrawalAmount: Money;
    capitalizationCount: number;
    capitalizationAmount: Money;
  };
};

export type RecentRecord = {
  id: string;
  recordNumber: string;
  date: string;
  source: string;
  category: string;
  recordType: "Income" | "Expense" | "Adjustment";
  amount: Money;
  status: "Posted" | "Unposted" | "Reversed" | "Voided" | "Corrected";
  classification: "operating" | "capital" | "adjustment" | "excluded";
  paymentReferenceId: string | null;
};

export type BookkeeperDashboard = {
  scope: {
    period: string;
    label: string;
    start: string;
    end: string;
    previousStart: string;
    previousEnd: string;
    previousLabel: string;
    today: string;
    timezone: "Asia/Manila";
  };
  generatedAt: string;
  attention: DashboardAttention | null;
  overview: DashboardOverview | null;
  trend: TrendPoint[] | null;
  incomeBySource: { total: Money; items: IncomeSourceItem[] } | null;
  memberCapitalReceived: { net: Money; gross: Money; reversals: Money; count: number } | null;
  expenseByCategory: { total: Money; items: ExpenseCategoryItem[] } | null;
  member: DashboardMember | null;
  recent: RecentRecord[] | null;
  /** Sections that failed independently; the rest of the dashboard remains valid. */
  errors: Partial<Record<DashboardSectionKey, string>>;
};

