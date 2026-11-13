import type { Pool, RowDataPacket } from "mysql2/promise";
import { getPool } from "../../db/pool";
import { limitOffsetSql } from "../../db/pagination";
import { AppError } from "../../utils/app-error";
import { likeTerm } from "../../utils/people-filters";
import { classificationSql, registryBackedSql, type ExpenseClass, classifyExpense } from "./expense-classification";
import { fromCents, toCents } from "./expense-money";
import { describeExpense } from "./expense-record-details";
import type { ExpenseFilters, ExpenseRecordView, ExpenseSortField } from "./expense-overview.schema";
import type {
  CountAmount,
  ExpenseCapabilities,
  ExpenseFilterOptions,
  ExpenseIntegrity,
  ExpenseRange,
  ExpenseRecordDetail,
  ExpenseRecordRow,
  IntegrityCheck,
} from "./expense-overview.types";

type Row = RowDataPacket & Record<string, string | number | null>;

/**
 * Posting rule for every headline figure: an Expense row that is Active (not voided, corrected or
 * reversed away), carries a posting approver, and is not itself a reversal entry. A reversed or corrected
 * original is excluded by its status, and the payment-reversal flow records its offset as a negative
 * *Adjustment*, so an expense is neither counted twice nor netted twice.
 */
const viewSql: Record<ExpenseRecordView, string> = {
  posted: "r.record_type = 'Expense' AND r.record_status = 'Active' AND r.approved_by IS NOT NULL AND r.reversal_of_record_id IS NULL",
  unposted: "r.record_type = 'Expense' AND r.record_status = 'Active' AND r.approved_by IS NULL AND r.reversal_of_record_id IS NULL",
  voided: "r.record_type = 'Expense' AND r.record_status = 'Voided'",
  corrected: "r.record_type = 'Expense' AND r.record_status IN ('Corrected', 'Reversed')",
  all: "r.record_type = 'Expense'",
};

const fromSql = `FROM financial_records r
  JOIN financial_categories c ON c.financial_category_id = r.financial_category_id`;

const classExpr = classificationSql("r", "c");

const sortSql: Record<ExpenseSortField, string> = {
  recordDate: "r.record_date",
  amount: "r.amount",
  recordNumber: "r.record_number",
  category: "c.category_name",
  source: "r.source_module",
};

type Scope = {
  range?: ExpenseRange | null;
  view?: ExpenseRecordView;
  /** The class filter is left out where a panel must see every class (reconciliation, integrity). */
  ignoreClasses?: boolean;
};

export type RecordSort = { sortBy: ExpenseSortField; sortDirection: "asc" | "desc" };

export interface ExpenseOverviewRepository {
  capabilities(): Promise<ExpenseCapabilities>;
  totals(filters: ExpenseFilters, range: ExpenseRange | null): Promise<CountAmount>;
  classTotals(filters: ExpenseFilters, range: ExpenseRange | null): Promise<Array<{ expenseClass: ExpenseClass; records: number; amount: number }>>;
  analyticsComparable(filters: ExpenseFilters, range: ExpenseRange | null): Promise<CountAmount>;
  statusTotals(filters: ExpenseFilters, range: ExpenseRange | null): Promise<{ unposted: CountAmount; voided: CountAmount; correctedOrReversed: CountAmount; needsClassification: CountAmount }>;
  categoryTotals(filters: ExpenseFilters, range: ExpenseRange | null): Promise<Array<{ categoryId: string; code: string; name: string; isActive: boolean; expenseClass: ExpenseClass; amount: number; records: number }>>;
  sourceTotals(filters: ExpenseFilters, range: ExpenseRange | null): Promise<Array<{ sourceModule: string; amount: number; records: number }>>;
  matrixTotals(filters: ExpenseFilters, range: ExpenseRange | null): Promise<Array<{ categoryId: string; name: string; sourceModule: string; amount: number; records: number }>>;
  dailyTotals(filters: ExpenseFilters, range: ExpenseRange | null): Promise<Array<{ date: string; categoryId: string; name: string; amount: number; records: number }>>;
  earliestDate(filters: ExpenseFilters): Promise<string | null>;
  listRecords(filters: ExpenseFilters, view: ExpenseRecordView, sort: RecordSort, range: ExpenseRange | null, page: number, pageSize: number): Promise<{ records: ExpenseRecordRow[]; total: number; totalAmount: number }>;
  recordDetail(id: string): Promise<ExpenseRecordDetail | null>;
  integrity(filters: ExpenseFilters, range: ExpenseRange | null, today: string): Promise<ExpenseIntegrity>;
  filterOptions(): Promise<ExpenseFilterOptions>;
}

