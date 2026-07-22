import type { Pool, ResultSetHeader, RowDataPacket } from "mysql2/promise";
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

const sortColumns: Record<FinancialRecordListQuery["sortBy"], string> = {
  recordDate: "r.record_date",
  amount: "r.amount",
  recordNumber: "r.record_number",
};

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
  summary(): Promise<FinancialSummary>;
  trends(): Promise<FinancialTrend[]>;
}

export function createFinanceRepository(pool?: Pool): FinanceRepository {
  const databasePool = () => pool ?? getPool();

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
           VALUES (?, 'financial_category.created', 'financial_categories', ?, 'A financial category was created.', CAST(? AS JSON))`,
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
           VALUES (?, 'financial_category.updated', 'financial_categories', ?, 'A financial category was updated.', CAST(? AS JSON))`,
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
         ORDER BY ${sortColumns[query.sortBy]} ${orderDirection}, r.financial_record_id DESC
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
           VALUES (?, 'financial_record.created', 'financial_records', ?, 'A financial record was created.', CAST(? AS JSON))`,
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
           VALUES (?, 'financial_record.updated', 'financial_records', ?, 'A financial record was updated.', CAST(? AS JSON))`,
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
