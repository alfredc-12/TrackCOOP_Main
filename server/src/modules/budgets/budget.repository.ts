import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { getPool } from "../../db/pool";
import { withTransaction } from "../../db/transaction";
import { limitOffsetSql } from "../../db/pagination";
import { AppError } from "../../utils/app-error";
import type { AuthContext } from "../auth/auth.types";
import { evaluateExpenseBudget } from "./budget-control";
import type {
  Budget,
  BudgetInput,
  BudgetLine,
  BudgetListQuery,
  BudgetStatus,
  BudgetSummary,
} from "./budget.types";

type BudgetRow = RowDataPacket & {
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
};

type BudgetLineRow = RowDataPacket & {
  id: string;
  financialCategoryId: string;
  categoryName: string;
  seasonId: string | null;
  seasonName: string | null;
  limitAmount: string | number;
  warningPercentage: string | number;
  hardLimit: number;
  spentAmount: string | number;
};

function numberValue(value: unknown) {
  return Number(value ?? 0) || 0;
}

function assertChairman(auth: AuthContext) {
  if (auth.user.role !== "chairman") {
    throw new AppError("Only the Chairman can manage budget approvals.", 403, "FORBIDDEN");
  }
}

function mapLine(row: BudgetLineRow): BudgetLine {
  const limitAmount = numberValue(row.limitAmount);
  const spentAmount = numberValue(row.spentAmount);
  const utilizationPercentage = limitAmount > 0 ? (spentAmount / limitAmount) * 100 : spentAmount > 0 ? 100 : 0;
  const warning = utilizationPercentage >= numberValue(row.warningPercentage || 80);
  return {
    id: String(row.id),
    financialCategoryId: String(row.financialCategoryId),
    categoryName: String(row.categoryName),
    seasonId: row.seasonId ? String(row.seasonId) : null,
    seasonName: row.seasonName ? String(row.seasonName) : null,
    limitAmount,
    warningPercentage: numberValue(row.warningPercentage || 80),
    hardLimit: Boolean(row.hardLimit),
    spentAmount,
    remainingAmount: limitAmount - spentAmount,
    utilizationPercentage,
    warning,
    exceeded: spentAmount > limitAmount,
  };
}

async function findBudget(connection: Pool | PoolConnection, id: string): Promise<Budget | null> {
  const [budgetRows] = await connection.execute<BudgetRow[]>(
    `SELECT CAST(b.budget_id AS CHAR) AS id,
            b.budget_name AS budgetName,
            DATE_FORMAT(b.coverage_start, '%Y-%m-%d') AS coverageStart,
            DATE_FORMAT(b.coverage_end, '%Y-%m-%d') AS coverageEnd,
            b.budget_status AS budgetStatus,
            b.notes,
            CAST(b.created_by AS CHAR) AS createdBy,
            CAST(b.approved_by AS CHAR) AS approvedBy,
            b.approved_at AS approvedAt,
            b.created_at AS createdAt,
            b.updated_at AS updatedAt
       FROM budgets b
      WHERE b.budget_id = ?
      LIMIT 1`,
    [id],
  );
  const budget = budgetRows[0];
  if (!budget) return null;
  const [lineRows] = await connection.execute<BudgetLineRow[]>(
    `SELECT CAST(bl.budget_line_id AS CHAR) AS id,
            CAST(bl.financial_category_id AS CHAR) AS financialCategoryId,
            fc.category_name AS categoryName,
            CAST(bl.season_id AS CHAR) AS seasonId,
            s.season_name AS seasonName,
            bl.limit_amount AS limitAmount,
            bl.warning_percentage AS warningPercentage,
            bl.hard_limit AS hardLimit,
            COALESCE((
              SELECT SUM(fr.amount)
                FROM financial_records fr
               WHERE fr.financial_category_id = bl.financial_category_id
                 AND fr.record_type = 'Expense'
                 AND fr.record_status = 'Active'
                 AND fr.record_date BETWEEN b.coverage_start AND b.coverage_end
                 AND (bl.season_id IS NULL AND fr.season_id IS NULL OR bl.season_id IS NOT NULL AND fr.season_id = bl.season_id)
            ), 0) AS spentAmount
       FROM budget_lines bl
       JOIN budgets b ON b.budget_id = bl.budget_id
       JOIN financial_categories fc ON fc.financial_category_id = bl.financial_category_id
       LEFT JOIN seasons s ON s.season_id = bl.season_id
      WHERE bl.budget_id = ?
      ORDER BY fc.category_name ASC, s.season_name ASC`,
    [id],
  );
  const lines = lineRows.map(mapLine);
  const totalLimit = lines.reduce((total, line) => total + line.limitAmount, 0);
  const totalSpent = lines.reduce((total, line) => total + line.spentAmount, 0);
  return {
    id: String(budget.id),
    budgetName: budget.budgetName,
    coverageStart: budget.coverageStart,
    coverageEnd: budget.coverageEnd,
    budgetStatus: budget.budgetStatus,
    notes: budget.notes,
    createdBy: String(budget.createdBy),
    approvedBy: budget.approvedBy ? String(budget.approvedBy) : null,
    approvedAt: budget.approvedAt,
    createdAt: budget.createdAt,
    updatedAt: budget.updatedAt,
    totalLimit,
    totalSpent,
    totalRemaining: totalLimit - totalSpent,
    utilizationPercentage: totalLimit > 0 ? (totalSpent / totalLimit) * 100 : totalSpent > 0 ? 100 : 0,
    lines,
  };
}

