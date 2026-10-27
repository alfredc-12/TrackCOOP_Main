export type BudgetStatus = "Draft" | "Pending Approval" | "Approved" | "Closed";

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

export type BudgetListQuery = {
  page: number;
  pageSize: number;
  status?: BudgetStatus;
};

export type BudgetLine = BudgetLineInput & {
  id: string;
  categoryName: string;
  seasonName: string | null;
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
  createdBy: string;
  approvedBy: string | null;
  approvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
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

export type ExpenseBudgetCheck = {
  budgetLineId: string | null;
  budgetId: string | null;
  budgetName: string | null;
  limitAmount: number | null;
  spentAmount: number;
  projectedAmount: number;
  remainingAmount: number | null;
  utilizationPercentage: number | null;
  warning: boolean;
  blocked: boolean;
  message: string;
};