function count(value: unknown) {
  return Number(value ?? 0);
}

function iso(value: unknown) {
  return value instanceof Date ? value.toISOString() : String(value ?? "");
}

function mapRecord(row: Row): ExpenseRecordRow {
  const classification = classifyExpense({
    categoryCode: String(row.categoryCode),
    categoryType: String(row.categoryType),
    sourceModule: String(row.sourceModule),
  });
  const recordStatus = String(row.recordStatus) as ExpenseRecordRow["recordStatus"];
  const posted = row.postedById !== null && row.postedById !== undefined;
  const postingStatus: ExpenseRecordRow["postingStatus"] =
    recordStatus === "Active" ? (posted ? "Posted" : "Unposted") : recordStatus;
  const described = describeExpense(row.remarks === null ? null : String(row.remarks), String(row.sourceModule), String(row.categoryName));
  return {
    id: String(row.id),
    recordNumber: String(row.recordNumber),
    recordDate: String(row.recordDate),
    categoryId: String(row.categoryId),
    categoryCode: String(row.categoryCode),
    categoryName: String(row.categoryName),
    expenseClass: classification.expenseClass,
    classificationBasis: classification.basis,
    sourceModule: String(row.sourceModule),
    sourceRecordId: row.sourceRecordId === null ? null : String(row.sourceRecordId),
    amount: fromCents(toCents(row.amount)),
    recordStatus,
    postingStatus,
    description: described.description,
    recordedBy: { id: String(row.recordedById), name: String(row.recordedByName ?? "Unknown user") },
    postedBy: posted ? { id: String(row.postedById), name: String(row.postedByName ?? "Unknown user") } : null,
    season: row.seasonId === null || row.seasonId === undefined ? null : { id: String(row.seasonId), name: String(row.seasonName ?? `Season ${row.seasonId}`) },
    createdAt: iso(row.createdAt),
  };
}