export interface BudgetRepository {
  list(query: BudgetListQuery): Promise<{ budgets: Budget[]; total: number; page: number; pageSize: number }>;
  get(id: string): Promise<Budget | null>;
  create(input: BudgetInput, auth: AuthContext): Promise<Budget>;
  transition(id: string, action: "submit" | "approve" | "close", auth: AuthContext): Promise<Budget>;
  summary(): Promise<BudgetSummary>;
}

export function createBudgetRepository(pool?: Pool): BudgetRepository {
  const databasePool = () => pool ?? getPool();
  return {
    async list(query) {
      const where = query.status ? "WHERE b.budget_status = ?" : "";
      const params = query.status ? [query.status] : [];
      const offset = (query.page - 1) * query.pageSize;
      const [rows] = await databasePool().execute<BudgetRow[]>(
        `SELECT CAST(b.budget_id AS CHAR) AS id,
                b.budget_name AS budgetName,
                DATE_FORMAT(b.coverage_start, '%Y-%m-%d') AS coverageStart,
                DATE_FORMAT(b.coverage_end, '%Y-%m-%d') AS coverageEnd,
                b.budget_status AS budgetStatus,
                b.notes,
                CAST(b.created_by AS CHAR) AS createdBy,
                CAST(b.approved_by AS CHAR) AS approvedBy,
                b.approved_at AS approvedAt,
                b.created_at AS createdAt,
                b.updated_at AS updatedAt
           FROM budgets b
           ${where}
          ORDER BY b.coverage_start DESC, b.budget_id DESC
          ${limitOffsetSql(query.pageSize, offset)}`,
        params,
      );
      const [countRows] = await databasePool().execute<RowDataPacket[]>(
        `SELECT COUNT(*) AS total FROM budgets b ${where}`,
        params,
      );
      const budgets = await Promise.all(rows.map((row) => findBudget(databasePool(), String(row.id))));
      return {
        budgets: budgets.filter((budget): budget is Budget => Boolean(budget)),
        total: numberValue(countRows[0]?.total),
        page: query.page,
        pageSize: query.pageSize,
      };
    },

    async get(id) {
      return findBudget(databasePool(), id);
    },

    async create(input, auth) {
      assertChairman(auth);
      return withTransaction(async (connection) => {
        const [result] = await connection.execute<ResultSetHeader>(
          `INSERT INTO budgets
             (budget_name, coverage_start, coverage_end, budget_status, notes, created_by)
           VALUES (?, ?, ?, 'Draft', ?, ?)`,
          [input.budgetName, input.coverageStart, input.coverageEnd, input.notes ?? null, auth.user.id],
        );
        const budgetId = String(result.insertId);
        for (const line of input.lines) {
          await connection.execute(
            `INSERT INTO budget_lines
               (budget_id, financial_category_id, season_id, limit_amount, warning_percentage, hard_limit)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [budgetId, line.financialCategoryId, line.seasonId ?? null, line.limitAmount, line.warningPercentage ?? 80, line.hardLimit === false ? 0 : 1],
          );
        }
        await connection.execute(
          `INSERT INTO audit_logs (user_id, action, entity_table, record_id, description, new_values)
           VALUES (?, 'budget.created', 'budgets', ?, 'A budget was created.', ?)`,
          [auth.user.id, budgetId, JSON.stringify(input)],
        );
        const created = await findBudget(connection, budgetId);
        if (!created) throw new AppError("Budget was not found after creation", 500, "BUDGET_NOT_FOUND");
        return created;
      }, databasePool());
    },

    async transition(id, action, auth) {
      assertChairman(auth);
      return withTransaction(async (connection) => {
        const existing = await findBudget(connection, id);
        if (!existing) throw new AppError("Budget was not found", 404, "BUDGET_NOT_FOUND");
        const nextStatus: BudgetStatus = action === "submit"
          ? "Pending Approval"
          : action === "approve"
            ? "Approved"
            : "Closed";
        const expected: BudgetStatus = action === "submit" ? "Draft" : action === "approve" ? "Pending Approval" : "Approved";
        if (existing.budgetStatus !== expected) {
          throw new AppError(`Only ${expected} budgets can be ${action}ed.`, 409, "BUDGET_STATUS_INVALID");
        }
        await connection.execute(
          `UPDATE budgets
              SET budget_status = ?,
                  approved_by = CASE WHEN ? = 'Approved' THEN ? ELSE approved_by END,
                  approved_at = CASE WHEN ? = 'Approved' THEN CURRENT_TIMESTAMP ELSE approved_at END
            WHERE budget_id = ?`,
          [nextStatus, nextStatus, auth.user.id, nextStatus, id],
        );
        await connection.execute(
          `INSERT INTO audit_logs (user_id, action, entity_table, record_id, description, new_values)
           VALUES (?, 'budget.status_changed', 'budgets', ?, ?, ?)`,
          [auth.user.id, id, `Budget status changed to ${nextStatus}.`, JSON.stringify({ status: nextStatus })],
        );
        const updated = await findBudget(connection, id);
        if (!updated) throw new AppError("Budget was not found after update", 500, "BUDGET_NOT_FOUND");
        return updated;
      }, databasePool());
    },

    async summary() {
      const listed = await this.list({ page: 1, pageSize: 100, status: "Approved" });
      const approved = listed.budgets;
      const totalLimit = approved.reduce((total, budget) => total + budget.totalLimit, 0);
      const totalSpent = approved.reduce((total, budget) => total + budget.totalSpent, 0);
      const [unbudgetedRows] = await databasePool().execute<RowDataPacket[]>(
        `SELECT COALESCE(SUM(fr.amount), 0) AS total
           FROM financial_records fr
          WHERE fr.record_type = 'Expense'
            AND fr.record_status = 'Active'
            AND NOT EXISTS (
              SELECT 1
                FROM budget_lines bl
                JOIN budgets b ON b.budget_id = bl.budget_id
               WHERE b.budget_status = 'Approved'
                 AND fr.record_date BETWEEN b.coverage_start AND b.coverage_end
                 AND fr.financial_category_id = bl.financial_category_id
                 AND (bl.season_id IS NULL AND fr.season_id IS NULL OR bl.season_id IS NOT NULL AND fr.season_id = bl.season_id)
            )`,
      ).catch(() => [[] as RowDataPacket[]]);
      return {
        approvedBudgetCount: approved.length,
        totalLimit,
        totalSpent,
        totalRemaining: totalLimit - totalSpent,
        utilizationPercentage: totalLimit > 0 ? (totalSpent / totalLimit) * 100 : 0,
        warningCount: approved.reduce((total, budget) => total + budget.lines.filter((line) => line.warning).length, 0),
        exceededCount: approved.reduce((total, budget) => total + budget.lines.filter((line) => line.exceeded).length, 0),
        unbudgetedExpenseTotal: numberValue(unbudgetedRows[0]?.total),
      };
    },
  };
}

export async function checkExpenseAgainstBudget(
  connection: Pool | PoolConnection,
  input: { financialCategoryId: string; amount: number; expenseDate: string; seasonId?: string | null },
) {
  return evaluateExpenseBudget(connection, input);
}
