import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import { getPool } from "../../db/pool";
import { AppError } from "../../utils/app-error";
import {
  postedOperatingSql,
  compatibleCategorySql,
  duplicatePostingSql,
  sourceMismatchSql,
  relationshipIssueSql as relationshipRule,
  brokenOperationalSourceSql,
} from "../finance/financial-posting-rules";
import {
  whereSql,
  type SqlFilter,
} from "../finance-monitoring/finance-monitoring.schema";
import {
  periodFor,
  cents,
  decimal,
  signedMoney,
  change,
  buildBuckets,
  type OverviewFilters,
  type OverviewPeriod,
} from "./overview.schema";
export type Executor = Pick<PoolConnection, "execute">;
type Row = RowDataPacket & Record<string, unknown>;
const from = `financial_records fr LEFT JOIN financial_categories fc ON fc.financial_category_id=fr.financial_category_id`;
export const relationshipIssueSql = relationshipRule();
const brokenOperationalSource = brokenOperationalSourceSql();
export const classificationIssue = `(NOT ${compatibleCategorySql()} OR fr.amount<=0)`;
export const sourceIssue = `(${sourceMismatchSql()} OR ${duplicatePostingSql()} OR ${brokenOperationalSource})`;
export const reviewSql = `(fr.record_type IN ('Income','Expense') AND ((fr.record_status='Active' AND (fr.approved_by IS NULL OR ${classificationIssue} OR ${sourceIssue})) OR ${relationshipIssueSql}))`;
export const includedSql = postedOperatingSql();
export type ActivityRecord = {
  id: string;
  number: string;
  date: string;
  type: string;
  categoryId: string | null;
  category: string;
  categoryCode: string;
  source: string;
  sourceId: string | null;
  amount: string;
  status: string;
  posted: boolean;
  eligible: boolean;
  review: boolean;
  description: string;
  recordedBy: { id: string; name: string };
  approvedBy: { id: string; name: string } | null;
  season: { id: string; name: string } | null;
  createdAt: string;
  correctionOfId: string | null;
  reversalOfId: string | null;
  paymentReferenceId: string | null;
  classificationReview: boolean;
  sourceReview: boolean;
  relationshipReview: boolean;
};
export type Totals = {
  income: string;
  expense: string;
  net: string;
  incomeRecords: number;
  expenseRecords: number;
};
export type CategoryTotal = {
  id: string;
  code: string;
  name: string;
  type: string;
  amount: string;
  records: number;
  share: number | null;
  active: boolean;
};
export type SourceTotal = {
  source: string;
  income: string;
  expense: string;
  net: string;
  records: number;
};
export type TrendPoint = {
  key: string;
  label: string;
  startDate: string;
  endDate: string;
  income: string;
  expense: string;
  net: string;
  records: number;
};
export type OverviewReport = {
  filters: OverviewFilters;
  period: OverviewPeriod;
  summary: Totals;
  previous: Totals | null;
  changes: {
    income: ReturnType<typeof change>;
    expense: ReturnType<typeof change>;
    net: ReturnType<typeof change>;
  };
  review: {
    records: number;
    unpostedIncome: number;
    unpostedExpense: number;
    classification: number;
    source: number;
    relationships: number;
    excluded: number;
  };
  categories: { income: CategoryTotal[]; expense: CategoryTotal[] };
  sources: SourceTotal[];
  trend: TrendPoint[];
  reconciliation: {
    incomeCategories: boolean;
    expenseCategories: boolean;
    incomeSources: boolean;
    expenseSources: boolean;
  };
  generatedAt: string;
};
export function recordScope(
  f: OverviewFilters,
  range: { startDate: string | null; endDate: string | null },
  seasons: boolean,
  activity = false,
): SqlFilter {
  const q: SqlFilter = { clauses: [], values: [] },
    eq = (column: string, value: string | undefined) => {
      if (value) {
        q.clauses.push(`${column}=?`);
        q.values.push(value);
      }
    };
  if (range.startDate) {
    q.clauses.push("fr.record_date>=?");
    q.values.push(range.startDate);
  }
  if (range.endDate) {
    q.clauses.push("fr.record_date<=?");
    q.values.push(range.endDate);
  }
  eq("fr.financial_category_id", f.categoryId);
  eq("fr.source_module", f.source);
  eq("fr.recorded_by", f.recordedBy);
  eq("fr.approved_by", f.approvedBy);
  if (f.seasonId) {
    if (!seasons)
      throw new AppError(
        "This database has no reliable financial season association.",
        422,
        "OVERVIEW_SEASON_UNAVAILABLE",
      );
    eq("fr.season_id", f.seasonId);
  }
  if (f.search) {
    const escaped = f.search.replace(/[\\%_]/g, "\\$&"),
      term = `%${escaped}%`;
    q.clauses.push(
      "(fr.record_number LIKE ? OR fc.category_name LIKE ? OR fr.remarks LIKE ? OR CAST(fr.source_record_id AS CHAR)=? OR EXISTS(SELECT 1 FROM payment_references search_ref WHERE search_ref.payment_reference_id=fr.payment_reference_id AND search_ref.reference_number LIKE ?))",
    );
    q.values.push(term, term, term, f.search, term);
  }
  if (f.amountMin !== undefined) {
    q.clauses.push("fr.amount>=?");
    q.values.push(f.amountMin);
  }
  if (f.amountMax !== undefined) {
    q.clauses.push("fr.amount<=?");
    q.values.push(f.amountMax);
  }
  if (activity) {
    eq("fr.financial_category_id", f.focusCategoryId);
    eq("fr.source_module", f.focusSource);
    if (f.focusStart) {
      q.clauses.push("fr.record_date>=? AND fr.record_date<=?");
      q.values.push(f.focusStart, f.focusEnd!);
    }
    const view = {
      posted: includedSql,
      income: `${includedSql} AND fr.record_type='Income'`,
      expense: `${includedSql} AND fr.record_type='Expense'`,
      review: reviewSql,
      history: "fr.record_type IN ('Income','Expense')",
      adjustments: "fr.record_type='Adjustment'",
    }[f.view];
    q.clauses.push(view);
    if (f.recordStatus) eq("fr.record_status", f.recordStatus);
    if (f.posting)
      q.clauses.push(
        `fr.approved_by IS ${f.posting === "posted" ? "NOT " : ""}NULL`,
      );
    if (f.reviewKind) {
      q.clauses.push(
        (
          {
            unpostedIncome:
              "fr.record_status='Active' AND fr.approved_by IS NULL AND fr.record_type='Income'",
            unpostedExpense:
              "fr.record_status='Active' AND fr.approved_by IS NULL AND fr.record_type='Expense'",
            classification: classificationIssue,
            source: sourceIssue,
            relationships: relationshipIssueSql,
          } as const
        )[f.reviewKind],
      );
    }
  }
  return q;
}
const money = (r: Row, key: string) => decimal(r[key]);
const n = (r: Row, key: string) => Number(r[key] ?? 0);
async function seasonsAvailable(c: Executor) {
  const [rows] = await c.execute<Row[]>(
    "SELECT TABLE_NAME AS tableName,COLUMN_NAME AS columnName FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND ((TABLE_NAME='financial_records' AND COLUMN_NAME='season_id') OR (TABLE_NAME='seasons' AND COLUMN_NAME IN ('season_id','season_name')))",
  );
  return (
    rows.some((r) => r.tableName === "financial_records") &&
    rows.filter((r) => r.tableName === "seasons").length === 2
  );
}
async function totals(c: Executor, q: SqlFilter): Promise<Totals> {
  const [rows] = await c.execute<Row[]>(
    `SELECT COALESCE(SUM(CASE WHEN fr.record_type='Income' THEN fr.amount ELSE 0 END),0) AS income,COALESCE(SUM(CASE WHEN fr.record_type='Expense' THEN fr.amount ELSE 0 END),0) AS expense,SUM(fr.record_type='Income') AS incomeRecords,SUM(fr.record_type='Expense') AS expenseRecords FROM ${from}${whereSql({ ...q, clauses: [...q.clauses, includedSql] })}`,
    q.values,
  );
  const r = rows[0] ?? ({} as Row);
  return {
    income: money(r, "income"),
    expense: money(r, "expense"),
    net: signedMoney(cents(money(r, "income")) - cents(money(r, "expense"))),
    incomeRecords: n(r, "incomeRecords"),
    expenseRecords: n(r, "expenseRecords"),
  };
}
export function createOverviewRepository(
  pool?: Pool,
  clock = () => new Date(),
) {
  const db = () => pool ?? getPool();
  async function snapshot<T>(fn: (c: Executor) => Promise<T>) {
    const c = await db().getConnection();
    try {
      await c.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ");
      await c.query("START TRANSACTION READ ONLY");
      const result = await fn(c);
      await c.commit();
      return result;
    } catch (e) {
      await c.rollback();
      if (
        ["ER_NO_SUCH_TABLE", "ER_BAD_FIELD_ERROR"].includes(
          (e as { code: string }).code,
        )
      )
        throw new AppError(
          "Required financial posting tables or columns are unavailable. Verify existing finance migrations.",
          503,
          "OVERVIEW_SCHEMA_REQUIRED",
        );
      throw e;
    } finally {
      c.release();
    }
  }
  async function report(
    c: Executor,
    f: OverviewFilters,
  ): Promise<OverviewReport> {
    const period = periodFor(f, clock()),
      caps = await seasonsAvailable(c),
      q = recordScope(f, period.effective, caps),
      summary = await totals(c, q),
      previous = period.previous
        ? await totals(c, recordScope(f, period.previous, caps))
        : null;
    const [reviews] = await c.execute<Row[]>(
      `SELECT SUM(${reviewSql}) AS records,SUM(fr.record_status='Active' AND fr.record_type='Income' AND fr.approved_by IS NULL) AS unpostedIncome,SUM(fr.record_status='Active' AND fr.record_type='Expense' AND fr.approved_by IS NULL) AS unpostedExpense,SUM(${reviewSql} AND ${classificationIssue}) AS classification,SUM(${reviewSql} AND ${sourceIssue}) AS source,SUM(${reviewSql} AND ${relationshipIssueSql}) AS relationships,SUM(fr.record_status='Active' AND fr.approved_by IS NOT NULL AND fr.record_type IN ('Income','Expense') AND NOT ${includedSql}) AS excluded FROM ${from}${whereSql(q)}`,
      q.values,
    );
    const [categoryRows] = await c.execute<Row[]>(
      `SELECT CAST(fc.financial_category_id AS CHAR) AS id,fc.category_code AS code,fc.category_name AS name,fc.is_active AS active,fr.record_type AS type,COALESCE(SUM(fr.amount),0) AS amount,COUNT(*) AS records FROM ${from}${whereSql({ ...q, clauses: [...q.clauses, includedSql] })} GROUP BY fc.financial_category_id,fc.category_code,fc.category_name,fc.is_active,fr.record_type ORDER BY SUM(fr.amount) DESC,fc.financial_category_id`,
      q.values,
    );
    const categories = {
      income: [] as CategoryTotal[],
      expense: [] as CategoryTotal[],
    };
    for (const r of categoryRows) {
      const type = String(r.type) === "Income" ? "income" : "expense",
        base = cents(summary[type]),
        part = cents(money(r, "amount"));
      categories[type].push({
        id: String(r.id),
        code: String(r.code),
        name: String(r.name),
        type: String(r.type),
        active: Boolean(Number(r.active)),
        amount: money(r, "amount"),
        records: n(r, "records"),
        share:
          base > BigInt(0) ? Number((part * BigInt(10000)) / base) / 100 : null,
      });
    }
    const [sourceRows] = await c.execute<Row[]>(
      `SELECT fr.source_module AS source,COALESCE(SUM(CASE WHEN fr.record_type='Income' THEN fr.amount ELSE 0 END),0) AS income,COALESCE(SUM(CASE WHEN fr.record_type='Expense' THEN fr.amount ELSE 0 END),0) AS expense,COUNT(*) AS records FROM ${from}${whereSql({ ...q, clauses: [...q.clauses, includedSql] })} GROUP BY fr.source_module ORDER BY SUM(fr.amount) DESC,fr.source_module`,
      q.values,
    );
    const sources = sourceRows.map((r) => ({
      source: String(r.source),
      income: money(r, "income"),
      expense: money(r, "expense"),
      net: signedMoney(cents(money(r, "income")) - cents(money(r, "expense"))),
      records: n(r, "records"),
    }));
    let first = period.effective.startDate;
    if (!first) {
      const [dates] = await c.execute<Row[]>(
        `SELECT MIN(fr.record_date) AS firstDate FROM ${from}${whereSql({ ...q, clauses: [...q.clauses, includedSql] })}`,
        q.values,
      );
      const value = dates[0]?.firstDate;
      first =
        value instanceof Date
          ? value.toISOString().slice(0, 10)
          : value
            ? String(value).slice(0, 10)
            : period.today;
    }
    const end = period.effective.endDate ?? period.today;
    const buckets = buildBuckets(
      { startDate: first, endDate: end },
      f.granularity,
    );
    if (buckets.length > 1500)
      throw new AppError(
        "Choose a larger trend interval for this reporting range.",
        422,
        "OVERVIEW_TREND_RANGE",
      );
    const [daily] = await c.execute<Row[]>(
      `SELECT DATE_FORMAT(fr.record_date,'%Y-%m-%d') AS day,fr.record_type AS type,COALESCE(SUM(fr.amount),0) AS amount,COUNT(*) AS records FROM ${from}${whereSql({ ...q, clauses: [...q.clauses, includedSql] })} GROUP BY fr.record_date,fr.record_type ORDER BY fr.record_date`,
      q.values,
    );
    const trend = buckets.map((b) => {
      let incoming = BigInt(0),
        outgoing = BigInt(0),
        records = 0;
      for (const r of daily) {
        if (String(r.day) < b.startDate || String(r.day) > b.endDate) continue;
        if (r.type === "Income") incoming += cents(money(r, "amount"));
        else outgoing += cents(money(r, "amount"));
        records += n(r, "records");
      }
      return {
        ...b,
        income: signedMoney(incoming),
        expense: signedMoney(outgoing),
        net: signedMoney(incoming - outgoing),
        records,
      };
    });
    const rv = reviews[0] ?? ({} as Row),
      sum = (rows: { amount: string }[]) =>
        rows.reduce((s, r) => s + cents(r.amount), BigInt(0));
    return {
      filters: f,
      period,
      summary,
      previous,
      changes: {
        income: change(summary.income, previous?.income ?? null),
        expense: change(summary.expense, previous?.expense ?? null),
        net: change(summary.net, previous?.net ?? null),
      },
      review: {
        records: n(rv, "records"),
        unpostedIncome: n(rv, "unpostedIncome"),
        unpostedExpense: n(rv, "unpostedExpense"),
        classification: n(rv, "classification"),
        source: n(rv, "source"),
        relationships: n(rv, "relationships"),
        excluded: n(rv, "excluded"),
      },
      categories,
      sources,
      trend,
      reconciliation: {
        incomeCategories: sum(categories.income) === cents(summary.income),
        expenseCategories: sum(categories.expense) === cents(summary.expense),
        incomeSources:
          sources.reduce((s, r) => s + cents(r.income), BigInt(0)) ===
          cents(summary.income),
        expenseSources:
          sources.reduce((s, r) => s + cents(r.expense), BigInt(0)) ===
          cents(summary.expense),
      },
      generatedAt: clock().toISOString(),
    };
  }
  async function list(c: Executor, f: OverviewFilters, all = false) {
    const period = periodFor(f, clock()),
      caps = await seasonsAvailable(c),
      q = recordScope(f, period.effective, caps, true);
    const [counts] = await c.execute<Row[]>(
      `SELECT COUNT(*) AS total,COALESCE(SUM(fr.amount),0) AS amount FROM ${from}${whereSql(q)}`,
      q.values,
    );
    const total = Number(counts[0]?.total ?? 0);
    if (all && total > 100000)
      throw new AppError(
        "Export exceeds 100,000 rows. Narrow the filters; no partial export was generated.",
        422,
        "OVERVIEW_EXPORT_TOO_LARGE",
      );
    const page = Math.min(f.page, Math.max(1, Math.ceil(total / f.pageSize))),
      order = {
        date: "fr.record_date",
        number: "fr.record_number",
        type: "fr.record_type",
        category: "fc.category_name",
        source: "fr.source_module",
        amount: "fr.amount",
        posting: "fr.approved_by",
      }[f.sortBy];
    const [rows] = await c.execute<Row[]>(
      `SELECT ${selection(caps)} FROM ${from} LEFT JOIN users ru ON ru.user_id=fr.recorded_by LEFT JOIN users au ON au.user_id=fr.approved_by ${caps ? "LEFT JOIN seasons se ON se.season_id=fr.season_id" : ""}${whereSql(q)} ORDER BY ${order} ${f.sortDirection === "asc" ? "ASC" : "DESC"},fr.financial_record_id DESC ${all ? "" : `LIMIT ${f.pageSize} OFFSET ${(page - 1) * f.pageSize}`}`,
      q.values,
    );
    return {
      items: rows.map(mapRecord),
      total,
      page,
      pageSize: f.pageSize,
      amount: decimal(counts[0]?.amount),
    };
  }
  function selection(caps: boolean) {
    return `CAST(fr.financial_record_id AS CHAR) AS id,fr.record_number AS number,DATE_FORMAT(fr.record_date,'%Y-%m-%d') AS date,fr.record_type AS type,CAST(fr.financial_category_id AS CHAR) AS categoryId,fc.category_name AS category,fc.category_code AS categoryCode,fr.source_module AS source,CAST(fr.source_record_id AS CHAR) AS sourceId,CAST(fr.amount AS CHAR) AS amount,fr.record_status AS status,fr.approved_by IS NOT NULL AS posted,${includedSql} AS eligible,${reviewSql} AS review,fr.remarks,CAST(fr.recorded_by AS CHAR) AS recordedById,ru.display_name AS recordedByName,CAST(fr.approved_by AS CHAR) AS approvedById,au.display_name AS approvedByName,${caps ? "CAST(fr.season_id AS CHAR)" : "NULL"} AS seasonId,${caps ? "se.season_name" : "NULL"} AS seasonName,CAST(fr.created_at AS CHAR) AS createdAt,CAST(fr.correction_of_record_id AS CHAR) AS correctionOfId,CAST(fr.reversal_of_record_id AS CHAR) AS reversalOfId,CAST(fr.payment_reference_id AS CHAR) AS paymentReferenceId,${classificationIssue} AS classificationReview,${sourceIssue} AS sourceReview,${relationshipIssueSql} AS relationshipReview`;
  }
  function mapRecord(r: Row): ActivityRecord {
    return {
      id: String(r.id),
      number: String(r.number),
      date: String(r.date),
      type: String(r.type),
      categoryId: r.categoryId ? String(r.categoryId) : null,
      category: String(r.category ?? "Missing category"),
      categoryCode: String(r.categoryCode ?? ""),
      source: String(r.source),
      sourceId: r.sourceId ? String(r.sourceId) : null,
      amount: decimal(r.amount),
      status: String(r.status),
      posted: Boolean(Number(r.posted)),
      eligible: Boolean(Number(r.eligible)),
      review: Boolean(Number(r.review)),
      description: r.remarks ? String(r.remarks) : String(r.category ?? ""),
      recordedBy: {
        id: String(r.recordedById),
        name: String(r.recordedByName ?? "Unknown user"),
      },
      approvedBy: r.approvedById
        ? {
            id: String(r.approvedById),
            name: String(r.approvedByName ?? "Unknown user"),
          }
        : null,
      season: r.seasonId
        ? { id: String(r.seasonId), name: String(r.seasonName) }
        : null,
      createdAt: String(r.createdAt),
      correctionOfId: r.correctionOfId ? String(r.correctionOfId) : null,
      reversalOfId: r.reversalOfId ? String(r.reversalOfId) : null,
      paymentReferenceId: r.paymentReferenceId
        ? String(r.paymentReferenceId)
        : null,
      classificationReview: Boolean(Number(r.classificationReview)),
      sourceReview: Boolean(Number(r.sourceReview)),
      relationshipReview: Boolean(Number(r.relationshipReview)),
    };
  }
  return {
    snapshot,
    report,
    list,
    summary: (f: OverviewFilters) => snapshot((c) => report(c, f)),
    activity: (f: OverviewFilters) => snapshot((c) => list(c, f)),
    options: () =>
      snapshot(async (c) => {
        const [categories] = await c.execute<Row[]>(
          "SELECT CAST(financial_category_id AS CHAR) AS id,category_code AS code,category_name AS name,category_type AS type,is_active AS active FROM financial_categories ORDER BY category_name",
        );
        const [actors] = await c.execute<Row[]>(
          "SELECT CAST(user_id AS CHAR) AS id,display_name AS name FROM users WHERE user_id IN (SELECT recorded_by FROM financial_records UNION SELECT approved_by FROM financial_records) ORDER BY display_name",
        );
        const caps = await seasonsAvailable(c);
        const [seasons] = caps
          ? await c.execute<Row[]>(
              "SELECT CAST(season_id AS CHAR) AS id,season_name AS name FROM seasons ORDER BY season_name",
            )
          : [[]];
        return {
          categories: categories.map((r) => ({
            ...r,
            active: Boolean(Number(r.active)),
          })),
          actors,
          seasons,
          capabilities: { seasons: caps },
        };
      }),
    detail: (id: string) =>
      snapshot(async (c) => {
        const caps = await seasonsAvailable(c);
        const [rows] = await c.execute<Row[]>(
          `SELECT ${selection(caps)},fr.remarks FROM ${from} LEFT JOIN users ru ON ru.user_id=fr.recorded_by LEFT JOIN users au ON au.user_id=fr.approved_by ${caps ? "LEFT JOIN seasons se ON se.season_id=fr.season_id" : ""} WHERE fr.financial_record_id=?`,
          [id],
        );
        if (!rows[0])
          throw new AppError(
            "Financial record was not found.",
            404,
            "FINANCIAL_RECORD_NOT_FOUND",
          );
        const row = mapRecord(rows[0]);
        const [related] = await c.execute<Row[]>(
          "SELECT CAST(financial_record_id AS CHAR) AS id,record_number AS number,record_type AS type,record_status AS status,CAST(amount AS CHAR) AS amount FROM financial_records WHERE financial_record_id IN (?,?) OR correction_of_record_id=? OR reversal_of_record_id=? ORDER BY financial_record_id LIMIT 100",
          [row.correctionOfId, row.reversalOfId, id, id],
        );
        const [history] = await c.execute<Row[]>(
          "SELECT action,CAST(action_time AS CHAR) AS at,description,users.display_name AS actor FROM audit_logs LEFT JOIN users ON users.user_id=audit_logs.user_id WHERE entity_table='financial_records' AND record_id=? ORDER BY action_time,audit_log_id LIMIT 100",
          [id],
        );
        const [payment] = row.paymentReferenceId
          ? await c.execute<Row[]>(
              "SELECT CAST(payment_reference_id AS CHAR) AS id,reference_number AS reference,payment_purpose AS purpose,payment_channel AS channel,gateway_environment AS environment,validation_status AS status,CAST(amount AS CHAR) AS amount FROM payment_references WHERE payment_reference_id=?",
              [row.paymentReferenceId],
            )
          : [[]];
        const [docColumns] = await c.execute<Row[]>(
          "SELECT COLUMN_NAME AS columnName FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='documents' AND COLUMN_NAME IN ('related_module','related_record_id')",
        );
        const [documents] =
          docColumns.length === 2
            ? await c.execute<Row[]>(
                "SELECT CAST(document_id AS CHAR) AS id,title,document_type AS type FROM documents WHERE related_module IN ('Finance','Financial Record','financial_records') AND related_record_id=? AND document_status='Active' AND access_level IN ('Admin-only','Public') ORDER BY uploaded_at DESC LIMIT 30",
                [id],
              )
            : [[]];
        return {
          ...row,
          remarks: rows[0].remarks ? String(rows[0].remarks) : null,
          related,
          history,
          documents,
          documentAssociationsAvailable: docColumns.length === 2,
          payment: payment[0] ?? null,
          evidenceNote:
            "Use the source payment review for its authorized receipt and proof. A remark or uploaded filename does not prove cash settlement.",
        };
      }),
  };
}
export type OverviewRepository = ReturnType<typeof createOverviewRepository>;