export function createExpenseOverviewRepository(pool?: Pool): ExpenseOverviewRepository {
  const db = () => pool ?? getPool();
  let capabilityCache: { at: number; value: ExpenseCapabilities } | null = null;

  async function capabilities(): Promise<ExpenseCapabilities> {
    if (capabilityCache && Date.now() - capabilityCache.at < 60_000) return capabilityCache.value;
    const [rows] = await db().query<Row[]>(
      `SELECT table_name AS tableName, column_name AS columnName
         FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND ((table_name = 'financial_records' AND column_name = 'season_id')
            OR (table_name = 'seasons' AND column_name = 'season_id'))`,
    );
    const has = (table: string, column: string) => rows.some((row) => row.tableName === table && row.columnName === column);
    const value = {
      seasons: has("financial_records", "season_id") && has("seasons", "season_id"),
    };
    capabilityCache = { at: Date.now(), value };
    return value;
  }

  /** One predicate builder serves every panel, so a card, a chart and the table can never disagree. */
  async function where(filters: ExpenseFilters, scope: Scope = {}) {
    const caps = await capabilities();
    const conditions = [viewSql[scope.view ?? "posted"]];
    const values: Array<string | number> = [];
    const range = scope.range ?? null;
    if (range?.startDate) {
      conditions.push("r.record_date >= ?");
      values.push(range.startDate);
    }
    if (range?.endDate) {
      conditions.push("r.record_date <= ?");
      values.push(range.endDate);
    }
    if (filters.categoryIds.length) {
      conditions.push(`r.financial_category_id IN (${filters.categoryIds.map(() => "?").join(", ")})`);
      values.push(...filters.categoryIds);
    }
    if (filters.sourceModules.length) {
      conditions.push(`r.source_module IN (${filters.sourceModules.map(() => "?").join(", ")})`);
      values.push(...filters.sourceModules);
    }
    if (!scope.ignoreClasses && filters.classes.length) {
      conditions.push(`${classExpr} IN (${filters.classes.map(() => "?").join(", ")})`);
      values.push(...filters.classes);
    }
    if (filters.amountMin !== undefined) {
      conditions.push("r.amount >= ?");
      values.push(filters.amountMin);
    }
    if (filters.amountMax !== undefined) {
      conditions.push("r.amount <= ?");
      values.push(filters.amountMax);
    }
    if (filters.recordedBy) {
      conditions.push("r.recorded_by = ?");
      values.push(filters.recordedBy);
    }
    if (filters.postedBy) {
      conditions.push("r.approved_by = ?");
      values.push(filters.postedBy);
    }
    if (filters.seasonId) {
      if (!caps.seasons) throw new AppError("Seasons are not available in this database", 409, "SEASONS_UNAVAILABLE");
      conditions.push("r.season_id = ?");
      values.push(filters.seasonId);
    }
    if (filters.search) {
      const term = likeTerm(filters.search);
      conditions.push(`(r.record_number LIKE ? OR c.category_name LIKE ? OR c.category_code LIKE ? OR r.remarks LIKE ?
        OR CAST(r.source_record_id AS CHAR) = ? OR CAST(r.financial_record_id AS CHAR) = ?)`);
      values.push(term, term, term, term, filters.search, filters.search);
    }
    return { sql: conditions.join(" AND "), values };
  }

  async function totals(filters: ExpenseFilters, range: ExpenseRange | null, scope: Scope = {}): Promise<CountAmount> {
    const w = await where(filters, { ...scope, range });
    const [rows] = await db().query<Row[]>(
      `SELECT COUNT(DISTINCT r.financial_record_id) AS records, COALESCE(SUM(r.amount), 0) AS amount ${fromSql} WHERE ${w.sql}`,
      w.values,
    );
    return { records: count(rows[0]?.records), amount: fromCents(toCents(rows[0]?.amount)) };
  }

  return {
    capabilities,

    totals: (filters, range) => totals(filters, range),

    async classTotals(filters, range) {
      const w = await where(filters, { range, ignoreClasses: true });
      const [rows] = await db().query<Row[]>(
        `SELECT ${classExpr} AS expenseClass, COUNT(DISTINCT r.financial_record_id) AS records, COALESCE(SUM(r.amount), 0) AS amount
           ${fromSql} WHERE ${w.sql} GROUP BY expenseClass`,
        w.values,
      );
      return rows.map((row) => ({ expenseClass: String(row.expenseClass) as ExpenseClass, records: count(row.records), amount: fromCents(toCents(row.amount)) }));
    },

    /**
     * Posted Expense rows other than capital movements (share-capital source or category): the population
     * the Financial Analytics dashboard reports as expenses. The class filter is intentionally ignored.
     */
    async analyticsComparable(filters, range) {
      const w = await where(filters, { range, ignoreClasses: true });
      const [rows] = await db().query<Row[]>(
        `SELECT COUNT(DISTINCT r.financial_record_id) AS records, COALESCE(SUM(r.amount), 0) AS amount
           ${fromSql}
          WHERE ${w.sql}
            AND r.source_module <> 'Share Capital'
            AND UPPER(COALESCE(c.category_code, '')) <> 'SHARE_CAPITAL'
            AND UPPER(COALESCE(c.category_name, '')) NOT LIKE '%SHARE CAPITAL%'`,
        w.values,
      );
      return { records: count(rows[0]?.records), amount: fromCents(toCents(rows[0]?.amount)) };
    },

    async statusTotals(filters, range) {
      const pick = async (view: ExpenseRecordView, extra = ""): Promise<CountAmount> => {
        const w = await where(filters, { range, view, ignoreClasses: true });
        const [rows] = await db().query<Row[]>(
          `SELECT COUNT(DISTINCT r.financial_record_id) AS records, COALESCE(SUM(r.amount), 0) AS amount ${fromSql} WHERE ${w.sql} ${extra}`,
          w.values,
        );
        return { records: count(rows[0]?.records), amount: fromCents(toCents(rows[0]?.amount)) };
      };
      const [unposted, voided, correctedOrReversed, needsClassification] = await Promise.all([
        pick("unposted"),
        pick("voided"),
        pick("corrected"),
        pick("posted", `AND ${classExpr} = 'unclassified'`),
      ]);
      return { unposted, voided, correctedOrReversed, needsClassification };
    },

    async categoryTotals(filters, range) {
      const w = await where(filters, { range });
      const [rows] = await db().query<Row[]>(
        `SELECT CAST(c.financial_category_id AS CHAR) AS categoryId, c.category_code AS code, c.category_name AS name,
                c.is_active AS isActive, ${classExpr} AS expenseClass,
                COUNT(DISTINCT r.financial_record_id) AS records, COALESCE(SUM(r.amount), 0) AS amount
           ${fromSql} WHERE ${w.sql}
          GROUP BY c.financial_category_id, c.category_code, c.category_name, c.is_active, expenseClass
          ORDER BY amount DESC, c.category_name ASC`,
        w.values,
      );
      return rows.map((row) => ({
        categoryId: String(row.categoryId),
        code: String(row.code),
        name: String(row.name),
        isActive: Boolean(row.isActive),
        expenseClass: String(row.expenseClass) as ExpenseClass,
        amount: fromCents(toCents(row.amount)),
        records: count(row.records),
      }));
    },

    async sourceTotals(filters, range) {
      const w = await where(filters, { range });
      const [rows] = await db().query<Row[]>(
        `SELECT r.source_module AS sourceModule, COUNT(DISTINCT r.financial_record_id) AS records, COALESCE(SUM(r.amount), 0) AS amount
           ${fromSql} WHERE ${w.sql} GROUP BY r.source_module ORDER BY amount DESC`,
        w.values,
      );
      return rows.map((row) => ({ sourceModule: String(row.sourceModule), records: count(row.records), amount: fromCents(toCents(row.amount)) }));
    },

    async matrixTotals(filters, range) {
      const w = await where(filters, { range });
      const [rows] = await db().query<Row[]>(
        `SELECT CAST(c.financial_category_id AS CHAR) AS categoryId, c.category_name AS name, r.source_module AS sourceModule,
                COUNT(DISTINCT r.financial_record_id) AS records, COALESCE(SUM(r.amount), 0) AS amount
           ${fromSql} WHERE ${w.sql}
          GROUP BY c.financial_category_id, c.category_name, r.source_module`,
        w.values,
      );
      return rows.map((row) => ({
        categoryId: String(row.categoryId),
        name: String(row.name),
        sourceModule: String(row.sourceModule),
        records: count(row.records),
        amount: fromCents(toCents(row.amount)),
      }));
    },

    async dailyTotals(filters, range) {
      const w = await where(filters, { range });
      const [rows] = await db().query<Row[]>(
        `SELECT DATE_FORMAT(r.record_date, '%Y-%m-%d') AS date, CAST(c.financial_category_id AS CHAR) AS categoryId, c.category_name AS name,
                COUNT(DISTINCT r.financial_record_id) AS records, COALESCE(SUM(r.amount), 0) AS amount
           ${fromSql} WHERE ${w.sql}
          GROUP BY r.record_date, c.financial_category_id, c.category_name
          ORDER BY r.record_date ASC`,
        w.values,
      );
      return rows.map((row) => ({ date: String(row.date), categoryId: String(row.categoryId), name: String(row.name), records: count(row.records), amount: fromCents(toCents(row.amount)) }));
    },

    async earliestDate(filters) {
      const w = await where(filters, { range: null });
      const [rows] = await db().query<Row[]>(`SELECT DATE_FORMAT(MIN(r.record_date), '%Y-%m-%d') AS earliest ${fromSql} WHERE ${w.sql}`, w.values);
      return rows[0]?.earliest ? String(rows[0].earliest) : null;
    },

    async listRecords(filters, view, sort, range, page, pageSize) {
      const w = await where(filters, { range, view });
      const caps = await capabilities();
      const [countRows] = await db().query<Row[]>(
        `SELECT COUNT(DISTINCT r.financial_record_id) AS total, COALESCE(SUM(r.amount), 0) AS amount ${fromSql} WHERE ${w.sql}`,
        w.values,
      );
      const direction = sort.sortDirection === "asc" ? "ASC" : "DESC";
      const [rows] = await db().query<Row[]>(
        `SELECT CAST(r.financial_record_id AS CHAR) AS id, r.record_number AS recordNumber,
                DATE_FORMAT(r.record_date, '%Y-%m-%d') AS recordDate,
                CAST(c.financial_category_id AS CHAR) AS categoryId, c.category_code AS categoryCode, c.category_name AS categoryName,
                c.category_type AS categoryType, r.source_module AS sourceModule, CAST(r.source_record_id AS CHAR) AS sourceRecordId,
                r.amount AS amount, r.record_status AS recordStatus, r.remarks AS remarks,
                CAST(r.recorded_by AS CHAR) AS recordedById, ru.display_name AS recordedByName,
                CAST(r.approved_by AS CHAR) AS postedById, pu.display_name AS postedByName,
                ${caps.seasons ? "CAST(r.season_id AS CHAR)" : "NULL"} AS seasonId,
                ${caps.seasons ? "s.season_name" : "NULL"} AS seasonName,
                r.created_at AS createdAt
           ${fromSql}
           LEFT JOIN users ru ON ru.user_id = r.recorded_by
           LEFT JOIN users pu ON pu.user_id = r.approved_by
           ${caps.seasons ? "LEFT JOIN seasons s ON s.season_id = r.season_id" : ""}
          WHERE ${w.sql}
          ORDER BY ${sortSql[sort.sortBy]} ${direction}, r.financial_record_id DESC
          ${limitOffsetSql(pageSize, (page - 1) * pageSize)}`,
        w.values,
      );
      return { records: rows.map(mapRecord), total: count(countRows[0]?.total), totalAmount: fromCents(toCents(countRows[0]?.amount)) };
    },

    async recordDetail(id) {
      const caps = await capabilities();
      const [rows] = await db().query<Row[]>(
        `SELECT CAST(r.financial_record_id AS CHAR) AS id, r.record_number AS recordNumber,
                DATE_FORMAT(r.record_date, '%Y-%m-%d') AS recordDate,
                CAST(c.financial_category_id AS CHAR) AS categoryId, c.category_code AS categoryCode, c.category_name AS categoryName,
                c.category_type AS categoryType, r.source_module AS sourceModule, CAST(r.source_record_id AS CHAR) AS sourceRecordId,
                r.amount AS amount, r.record_status AS recordStatus, r.remarks AS remarks,
                CAST(r.recorded_by AS CHAR) AS recordedById, ru.display_name AS recordedByName,
                CAST(r.approved_by AS CHAR) AS postedById, pu.display_name AS postedByName,
                ${caps.seasons ? "CAST(r.season_id AS CHAR)" : "NULL"} AS seasonId,
                ${caps.seasons ? "s.season_name" : "NULL"} AS seasonName,
                r.created_at AS createdAt,
                CAST(r.correction_of_record_id AS CHAR) AS correctionOfId, CAST(r.reversal_of_record_id AS CHAR) AS reversalOfId
           ${fromSql}
           LEFT JOIN users ru ON ru.user_id = r.recorded_by
           LEFT JOIN users pu ON pu.user_id = r.approved_by
           ${caps.seasons ? "LEFT JOIN seasons s ON s.season_id = r.season_id" : ""}
          WHERE r.financial_record_id = ? AND r.record_type = 'Expense'
          LIMIT 1`,
        [id],
      );
      const row = rows[0];
      if (!row) return null;
      const base = mapRecord(row);
      const described = describeExpense(row.remarks === null ? null : String(row.remarks), base.sourceModule, base.categoryName);
      const link = (value: Row) => ({ id: String(value.id), recordNumber: String(value.recordNumber), recordStatus: String(value.recordStatus) });
      const related = async (idValue: string | null) => {
        if (!idValue) return null;
        const [found] = await db().query<Row[]>(
          "SELECT CAST(financial_record_id AS CHAR) AS id, record_number AS recordNumber, record_status AS recordStatus FROM financial_records WHERE financial_record_id = ?",
          [idValue],
        );
        return found[0] ? link(found[0]) : null;
      };
      const [correctionOf, reversalOf] = await Promise.all([
        related(row.correctionOfId === null ? null : String(row.correctionOfId)),
        related(row.reversalOfId === null ? null : String(row.reversalOfId)),
      ]);
      const [correctedBy] = await db().query<Row[]>(
        "SELECT CAST(financial_record_id AS CHAR) AS id, record_number AS recordNumber, record_status AS recordStatus FROM financial_records WHERE correction_of_record_id = ? ORDER BY financial_record_id",
        [id],
      );
      const [reversedBy] = await db().query<Row[]>(
        "SELECT CAST(financial_record_id AS CHAR) AS id, record_number AS recordNumber, record_status AS recordStatus, amount FROM financial_records WHERE reversal_of_record_id = ? ORDER BY financial_record_id",
        [id],
      );
      const [history] = await db().query<Row[]>(
        `SELECT a.action AS action, a.action_time AS at, u.display_name AS byName, a.description AS description
           FROM audit_logs a LEFT JOIN users u ON u.user_id = a.user_id
          WHERE a.entity_table = 'financial_records' AND a.record_id = ?
          ORDER BY a.action_time ASC, a.audit_log_id ASC LIMIT 50`,
        [id],
      );
      return {
        ...base,
        description: described.description,
        remarks: row.remarks === null ? null : String(row.remarks),
        rental: described.rental,
        correctionOf,
        reversalOf,
        correctedBy: correctedBy.map(link),
        reversedBy: reversedBy.map((value) => ({ ...link(value), amount: fromCents(toCents(value.amount)) })),
        history: history.map((value) => ({
          action: String(value.action),
          at: iso(value.at),
          by: value.byName === null ? null : String(value.byName),
          description: value.description === null ? null : String(value.description),
        })),
        evidence: { available: false, note: "Supporting documents are not linked to financial records in the current database, so evidence coverage cannot be reported." },
        disbursement: { verified: false, note: "The ledger records when an expense was booked, not when or how it was paid. Actual disbursement is not verified here." },
      };
    },

    async integrity(filters, range, today) {
      const one = async (view: ExpenseRecordView, extra: string, values: Array<string | number> = [], scopeRange: ExpenseRange | null = range): Promise<CountAmount> => {
        const w = await where(filters, { range: scopeRange, view, ignoreClasses: true });
        const [rows] = await db().query<Row[]>(
          `SELECT COUNT(DISTINCT r.financial_record_id) AS records, COALESCE(SUM(r.amount), 0) AS amount ${fromSql} WHERE ${w.sql} ${extra}`,
          [...w.values, ...values],
        );
        return { records: count(rows[0]?.records), amount: fromCents(toCents(rows[0]?.amount)) };
      };
      const [unposted, unclassified, defaulted, reversalMismatch, reversalRows, voidedWithoutAudit, duplicates, inactiveCategory, futureDated, reversedUnlinked] = await Promise.all([
        one("unposted", ""),
        one("posted", `AND ${classExpr} = 'unclassified'`),
        one("posted", `AND ${registryBackedSql("r", "c")} = 0 AND ${classExpr} <> 'unclassified'`),
        one("all", `AND r.record_status = 'Active' AND EXISTS (SELECT 1 FROM financial_records x WHERE x.reversal_of_record_id = r.financial_record_id AND x.record_status = 'Active')`),
        one("all", "AND r.reversal_of_record_id IS NOT NULL"),
        one("voided", `AND NOT EXISTS (SELECT 1 FROM audit_logs a WHERE a.entity_table = 'financial_records' AND a.record_id = r.financial_record_id AND a.action = 'financial_record.voided')`),
        one("posted", `AND r.source_record_id IS NOT NULL AND (
            SELECT COUNT(*) FROM financial_records d
             WHERE d.record_type = 'Expense' AND d.record_status = 'Active' AND d.approved_by IS NOT NULL
               AND d.source_module = r.source_module AND d.source_record_id = r.source_record_id
               AND d.financial_category_id = r.financial_category_id AND d.amount = r.amount AND d.record_date = r.record_date) > 1`),
        one("posted", "AND c.is_active = 0"),
        one("posted", "AND r.record_date > ?", [today], { startDate: today, endDate: "9999-12-31" }),
        one("all", `AND r.record_status = 'Reversed' AND NOT EXISTS (SELECT 1 FROM financial_records x WHERE x.reversal_of_record_id = r.financial_record_id)`),
      ]);
      const mark = (count: number, bad: IntegrityCheck["status"]): IntegrityCheck["status"] => (count > 0 ? bad : "ok");
      const checks: IntegrityCheck[] = [
        { id: "unposted", label: "Unposted", status: mark(unposted.records, "review"), ...unposted, description: "Active expense records still waiting for a posting approver. They are not in any posted total.", drill: { view: "unposted" } },
        { id: "classification", label: "Classification missing", status: mark(unclassified.records, "review"), ...unclassified, description: "Posted expense rows on a category that is not an Expense category, so their economic nature cannot be established.", drill: { classes: ["unclassified"] } },
        { id: "classification-default", label: "Classified by default rule", status: mark(defaulted.records, "info"), ...defaulted, description: "Posted rows on an Expense category the classification registry does not name. They are counted as operating until the category is confirmed.", drill: null },
        { id: "reversal-mismatch", label: "Reconciliation difference", status: mark(reversalMismatch.records, "review"), ...reversalMismatch, description: "An Active expense that also has an Active reversal entry. Its status and its reversal disagree.", drill: { view: "all" } },
        { id: "reversed-unlinked", label: "Requires review", status: mark(reversedUnlinked.records, "review"), ...reversedUnlinked, description: "Expenses marked Reversed with no reversal entry pointing at them.", drill: { view: "corrected" } },
        { id: "reversal-entries", label: "Reversal entries typed as expense", status: mark(reversalRows.records, "info"), ...reversalRows, description: "Expense-typed rows that reverse another record. They are kept out of posted totals so the original is not offset twice.", drill: { view: "all" } },
        { id: "void-audit", label: "Voided without an audit entry", status: mark(voidedWithoutAudit.records, "review"), ...voidedWithoutAudit, description: "Voided expenses that have no financial_record.voided entry in the audit log.", drill: { view: "voided" } },
        { id: "duplicates", label: "Possible duplicate posting", status: mark(duplicates.records, "review"), ...duplicates, description: "Posted rows sharing the same source record, category, amount and date. Two real expenses can look alike, so confirm before acting.", drill: null },
        { id: "inactive-category", label: "Posted to an inactive category", status: mark(inactiveCategory.records, "info"), ...inactiveCategory, description: "Posted expenses on a category that has since been deactivated. History is unchanged.", drill: null },
        { id: "future-dated", label: "Dated after today", status: mark(futureDated.records, "info"), ...futureDated, description: "Posted expenses dated after today. Figures on this page count only dates up to today.", drill: null },
      ];
      return { checks, reviewCount: checks.filter((check) => check.status === "review").length };
    },

    async filterOptions() {
      const caps = await capabilities();
      const [categoryRows] = await db().query<Row[]>(
        `SELECT CAST(c.financial_category_id AS CHAR) AS id, c.category_code AS code, c.category_name AS name, c.category_type AS categoryType,
                c.is_active AS isActive, COUNT(r.financial_record_id) AS records
           FROM financial_categories c
           LEFT JOIN financial_records r ON r.financial_category_id = c.financial_category_id AND r.record_type = 'Expense'
          WHERE c.category_type IN ('Expense', 'Both') OR r.financial_record_id IS NOT NULL
          GROUP BY c.financial_category_id, c.category_code, c.category_name, c.category_type, c.is_active
          ORDER BY c.category_name ASC`,
      );
      const [sourceRows] = await db().query<Row[]>(
        "SELECT source_module AS value, COUNT(*) AS records FROM financial_records WHERE record_type = 'Expense' GROUP BY source_module ORDER BY source_module",
      );
      const [classRows] = await db().query<Row[]>(
        `SELECT ${classExpr} AS value, COUNT(*) AS records ${fromSql} WHERE ${viewSql.posted} GROUP BY value`,
      );
      const [recorders] = await db().query<Row[]>(
        `SELECT DISTINCT CAST(u.user_id AS CHAR) AS id, u.display_name AS name FROM financial_records r JOIN users u ON u.user_id = r.recorded_by
          WHERE r.record_type = 'Expense' ORDER BY u.display_name`,
      );
      const [posters] = await db().query<Row[]>(
        `SELECT DISTINCT CAST(u.user_id AS CHAR) AS id, u.display_name AS name FROM financial_records r JOIN users u ON u.user_id = r.approved_by
          WHERE r.record_type = 'Expense' ORDER BY u.display_name`,
      );
      let seasons: ExpenseFilterOptions["seasons"] = [];
      if (caps.seasons) {
        const [seasonRows] = await db().query<Row[]>("SELECT CAST(season_id AS CHAR) AS id, season_name AS name FROM seasons ORDER BY start_date DESC");
        seasons = seasonRows.map((row) => ({ id: String(row.id), name: String(row.name) }));
      }
      return {
        capabilities: caps,
        categories: categoryRows.map((row) => ({
          id: String(row.id),
          code: String(row.code),
          name: String(row.name),
          isActive: Boolean(row.isActive),
          expenseClass: classifyExpense({ categoryCode: String(row.code), categoryType: String(row.categoryType), sourceModule: null }).expenseClass,
          records: count(row.records),
        })),
        sourceModules: sourceRows.map((row) => ({ value: String(row.value), records: count(row.records) })),
        classes: classRows.map((row) => ({ value: String(row.value) as ExpenseClass, records: count(row.records) })),
        recordedBy: recorders.map((row) => ({ id: String(row.id), name: String(row.name) })),
        postedBy: posters.map((row) => ({ id: String(row.id), name: String(row.name) })),
        seasons,
      };
    },
  };
}
