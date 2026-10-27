import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import { AppError } from "../../utils/app-error";
import type { ExpenseBudgetCheck } from "./budget.types";

type BudgetLineRow = RowDataPacket & {
  budgetLineId: string;
  budgetId: string;
  budgetName: string;
  coverageStart: string;
  coverageEnd: string;
  seasonId: string | null;
  limitAmount: string | number;
  warningPercentage: string | number;
  hardLimit: number;
};

export async function evaluateExpenseBudget(
  connection: Pool | PoolConnection,
  input: { financialCategoryId: string; amount: number; expenseDate: string; seasonId?: string | null },
): Promise<ExpenseBudgetCheck> {
  try {
    const [rows] = await connection.execute<BudgetLineRow[]>(
      `SELECT CAST(bl.budget_line_id AS CHAR) AS budgetLineId,
              CAST(b.budget_id AS CHAR) AS budgetId,
              b.budget_name AS budgetName,
              b.coverage_start AS coverageStart,
              b.coverage_end AS coverageEnd,
              CAST(bl.season_id AS CHAR) AS seasonId,
              bl.limit_amount AS limitAmount,
              bl.warning_percentage AS warningPercentage,
              bl.hard_limit AS hardLimit
         FROM budget_lines bl
         JOIN budgets b ON b.budget_id = bl.budget_id
        WHERE b.budget_status = 'Approved'
          AND ? BETWEEN b.coverage_start AND b.coverage_end
          AND bl.financial_category_id = ?
          AND (bl.season_id IS NULL OR bl.season_id = ?)
        ORDER BY CASE WHEN bl.season_id IS NULL THEN 1 ELSE 0 END,
                 b.coverage_start DESC,
                 bl.budget_line_id DESC
        LIMIT 1`,
      [input.expenseDate, input.financialCategoryId, input.seasonId ?? null],
    );
    const line = rows[0];
    if (!line) {
      return {
        budgetLineId: null,
        budgetId: null,
        budgetName: null,
        limitAmount: null,
        spentAmount: 0,
        projectedAmount: input.amount,
        remainingAmount: null,
        utilizationPercentage: null,
        warning: false,
        blocked: false,
        message: "No approved budget line covers this expense; it will be recorded as unbudgeted.",
      };
    }

    const seasonClause = line.seasonId ? "AND season_id = ?" : "AND season_id IS NULL";
    const seasonParams = line.seasonId ? [line.seasonId] : [];
    const [spentRows] = await connection.execute<RowDataPacket[]>(
      `SELECT COALESCE(SUM(amount), 0) AS spentAmount
         FROM financial_records
        WHERE financial_category_id = ?
          AND record_type = 'Expense'
          AND record_status = 'Active'
          AND record_date BETWEEN ? AND ?
          ${seasonClause}`,
      [input.financialCategoryId, line.coverageStart, line.coverageEnd, ...seasonParams],
    );
    const limitAmount = Number(line.limitAmount || 0);
    const spentAmount = Number(spentRows[0]?.spentAmount || 0);
    const projectedAmount = spentAmount + input.amount;
    const utilizationPercentage = limitAmount > 0 ? (projectedAmount / limitAmount) * 100 : 100;
    const warning = utilizationPercentage >= Number(line.warningPercentage || 80);
    const blocked = Boolean(line.hardLimit) && projectedAmount > limitAmount;

    return {
      budgetLineId: line.budgetLineId,
      budgetId: line.budgetId,
      budgetName: line.budgetName,
      limitAmount,
      spentAmount,
      projectedAmount,
      remainingAmount: limitAmount - projectedAmount,
      utilizationPercentage,
      warning,
      blocked,
      message: blocked
        ? `This expense exceeds the approved budget line for ${line.budgetName}.`
        : warning
          ? `This expense will use ${Math.round(utilizationPercentage)}% of the approved budget line.`
          : "Expense is within the approved budget line.",
    };
  } catch (error) {
    if (error instanceof Error && /budget|table|column/i.test(error.message)) {
      return {
        budgetLineId: null,
        budgetId: null,
        budgetName: null,
        limitAmount: null,
        spentAmount: 0,
        projectedAmount: input.amount,
        remainingAmount: null,
        utilizationPercentage: null,
        warning: false,
        blocked: false,
        message: "Budget controls are not configured yet; the expense will be recorded without a budget check.",
      };
    }
    throw error;
  }
}

export function assertExpenseBudget(check: ExpenseBudgetCheck) {
  if (check.blocked) {
    throw new AppError(check.message, 409, "BUDGET_LIMIT_EXCEEDED", [{
      code: "BUDGET_LIMIT_EXCEEDED",
      field: "amount",
      message: check.message,
    }]);
  }
}

export const checkExpenseAgainstBudget = evaluateExpenseBudget;
