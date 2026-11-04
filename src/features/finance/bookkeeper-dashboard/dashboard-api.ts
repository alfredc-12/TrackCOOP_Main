"use client";

import { apiRequest } from "@/lib/api-client";

export type DashboardPeriodKey = "today" | "week" | "month" | "quarter" | "year" | "custom";

export type PercentChange = {
  available: boolean;
  percent: string | null;
  direction: "up" | "down" | "flat" | null;
  absolute: string;
  reason: "no-previous-value" | null;
};

export type DashboardSectionKey =
  | "attention"
  | "overview"
  | "trend"
  | "incomeBySource"
  | "memberCapitalReceived"
  | "expenseByCategory"
  | "member"
  | "recent";

export type AttentionItem = {
  id: string;
  referenceNumber: string;
  payer: string | null;
  purpose: string;
  channel: string;
  amount: string;
  status: string;
  submittedAt: string;
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
  income: string;
  expenses: string;
  net: string;
  incomeCount: number;
  expenseCount: number;
  previous: {
    income: string;
    expenses: string;
    net: string;
    start: string;
    end: string;
    label: string;
  };
  change: PercentChange;
  adjustments: {
    total: string;
    count: number;
    reversalTotal: string;
    reversalCount: number;
  };
};

export type TrendPoint = {
  month: string;
  income: string;
  expenses: string;
  net: string;
};

export type SourceKey = "pos" | "rental" | "membership" | "donations" | "other";

export type IncomeSourceItem = {
  key: SourceKey;
  label: string;
  amount: string;
  count: number;
  sharePercent: string | null;
};

export type ExpenseCategoryItem = {
  id: string;
  name: string;
  amount: string;
  count: number;
  sharePercent: string | null;
  previousAmount: string;
  change: PercentChange;
};

export type DashboardMember = {
  capitalBalance: string;
  capitalHolders: number;
  patronageOutstanding: string;
  patronageAllocations: number;
  interestAwaitingAction: {
    withdrawalCount: number;
    withdrawalAmount: string;
    capitalizationCount: number;
    capitalizationAmount: string;
  };
};

export type RecentRecord = {
  id: string;
  recordNumber: string;
  date: string;
  source: string;
  category: string;
  recordType: "Income" | "Expense" | "Adjustment";
  amount: string;
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
  incomeBySource: { total: string; items: IncomeSourceItem[] } | null;
  memberCapitalReceived: { net: string; gross: string; reversals: string; count: number } | null;
  expenseByCategory: { total: string; items: ExpenseCategoryItem[] } | null;
  member: DashboardMember | null;
  recent: RecentRecord[] | null;
  errors: Partial<Record<DashboardSectionKey, string>>;
};

export type DashboardQueryInput = {
  period: DashboardPeriodKey;
  start?: string;
  end?: string;
};

export function getBookkeeperDashboard(
  query: DashboardQueryInput,
  options: { signal?: AbortSignal } = {},
) {
  const params = new URLSearchParams({ period: query.period });
  if (query.period === "custom") {
    if (query.start) params.set("start", query.start);
    if (query.end) params.set("end", query.end);
  }
  return apiRequest<BookkeeperDashboard>(
    `/api/bookkeeper/financial-dashboard?${params.toString()}`,
    { signal: options.signal },
  );
}

