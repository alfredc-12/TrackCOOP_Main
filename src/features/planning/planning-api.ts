import { apiRequest } from "@/lib/api-client";

export type BudgetStatus = "Draft" | "Pending Approval" | "Approved" | "Closed";
export type BudgetLine = {
  id: string;
  financialCategoryId: string;
  categoryName: string;
  seasonId: string | null;
  seasonName: string | null;
  limitAmount: number;
  warningPercentage: number;
  hardLimit: boolean;
  spentAmount: number;
  remainingAmount: number;
  utilizationPercentage: number;
  warning: boolean;
  exceeded: boolean;
};
export type Budget = {
  id: string;
  budgetName: string;
  coverageStart: string;
  coverageEnd: string;
  budgetStatus: BudgetStatus;
  notes: string | null;
  totalLimit: number;
  totalSpent: number;
  totalRemaining: number;
  utilizationPercentage: number;
  lines: BudgetLine[];
};
export type BudgetSummary = {
  approvedBudgetCount: number;
  totalLimit: number;
  totalSpent: number;
  totalRemaining: number;
  utilizationPercentage: number;
  warningCount: number;
  exceededCount: number;
  unbudgetedExpenseTotal: number;
};
export type BudgetLineInput = {
  financialCategoryId: string;
  seasonId?: string | null;
  limitAmount: number;
  warningPercentage?: number;
  hardLimit?: boolean;
};
export type BudgetInput = {
  budgetName: string;
  coverageStart: string;
  coverageEnd: string;
  notes?: string | null;
  lines: BudgetLineInput[];
};

export type Season = {
  id: string;
  seasonName: string;
  seasonType: string;
  seasonYear: number;
  startDate: string;
  endDate: string;
  seasonStatus: "Draft" | "Active" | "Closed";
  description: string | null;
  productionRecordCount: number;
};
export type SeasonInput = Omit<Season, "id" | "seasonStatus" | "productionRecordCount" | "createdAt" | "updatedAt">;
export type ProductionRecord = {
  id: string;
  seasonId: string;
  seasonName: string;
  memberId: string | null;
  memberName: string | null;
  barangay: string | null;
  sector: string;
  cropName: string;
  areaPlanted: number | null;
  areaUnit: string | null;
  quantityProduced: number;
  quantityUnit: string;
  productionCost: number;
  harvestDate: string | null;
  productionStatus: "Draft" | "Recorded" | "Verified" | "Harvested" | "Cancelled";
  remarks: string | null;
};
export type ProductionRecordInput = Omit<ProductionRecord, "id" | "seasonName" | "memberName" | "recordedBy" | "createdAt" | "updatedAt">;
export type SeasonalAnalytics = {
  season: Season | null;
  summary: {
    productionQuantity: number;
    productionCost: number;
    salesTotal: number;
    salesTransactions: number;
    incomeTotal: number;
    expenseTotal: number;
    netResult: number;
    profitMargin: number;
  };
  productionByCrop: Array<{ cropName: string; sector: string; quantityProduced: number; productionCost: number; records: number }>;
  financialByCategory: Array<{ categoryName: string; recordType: "Income" | "Expense"; amount: number; records: number }>;
  monthlyTrend: Array<{ month: string; productionQuantity: number; salesTotal: number; incomeTotal: number; expenseTotal: number; netResult: number }>;
};

export function listBudgets(status?: BudgetStatus) {
  const query = new URLSearchParams({ page: "1", pageSize: "50" });
  if (status) query.set("status", status);
  return apiRequest<Budget[]>(`/api/budgets?${query.toString()}`);
}

export function getBudgetSummary() {
  return apiRequest<BudgetSummary>("/api/budgets/summary");
}

export function createBudget(input: BudgetInput) {
  return apiRequest<Budget>("/api/budgets", { method: "POST", body: JSON.stringify(input) });
}

export function updateBudgetStatus(id: string, action: "submit" | "approve" | "close") {
  return apiRequest<Budget>(`/api/budgets/${encodeURIComponent(id)}/status`, { method: "POST", body: JSON.stringify({ action }) });
}

export function listSeasons(status?: Season["seasonStatus"]) {
  const query = new URLSearchParams({ page: "1", pageSize: "100" });
  if (status) query.set("status", status);
  return apiRequest<Season[]>(`/api/seasons?${query.toString()}`);
}

export function createSeason(input: SeasonInput) {
  return apiRequest<Season>("/api/seasons", { method: "POST", body: JSON.stringify(input) });
}

export function updateSeasonStatus(id: string, action: "activate" | "close") {
  return apiRequest<Season>(`/api/seasons/${encodeURIComponent(id)}/status`, { method: "POST", body: JSON.stringify({ action }) });
}

export function listProductionRecords(seasonId?: string) {
  const query = new URLSearchParams({ page: "1", pageSize: "100" });
  if (seasonId) query.set("seasonId", seasonId);
  return apiRequest<ProductionRecord[]>(`/api/production-records?${query.toString()}`);
}

export function createProductionRecord(input: ProductionRecordInput) {
  return apiRequest<ProductionRecord>("/api/production-records", { method: "POST", body: JSON.stringify(input) });
}

export function getSeasonalAnalytics(seasonId?: string, period?: { startDate?: string; endDate?: string }) {
  const query = new URLSearchParams();
  if (seasonId) query.set("seasonId", seasonId);
  if (period?.startDate) query.set("startDate", period.startDate);
  if (period?.endDate) query.set("endDate", period.endDate);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return apiRequest<SeasonalAnalytics>(`/api/seasonal-analytics${suffix}`);
}
