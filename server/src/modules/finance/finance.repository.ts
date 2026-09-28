import { randomUUID } from "node:crypto";
import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { getPool } from "../../db/pool";
import { limitOffsetSql } from "../../db/pagination";
import { withTransaction } from "../../db/transaction";
import { AppError } from "../../utils/app-error";
import type { AuthContext } from "../auth/auth.types";
import type {
  FinancialCategory,
  FinancialCategoryInput,
  FinancialRecord,
  FinancialRecordInput,
  FinancialRecordListQuery,
  FinancialRecordListResult,
  FinancialSummary,
  FinancialTrend,
  OperatingExpenseInput,
  OperatingExpenseListQuery,
  OperatingExpenseRecord,
  OperatingExpenseSummary,
  OperatingExpenseType,
  UpdateFinancialCategoryInput,
  UpdateFinancialRecordInput,
} from "./finance.types";

type CategoryRow = RowDataPacket & {
  id: string;
  categoryCode: string;
  categoryName: string;
  categoryType: FinancialCategory["categoryType"];
  description: string | null;
  isSystemCategory: number;
  isActive: number;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type RecordRow = RowDataPacket & {
  id: string;
  recordNumber: string;
  paymentReferenceId: string | null;
  memberId: string | null;
  financialCategoryId: string;
  categoryName: string;
  recordedBy: string;
  approvedBy: string | null;
  recordType: FinancialRecord["recordType"];
  sourceModule: FinancialRecord["sourceModule"];
  sourceRecordId: string | null;
  amount: string | number;
  recordDate: Date;
  recordStatus: FinancialRecord["recordStatus"];
  correctionOfRecordId: string | null;
  reversalOfRecordId: string | null;
  remarks: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type CountRow = RowDataPacket & { total: number };
type IdRow = RowDataPacket & { id: string };
type SummaryRow = RowDataPacket & {
  incomeTotal: string | number | null;
  expenseTotal: string | number | null;
  adjustmentTotal: string | number | null;
  activeRecords: number;
  voidedRecords: number;
};
type TrendRow = RowDataPacket & {
  month: string;
  incomeTotal: string | number | null;
  expenseTotal: string | number | null;
};
type OperatingExpenseRow = RowDataPacket & {
  id: string;
  recordNumber: string;
  categoryCode: string;
  categoryName: string;
  amount: string | number;
  expenseDate: string;
  remarks: string | null;
  recordedBy: string;
  approvedBy: string | null;
  createdAt: Date;
};
type OperatingExpenseTypeTotalRow = RowDataPacket & {
  categoryCode: string;
  total: string | number | null;
  count: string | number;
};

const sortColumns: Record<FinancialRecordListQuery["sortBy"], string> = {
  recordDate: "r.record_date",
  amount: "r.amount",
  recordNumber: "r.record_number",
  createdAt: "r.created_at",
};

const operatingExpenseCategories: Record<OperatingExpenseType, { code: string; name: string; description: string }> = {
  Salaries: {
    code: "SALARIES_WAGES",
    name: "Salaries and Wages",
    description: "Approved salaries, wages, honoraria, and related cooperative staffing expenses.",
  },
  Fuel: {
    code: "FUEL_GASOLINE",
    name: "Fuel and Gasoline",
    description: "Fuel and gasoline expenses for cooperative operations.",
  },
  Electricity: {
    code: "UTILITIES",
    name: "Utilities",
    description: "Electricity, water, internet, and other utility costs.",
  },
  Repairs: {
    code: "REPAIR_MAINTENANCE",
    name: "Repair and Maintenance",
    description: "Repair and maintenance of equipment, office, or facilities.",
  },
  "Office expenses": {
    code: "OFFICE_SUPPLIES",
    name: "Office Supplies",
    description: "Office supplies and administrative operating expenses.",
  },
  Insurance: {
    code: "INSURANCE",
    name: "Insurance",
    description: "Insurance premiums and related cooperative risk-protection expenses.",
  },
  Other: {
    code: "OTHER_EXPENSE",
    name: "Other Expense",
    description: "Other approved cooperative operating expenses.",
  },
};

const operatingExpenseTypeByCode = new Map<string, OperatingExpenseType>([
  ...Object.entries(operatingExpenseCategories).map(([expenseType, meta]) => [
    meta.code,
    expenseType as OperatingExpenseType,
  ] as const),
  ["SUPPLIES", "Office expenses"],
]);

const operatingExpenseCategoryCodes = [...operatingExpenseTypeByCode.keys()];

function categorySelect() {
  return `SELECT CAST(financial_category_id AS CHAR) AS id,
                 category_code AS categoryCode,
                 category_name AS categoryName,
                 category_type AS categoryType,
                 description,
                 is_system_category AS isSystemCategory,
                 is_active AS isActive,
                 CAST(created_by AS CHAR) AS createdBy,
                 created_at AS createdAt,
                 updated_at AS updatedAt
            FROM financial_categories`;
}

function recordSelect() {
  return `SELECT CAST(r.financial_record_id AS CHAR) AS id,
                 r.record_number AS recordNumber,
                 CAST(r.payment_reference_id AS CHAR) AS paymentReferenceId,
                 CAST(r.member_id AS CHAR) AS memberId,
                 CAST(r.financial_category_id AS CHAR) AS financialCategoryId,
                 c.category_name AS categoryName,
                 CAST(r.recorded_by AS CHAR) AS recordedBy,
                 CAST(r.approved_by AS CHAR) AS approvedBy,
                 r.record_type AS recordType,
                 r.source_module AS sourceModule,
                 CAST(r.source_record_id AS CHAR) AS sourceRecordId,
                 r.amount,
                 r.record_date AS recordDate,
                 r.record_status AS recordStatus,
                 CAST(r.correction_of_record_id AS CHAR) AS correctionOfRecordId,
                 CAST(r.reversal_of_record_id AS CHAR) AS reversalOfRecordId,
                 r.remarks,
                 r.created_at AS createdAt,
                 r.updated_at AS updatedAt
            FROM financial_records r
            JOIN financial_categories c ON c.financial_category_id = r.financial_category_id`;
}

function mapCategory(row: CategoryRow): FinancialCategory {
  return {
    ...row,
    isSystemCategory: Boolean(row.isSystemCategory),
    isActive: Boolean(row.isActive),
  };
}

function mapRecord(row: RecordRow): FinancialRecord {
  return { ...row, amount: Number(row.amount) };
}

function compactDate(value: string) {
  return value.replaceAll("-", "");
}

function recordNumberForOperatingExpense(expenseDate: string) {
  return `FIN-OPEX-${compactDate(expenseDate)}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

function operatingExpenseTypeForCode(code: string): OperatingExpenseType {
  return operatingExpenseTypeByCode.get(code) ?? "Other";
}

function mapOperatingExpense(row: OperatingExpenseRow): OperatingExpenseRecord {
  return {
    id: row.id,
    recordNumber: row.recordNumber,
    expenseType: operatingExpenseTypeForCode(row.categoryCode),
    categoryCode: row.categoryCode,
    categoryName: row.categoryName,
    amount: Number(row.amount),
    expenseDate: row.expenseDate,
    remarks: row.remarks,
    recordedBy: row.recordedBy,
    approvedBy: row.approvedBy,
    createdAt: row.createdAt,
  };
}

function operatingExpenseWhere(query: OperatingExpenseListQuery) {
  const where = [
    "r.record_type = 'Expense'",
    "r.record_status = 'Active'",
    "r.source_module NOT IN ('POS', 'Rental')",
    `c.category_code IN (${operatingExpenseCategoryCodes.map(() => "?").join(", ")})`,
  ];
  const values: Array<string> = [...operatingExpenseCategoryCodes];
  if (query.startDate) {
    where.push("r.record_date >= ?");
    values.push(query.startDate);
  }
  if (query.endDate) {
    where.push("r.record_date < DATE_ADD(?, INTERVAL 1 DAY)");
    values.push(query.endDate);
  }
  return { sql: `WHERE ${where.join(" AND ")}`, values };
}

export interface FinanceRepository {
  listCategories(): Promise<FinancialCategory[]>;
  createCategory(input: FinancialCategoryInput, auth: AuthContext): Promise<FinancialCategory>;
  updateCategory(id: string, input: UpdateFinancialCategoryInput, auth: AuthContext): Promise<FinancialCategory>;
  listRecords(query: FinancialRecordListQuery): Promise<FinancialRecordListResult>;
  findRecordById(id: string): Promise<FinancialRecord | null>;
  createRecord(input: FinancialRecordInput, auth: AuthContext): Promise<FinancialRecord>;
  updateRecord(id: string, input: UpdateFinancialRecordInput, auth: AuthContext): Promise<FinancialRecord>;
  postRecord(id: string, auth: AuthContext): Promise<FinancialRecord>;
  voidRecord(id: string, reason: string | null | undefined, auth: AuthContext): Promise<FinancialRecord>;
  createOperatingExpense(input: OperatingExpenseInput, auth: AuthContext): Promise<OperatingExpenseRecord>;
  operatingExpenses(query: OperatingExpenseListQuery): Promise<OperatingExpenseSummary>;
  summary(): Promise<FinancialSummary>;
  trends(): Promise<FinancialTrend[]>;
}

export function createFinanceRepository(pool?: Pool): FinanceRepository {
  const databasePool = () => pool ?? getPool();

  async function ensureOperatingExpenseCategory(
    connection: PoolConnection,
    expenseType: OperatingExpenseType,
    auth: AuthContext,
  ) {
    const meta = operatingExpenseCategories[expenseType];
    const [existingRows] = await connection.execute<IdRow[]>(
      "SELECT CAST(financial_category_id AS CHAR) AS id FROM financial_categories WHERE category_code = ? LIMIT 1",
      [meta.code],
    );
    if (existingRows[0]) return existingRows[0].id;

    try {
      const [result] = await connection.execute<ResultSetHeader>(
        `INSERT INTO financial_categories
           (category_code, category_name, category_type, description, is_system_category, is_active, created_by)
         VALUES (?, ?, 'Expense', ?, 0, 1, ?)`,
        [meta.code, meta.name, meta.description, auth.user.id],
      );
      const id = String(result.insertId);
      await connection.execute(
        `INSERT INTO audit_logs
           (user_id, action, entity_table, record_id, description, new_values)
         VALUES (?, 'financial_category.created', 'financial_categories', ?, 'An operating expense category was created automatically.', ?)`,
        [auth.user.id, id, JSON.stringify(meta)],
      );
      return id;
    } catch (error) {
      const [raceRows] = await connection.execute<IdRow[]>(
        "SELECT CAST(financial_category_id AS CHAR) AS id FROM financial_categories WHERE category_code = ? LIMIT 1",
        [meta.code],
      );
      if (raceRows[0]) return raceRows[0].id;
      throw error;
    }
  }

  async function findOperatingExpenseById(connection: PoolConnection, id: string) {
    const [rows] = await connection.execute<OperatingExpenseRow[]>(
      `SELECT CAST(r.financial_record_id AS CHAR) AS id,
              r.record_number AS recordNumber,
              c.category_code AS categoryCode,
              c.category_name AS categoryName,
              r.amount,
              DATE_FORMAT(r.record_date, '%Y-%m-%d') AS expenseDate,
              r.remarks,
              CAST(r.recorded_by AS CHAR) AS recordedBy,
              CAST(r.approved_by AS CHAR) AS approvedBy,
              r.created_at AS createdAt
         FROM financial_records r
         JOIN financial_categories c ON c.financial_category_id = r.financial_category_id
        WHERE r.financial_record_id = ?
          AND r.record_type = 'Expense'
        LIMIT 1`,
      [id],
    );
    return rows[0] ? mapOperatingExpense(rows[0]) : null;
  }

  return {
    async listCategories() {
      const [rows] = await databasePool().execute<CategoryRow[]>(
        `${categorySelect()} ORDER BY category_type ASC, category_name ASC`,
      );
      return rows.map(mapCategory);
    },

    async createCategory(input, auth) {
      return withTransaction(async (connection) => {
        const [result] = await connection.execute<ResultSetHeader>(
          `INSERT INTO financial_categories
             (category_code, category_name, category_type, description, is_active, created_by)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            input.categoryCode,
            input.categoryName,
            input.categoryType,
            input.description ?? null,
            input.isActive ?? true,
            auth.user.id,
          ],
        );
        const id = String(result.insertId);
        await connection.execute(
          `INSERT INTO audit_logs
             (user_id, action, entity_table, record_id, description, new_values)
           VALUES (?, 'financial_category.created', 'financial_categories', ?, 'A financial category was created.', ?)`,
          [auth.user.id, id, JSON.stringify(input)],
        );
        const [rows] = await connection.execute<CategoryRow[]>(
          `${categorySelect()} WHERE financial_category_id = ? LIMIT 1`,
          [id],
        );
        return mapCategory(rows[0]);
      }, databasePool());
    },

    async updateCategory(id, input, auth) {
      return withTransaction(async (connection) => {
        await connection.execute(
          `UPDATE financial_categories
              SET category_code = COALESCE(?, category_code),
                  category_name = COALESCE(?, category_name),
                  category_type = COALESCE(?, category_type),
                  description = CASE WHEN ? THEN ? ELSE description END,
                  is_active = COALESCE(?, is_active)
            WHERE financial_category_id = ?`,
          [
            input.categoryCode ?? null,
            input.categoryName ?? null,
            input.categoryType ?? null,
            Object.prototype.hasOwnProperty.call(input, "description")
              ? 1
              : 0,
            input.description ?? null,
            typeof input.isActive === "boolean" ? input.isActive : null,
            id,
          ],
        );
        await connection.execute(
          `INSERT INTO audit_logs
             (user_id, action, entity_table, record_id, description, new_values)
           VALUES (?, 'financial_category.updated', 'financial_categories', ?, 'A financial category was updated.', ?)`,
          [auth.user.id, id, JSON.stringify(input)],
        );
        const [rows] = await connection.execute<CategoryRow[]>(
          `${categorySelect()} WHERE financial_category_id = ? LIMIT 1`,
          [id],
        );
        if (!rows[0]) throw new AppError("Financial category was not found", 404, "FINANCIAL_CATEGORY_NOT_FOUND");
        return mapCategory(rows[0]);
      }, databasePool());
    },

    async listRecords(query) {
      const where: string[] = [];
      const values: Array<string | number> = [];

      if (query.search) {
        where.push("(r.record_number LIKE ? OR c.category_name LIKE ? OR r.remarks LIKE ?)");
        const search = `%${query.search}%`;
        values.push(search, search, search);
      }
      if (query.recordType) {
        where.push("r.record_type = ?");
        values.push(query.recordType);
      }
      if (query.recordStatus) {
        where.push("r.record_status = ?");
        values.push(query.recordStatus);
      }

      const whereSql = where.length ? ` WHERE ${where.join(" AND ")}` : "";
      const orderDirection = query.sortDirection === "asc" ? "ASC" : "DESC";
      const offset = (query.page - 1) * query.pageSize;

      const [rows] = await databasePool().execute<RecordRow[]>(
        `${recordSelect()}
         ${whereSql}
         ORDER BY ${query.sortBy === "createdAt" ? "r.financial_record_id" : sortColumns[query.sortBy]} ${orderDirection}, r.financial_record_id DESC
         ${limitOffsetSql(query.pageSize, offset)}`,
        values,
      );
      const [countRows] = await databasePool().execute<CountRow[]>(
        `SELECT COUNT(*) AS total
           FROM financial_records r
           JOIN financial_categories c ON c.financial_category_id = r.financial_category_id
          ${whereSql}`,
        values,
      );
      return {
        records: rows.map(mapRecord),
        total: Number(countRows[0]?.total ?? 0),
        page: query.page,
        pageSize: query.pageSize,
      };
    },

    async findRecordById(id) {
      const [rows] = await databasePool().execute<RecordRow[]>(
        `${recordSelect()} WHERE r.financial_record_id = ? LIMIT 1`,
        [id],
      );
      return rows[0] ? mapRecord(rows[0]) : null;
    },

    async createRecord(input, auth) {
      return withTransaction(async (connection) => {
        const [result] = await connection.execute<ResultSetHeader>(
          `INSERT INTO financial_records
             (record_number, payment_reference_id, member_id, financial_category_id, recorded_by,
              record_type, source_module, source_record_id, amount, record_date, remarks)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            input.recordNumber,
            input.paymentReferenceId ?? null,
            input.memberId ?? null,
            input.financialCategoryId,
            auth.user.id,
            input.recordType,
            input.sourceModule ?? "Manual",
            input.sourceRecordId ?? null,
            input.amount,
            input.recordDate,
            input.remarks ?? null,
          ],
        );
        const id = String(result.insertId);
        await connection.execute(
          `INSERT INTO audit_logs
             (user_id, action, entity_table, record_id, description, new_values)
           VALUES (?, 'financial_record.created', 'financial_records', ?, 'A financial record was created.', ?)`,
          [auth.user.id, id, JSON.stringify(input)],
        );
        const [rows] = await connection.execute<RecordRow[]>(
          `${recordSelect()} WHERE r.financial_record_id = ? LIMIT 1`,
          [id],
        );
        return mapRecord(rows[0]);
      }, databasePool());
    },

    async updateRecord(id, input, auth) {
      return withTransaction(async (connection) => {
        const existing = await this.findRecordById(id);
        if (!existing) throw new AppError("Financial record was not found", 404, "FINANCIAL_RECORD_NOT_FOUND");
        if (existing.approvedBy || existing.recordStatus !== "Active") {
          throw new AppError("Posted or inactive financial records cannot be edited", 409, "FINANCIAL_RECORD_LOCKED");
        }

        await connection.execute(
          `UPDATE financial_records
              SET record_number = COALESCE(?, record_number),
                  payment_reference_id = ?,
                  member_id = ?,
                  financial_category_id = COALESCE(?, financial_category_id),
                  record_type = COALESCE(?, record_type),
                  source_module = COALESCE(?, source_module),
                  source_record_id = ?,
                  amount = COALESCE(?, amount),
                  record_date = COALESCE(?, record_date),
                  remarks = ?
            WHERE financial_record_id = ?`,
          [
            input.recordNumber ?? null,
            Object.prototype.hasOwnProperty.call(input, "paymentReferenceId") ? input.paymentReferenceId ?? null : existing.paymentReferenceId,
            Object.prototype.hasOwnProperty.call(input, "memberId") ? input.memberId ?? null : existing.memberId,
            input.financialCategoryId ?? null,
            input.recordType ?? null,
            input.sourceModule ?? null,
            Object.prototype.hasOwnProperty.call(input, "sourceRecordId") ? input.sourceRecordId ?? null : existing.sourceRecordId,
            input.amount ?? null,
            input.recordDate ?? null,
            Object.prototype.hasOwnProperty.call(input, "remarks") ? input.remarks ?? null : existing.remarks,
            id,
          ],
        );
        await connection.execute(
          `INSERT INTO audit_logs
             (user_id, action, entity_table, record_id, description, new_values)
           VALUES (?, 'financial_record.updated', 'financial_records', ?, 'A financial record was updated.', ?)`,
          [auth.user.id, id, JSON.stringify(input)],
        );
        const updated = await this.findRecordById(id);
        if (!updated) throw new AppError("Financial record was not found", 404, "FINANCIAL_RECORD_NOT_FOUND");
        return updated;
      }, databasePool());
    },

    async postRecord(id, auth) {
      return withTransaction(async (connection) => {
        const existing = await this.findRecordById(id);
        if (!existing) throw new AppError("Financial record was not found", 404, "FINANCIAL_RECORD_NOT_FOUND");
        if (existing.recordStatus !== "Active") {
          throw new AppError("Only active records can be posted", 409, "FINANCIAL_RECORD_NOT_ACTIVE");
        }
        await connection.execute(
          `UPDATE financial_records SET approved_by = ? WHERE financial_record_id = ?`,
          [auth.user.id, id],
        );
        await connection.execute(
          `INSERT INTO audit_logs
             (user_id, action, entity_table, record_id, description)
           VALUES (?, 'financial_record.posted', 'financial_records', ?, 'A financial record was posted.')`,
          [auth.user.id, id],
        );
        const updated = await this.findRecordById(id);
        if (!updated) throw new AppError("Financial record was not found", 404, "FINANCIAL_RECORD_NOT_FOUND");
        return updated;
      }, databasePool());
    },

    async voidRecord(id, reason, auth) {
      return withTransaction(async (connection) => {
        const existing = await this.findRecordById(id);
        if (!existing) throw new AppError("Financial record was not found", 404, "FINANCIAL_RECORD_NOT_FOUND");
        if (existing.recordStatus === "Voided") {
          throw new AppError("Financial record is already voided", 409, "FINANCIAL_RECORD_ALREADY_VOIDED");
        }
        await connection.execute(
          `UPDATE financial_records SET record_status = 'Voided', remarks = CONCAT(COALESCE(remarks, ''), ?) WHERE financial_record_id = ?`,
          [`\nVoid reason: ${reason ?? "No reason provided."}`, id],
        );
        await connection.execute(
          `INSERT INTO audit_logs
             (user_id, action, entity_table, record_id, description)
           VALUES (?, 'financial_record.voided', 'financial_records', ?, ?)`,
          [auth.user.id, id, reason ?? "A financial record was voided."],
        );
        const updated = await this.findRecordById(id);
        if (!updated) throw new AppError("Financial record was not found", 404, "FINANCIAL_RECORD_NOT_FOUND");
        return updated;
      }, databasePool());
    },

    async createOperatingExpense(input, auth) {
      return withTransaction(async (connection) => {
        const categoryId = await ensureOperatingExpenseCategory(connection, input.expenseType, auth);
        const recordNumber = recordNumberForOperatingExpense(input.expenseDate);
        const remarks = [
          `Operating expense: ${input.expenseType}.`,
          input.expenseType === "Other" && input.otherDescription?.trim()
            ? `Specific expense: ${input.otherDescription.trim()}.`
            : "",
          input.remarks?.trim() ? input.remarks.trim() : "",
        ].filter(Boolean).join(" ");

        const [result] = await connection.execute<ResultSetHeader>(
          `INSERT INTO financial_records
             (record_number, payment_reference_id, member_id, financial_category_id, recorded_by,
              approved_by, record_type, source_module, source_record_id, amount, record_date, record_status, remarks)
           VALUES (?, NULL, NULL, ?, ?, ?, 'Expense', 'Manual', NULL, ?, ?, 'Active', ?)`,
          [
            recordNumber,
            categoryId,
            auth.user.id,
            auth.user.id,
            input.amount,
            input.expenseDate,
            remarks,
          ],
        );
        const id = String(result.insertId);
        await connection.execute(
          `INSERT INTO audit_logs
             (user_id, action, entity_table, record_id, description, new_values)
           VALUES (?, 'operating_expense.created', 'financial_records', ?, 'An operating expense was recorded and posted.', ?)`,
          [auth.user.id, id, JSON.stringify({ ...input, recordNumber })],
        );
        const created = await findOperatingExpenseById(connection, id);
        if (!created) throw new AppError("Operating expense was not found after recording", 500, "OPERATING_EXPENSE_NOT_FOUND");
        return created;
      }, databasePool());
    },

    async operatingExpenses(query) {
      const where = operatingExpenseWhere(query);
      const [rows] = await databasePool().execute<OperatingExpenseRow[]>(
        `SELECT CAST(r.financial_record_id AS CHAR) AS id,
                r.record_number AS recordNumber,
                c.category_code AS categoryCode,
                c.category_name AS categoryName,
                r.amount,
                DATE_FORMAT(r.record_date, '%Y-%m-%d') AS expenseDate,
                r.remarks,
                CAST(r.recorded_by AS CHAR) AS recordedBy,
                CAST(r.approved_by AS CHAR) AS approvedBy,
                r.created_at AS createdAt
           FROM financial_records r
           JOIN financial_categories c ON c.financial_category_id = r.financial_category_id
          ${where.sql}
          ORDER BY r.record_date DESC, r.financial_record_id DESC
          ${limitOffsetSql(100, 0)}`,
        where.values,
      );
      const [totalRows] = await databasePool().execute<OperatingExpenseTypeTotalRow[]>(
        `SELECT c.category_code AS categoryCode,
                COALESCE(SUM(r.amount), 0) AS total,
                COUNT(*) AS count
           FROM financial_records r
           JOIN financial_categories c ON c.financial_category_id = r.financial_category_id
          ${where.sql}
          GROUP BY c.category_code`,
        where.values,
      );
      const totals = new Map<OperatingExpenseType, { total: number; count: number }>();
      for (const row of totalRows) {
        const expenseType = operatingExpenseTypeForCode(row.categoryCode);
        const current = totals.get(expenseType) ?? { total: 0, count: 0 };
        current.total += Number(row.total ?? 0);
        current.count += Number(row.count ?? 0);
        totals.set(expenseType, current);
      }
      const byType = Object.keys(operatingExpenseCategories).map((expenseType) => {
        const total = totals.get(expenseType as OperatingExpenseType);
        return {
          expenseType: expenseType as OperatingExpenseType,
          total: total?.total ?? 0,
          count: total?.count ?? 0,
        };
      });
      return {
        items: rows.map(mapOperatingExpense),
        byType,
        total: byType.reduce((sum, item) => sum + item.total, 0),
        count: byType.reduce((sum, item) => sum + item.count, 0),
        startDate: query.startDate ?? null,
        endDate: query.endDate ?? null,
      };
    },

    async summary() {
      const [rows] = await databasePool().execute<SummaryRow[]>(
        `SELECT COALESCE(SUM(CASE WHEN record_status = 'Active' AND record_type = 'Income' THEN amount ELSE 0 END), 0) AS incomeTotal,
                COALESCE(SUM(CASE WHEN record_status = 'Active' AND record_type = 'Expense' THEN amount ELSE 0 END), 0) AS expenseTotal,
                COALESCE(SUM(CASE WHEN record_status = 'Active' AND record_type = 'Adjustment' THEN amount ELSE 0 END), 0) AS adjustmentTotal,
                SUM(record_status = 'Active') AS activeRecords,
                SUM(record_status = 'Voided') AS voidedRecords
           FROM financial_records`,
      );
      const row = rows[0];
      const incomeTotal = Number(row?.incomeTotal ?? 0);
      const expenseTotal = Number(row?.expenseTotal ?? 0);
      const adjustmentTotal = Number(row?.adjustmentTotal ?? 0);
      return {
        incomeTotal,
        expenseTotal,
        adjustmentTotal,
        netTotal: incomeTotal - expenseTotal + adjustmentTotal,
        activeRecords: Number(row?.activeRecords ?? 0),
        voidedRecords: Number(row?.voidedRecords ?? 0),
      };
    },

    async trends() {
      const [rows] = await databasePool().execute<TrendRow[]>(
        `SELECT DATE_FORMAT(record_date, '%Y-%m') AS month,
                COALESCE(SUM(CASE WHEN record_status = 'Active' AND record_type = 'Income' THEN amount ELSE 0 END), 0) AS incomeTotal,
                COALESCE(SUM(CASE WHEN record_status = 'Active' AND record_type = 'Expense' THEN amount ELSE 0 END), 0) AS expenseTotal
           FROM financial_records
          WHERE record_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 12 MONTH)
          GROUP BY DATE_FORMAT(record_date, '%Y-%m')
          ORDER BY month ASC`,
      );
      return rows.map((row) => {
        const incomeTotal = Number(row.incomeTotal ?? 0);
        const expenseTotal = Number(row.expenseTotal ?? 0);
        return { month: row.month, incomeTotal, expenseTotal, netTotal: incomeTotal - expenseTotal };
      });
    },
  };
}
