import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import { getPool } from "../../db/pool";
import { AppError } from "../../utils/app-error";
import { capitalMovementSql, postedOperatingSql, postedRecordSql } from "../finance/financial-posting-rules";
import type {
  CapitalContext, CategoryOption, FinancialAnalyticsFilters, FinancialAnalyticsSources, FinancialFact, IntegrityIssue, IntegritySources,
} from "./financial-analytics.types";

/** Columns required per table. Required tables fail loudly; optional ones degrade to "unavailable". */
export const REQUIRED_FINANCIAL_COLUMNS: Record<string, string[]> = {
  financial_records: ["financial_record_id", "record_number", "payment_reference_id", "financial_category_id", "approved_by", "record_type", "source_module", "source_record_id", "amount", "record_date", "record_status"],
  financial_categories: ["financial_category_id", "category_code", "category_name", "category_type", "is_active"],
};
export const OPTIONAL_FINANCIAL_COLUMNS: Record<string, string[]> = {
  payment_references: ["payment_reference_id", "reference_number", "validation_status", "validated_at", "payment_purpose", "amount"],
  pos_sales: ["pos_sale_id", "sale_number", "sale_status", "payment_status", "total_amount", "sale_date"],
  share_capital_accounts: ["current_balance"],
  share_capital_transactions: ["transaction_date", "transaction_type", "direction", "amount", "transaction_status"],
};
const REFERENCE_LIMIT = 25;
const RECONCILED_PURPOSES = ["Associate Membership Fee", "POS/Product", "Rental"];

const centsToPeso = (cents: unknown) => Math.round(Number(cents ?? 0)) / 100;
const escapeLike = (value: string) => value.replace(/[\\%_]/g, match => `\\${match}`);

export function createFinancialAnalyticsRepository(injectedPool?: Pool) {
  const pool = () => injectedPool ?? getPool();

  async function withReadConnection<T>(work: (query: <R>(sql: string, values?: Array<string | number>) => Promise<R[]>, connection: PoolConnection) => Promise<T>) {
    const connection = await pool().getConnection();
    const query = async <R>(sql: string, values: Array<string | number> = []) => {
      const [rows] = await connection.execute<RowDataPacket[]>(sql, values);
      return rows as R[];
    };
    try {
      await connection.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY");
      await connection.beginTransaction();
      const result = await work(query, connection);
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async function capabilities(query: <R>(sql: string, values?: Array<string | number>) => Promise<R[]>) {
    const all = { ...REQUIRED_FINANCIAL_COLUMNS, ...OPTIONAL_FINANCIAL_COLUMNS };
    const tables = Object.keys(all);
    const columns = await query<{ tableName: string; columnName: string }>(
      `SELECT TABLE_NAME AS tableName, COLUMN_NAME AS columnName FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (${tables.map(() => "?").join(",")})`, tables);
    const result = Object.fromEntries(tables.map(table => [table, all[table].every(name => columns.some(column => column.tableName === table && column.columnName === name))]));
    if (!result.financial_records || !result.financial_categories) {
      throw new AppError("Financial analytics requires the current financial_records and financial_categories schema; check the database migrations", 503, "ANALYTICS_SOURCE_UNAVAILABLE");
    }
    return result;
  }

  return {
    /** Earliest eligible ledger date (any category), used to define where reliable coverage begins. */
    async firstRecordDate(asOf: string): Promise<string | null> {
      return withReadConnection(async query => {
        await capabilities(query);
        const rows = await query<{ first: string | null }>(
          `SELECT DATE_FORMAT(MIN(fr.record_date), '%Y-%m-%d') AS \`first\`
             FROM financial_records fr LEFT JOIN financial_categories fc ON fc.financial_category_id = fr.financial_category_id
            WHERE ${postedOperatingSql("fr", "fc")} AND fr.record_date <= ?`, [asOf]);
        return rows[0]?.first ?? null;
      });
    },

    async load(filters: FinancialAnalyticsFilters, firstRecordDate: string | null): Promise<FinancialAnalyticsSources> {
      return withReadConnection(async query => {
        const caps = await capabilities(query);
        const categories = (await query<{ id: string; code: string; name: string; type: CategoryOption["type"]; isActive: number }>(
          "SELECT CAST(financial_category_id AS CHAR) AS id, category_code AS code, category_name AS name, category_type AS type, is_active AS isActive FROM financial_categories ORDER BY category_name"))
          .map(row => ({ ...row, isActive: Boolean(row.isActive) }));

        // Facts: one row per day × type × category × source. Record-level filters apply here; dates are sliced by the engine.
        const where = [postedOperatingSql("fr", "fc"), "fr.record_date <= ?"];
        const values: Array<string | number> = [filters.asOf];
        if (filters.categoryIds.length) { where.push(`fr.financial_category_id IN (${filters.categoryIds.map(() => "?").join(",")})`); values.push(...filters.categoryIds); }
        if (filters.sourceModules.length) { where.push(`fr.source_module IN (${filters.sourceModules.map(() => "?").join(",")})`); values.push(...filters.sourceModules); }
        if (filters.minAmount !== null) { where.push("fr.amount >= ?"); values.push(filters.minAmount); }
        if (filters.maxAmount !== null) { where.push("fr.amount <= ?"); values.push(filters.maxAmount); }
        if (filters.reference) { where.push("(fr.record_number LIKE ? OR CAST(fr.source_record_id AS CHAR) = ?)"); values.push(`%${escapeLike(filters.reference)}%`, filters.reference); }
        const factRows = await query<{ date: string; type: FinancialFact["type"]; categoryId: string; source: FinancialFact["source"]; cents: number | string; count: number | string }>(
          `SELECT DATE_FORMAT(fr.record_date, '%Y-%m-%d') AS date, fr.record_type AS type, CAST(fr.financial_category_id AS CHAR) AS categoryId, fr.source_module AS source,
                  CAST(ROUND(SUM(fr.amount) * 100) AS SIGNED) AS cents, COUNT(*) AS count
             FROM financial_records fr LEFT JOIN financial_categories fc ON fc.financial_category_id = fr.financial_category_id
            WHERE ${where.join(" AND ")}
            GROUP BY fr.record_date, fr.record_type, fr.financial_category_id, fr.source_module
            ORDER BY fr.record_date ASC`, values);
        const facts: FinancialFact[] = factRows.map(row => ({ ...row, cents: Number(row.cents), count: Number(row.count) }));

        const { integrity, excluded } = await loadIntegrity(query, caps, filters);
        const capital = await loadCapital(query, caps, filters, excluded);
        return { facts, categories, integrity, capital, firstRecordDate, capabilities: caps };
      });
    },
  };
}

type Query = <R>(sql: string, values?: Array<string | number>) => Promise<R[]>;

async function loadIntegrity(query: Query, caps: Record<string, boolean>, filters: FinancialAnalyticsFilters) {
  const range = [filters.start, filters.end];
  const dateRange = { from: filters.start, to: filters.end };
  const inRange = "fr.record_date BETWEEN ? AND ?";
  const ledgerBase = { startDate: filters.start, endDate: filters.end };

  type RefRow = { reference: string; date: string | null; cents: number | string | null; module: string | null };
  const issue = (base: Omit<IntegrityIssue, "references" | "truncated" | "link" | "dateRange">, refs: RefRow[], total: number, link: { href: string; label: string } | null): IntegrityIssue => ({
    ...base, dateRange, references: refs.slice(0, REFERENCE_LIMIT).map(row => ({ reference: row.reference, date: row.date, amount: row.cents === null ? null : centsToPeso(row.cents), module: row.module })),
    truncated: total > REFERENCE_LIMIT, link,
  });
  const unavailable = (code: IntegrityIssue["code"], title: string, rule: string, missing: string): IntegrityIssue => ({
    code, title, label: "Informational", available: false, count: 0, amount: null, dateRange, rule, limitation: `Not checked: ${missing} is not available in this database. Missing data is not zero.`,
    references: [], truncated: false, modules: [], ledgerQuery: null, link: null,
  });
  const ledgerRows = (condition: string) => query<RefRow>(
    `SELECT fr.record_number AS reference, DATE_FORMAT(fr.record_date, '%Y-%m-%d') AS date, CAST(ROUND(fr.amount * 100) AS SIGNED) AS cents, fr.source_module AS module
       FROM financial_records fr LEFT JOIN financial_categories fc ON fc.financial_category_id = fr.financial_category_id
      WHERE ${inRange} AND ${condition} ORDER BY fr.record_date DESC, fr.financial_record_id DESC LIMIT ${REFERENCE_LIMIT}`, range);
  const ledgerTotals = async (condition: string) => {
    const rows = await query<{ count: number | string; cents: number | string | null; modules: string | null }>(
      `SELECT COUNT(*) AS count, CAST(ROUND(SUM(fr.amount) * 100) AS SIGNED) AS cents, GROUP_CONCAT(DISTINCT fr.source_module) AS modules
         FROM financial_records fr LEFT JOIN financial_categories fc ON fc.financial_category_id = fr.financial_category_id
        WHERE ${inRange} AND ${condition}`, range);
    return { count: Number(rows[0]?.count ?? 0), cents: rows[0]?.cents ?? null, modules: rows[0]?.modules ? rows[0].modules.split(",") : [] };
  };
  const ledgerIssue = async (code: IntegrityIssue["code"], title: string, label: IntegrityIssue["label"], rule: string, condition: string, ledgerQuery: Record<string, string>, limitation: string | null) => {
    const totals = await ledgerTotals(condition);
    return issue({ code, title, label, available: true, count: totals.count, amount: totals.cents === null ? null : centsToPeso(totals.cents), rule, limitation, modules: totals.modules, ledgerQuery: { ...ledgerBase, ...ledgerQuery } },
      await ledgerRows(condition), totals.count, { href: "/portal/chairman/financial-ledger", label: "Open in Financial Ledger" });
  };

  const posted = await ledgerTotals(postedOperatingSql("fr", "fc"));
  const issues: IntegrityIssue[] = [];
  issues.push(await ledgerIssue("unposted", "Unposted records", "Unposted",
    "Active Income or Expense records with no approver. They are drafts until a bookkeeper posts them and are excluded from every total.",
    `fr.record_status = 'Active' AND fr.approved_by IS NULL AND fr.record_type IN ('Income', 'Expense')`, { posting: "unposted" }, null));
  issues.push(await ledgerIssue("classification", "Category type mismatch", "Classification Issue",
    "Posted records whose category is defined only for the opposite type (an Income record in an Expense-only category, or the reverse).",
    `${postedRecordSql("fr")} AND ((fr.record_type = 'Income' AND fc.category_type = 'Expense') OR (fr.record_type = 'Expense' AND fc.category_type = 'Income'))`, {},
    "The mismatch may be a category setup choice rather than an entry error; totals follow the record type."));
  issues.push(await ledgerIssue("voided", "Voided records", "Informational", "Records with status Voided. Voiding is a normal correction workflow; these never enter totals.", `fr.record_status = 'Voided'`, { recordStatus: "Voided" }, null));
  issues.push(await ledgerIssue("corrected-or-reversed", "Corrected or reversed records", "Informational",
    "Records with status Corrected or Reversed. A payment reversal marks the original Reversed and posts an offsetting Adjustment; both are kept out of operating totals so they are not counted as unrelated transactions.",
    `fr.record_status IN ('Corrected', 'Reversed')`, { recordStatus: "Reversed" }, null));
  issues.push(await ledgerIssue("adjustments", "Posted adjustments", "Informational",
    "Posted Adjustment records (for example payment reversals). They are reported separately and do not change operating income or expenses.",
    `${postedRecordSql("fr")} AND fr.record_type = 'Adjustment'`, { recordType: "Adjustment" }, null));

  const excludedRows = await query<{ type: string; cents: number | string | null; count: number | string }>(
    `SELECT fr.record_type AS type, CAST(ROUND(SUM(fr.amount) * 100) AS SIGNED) AS cents, COUNT(*) AS count
       FROM financial_records fr LEFT JOIN financial_categories fc ON fc.financial_category_id = fr.financial_category_id
      WHERE ${inRange} AND ${postedRecordSql("fr")} AND fr.record_type IN ('Income', 'Expense') AND ${capitalMovementSql("fr", "fc")} GROUP BY fr.record_type`, range);
  const excluded = {
    income: centsToPeso(excludedRows.find(row => row.type === "Income")?.cents), expense: centsToPeso(excludedRows.find(row => row.type === "Expense")?.cents),
    count: excludedRows.reduce((total, row) => total + Number(row.count), 0),
  };
  issues.push(await ledgerIssue("excluded-capital", "Share-capital movements kept out of operating totals", "Informational",
    "Posted Income or Expense rows from the Share Capital module (member contributions, dividend withdrawals) or a share-capital category. They are capital movements, not operating results.",
    `${postedRecordSql("fr")} AND fr.record_type IN ('Income', 'Expense') AND ${capitalMovementSql("fr", "fc")}`, { sourceModules: "Share Capital" },
    "No approved accounting policy exists for treating these as operating items, so they are excluded and shown here for transparency."));

  const reconciliation: IntegritySources["reconciliation"] = [];
  if (caps.payment_references) {
    const purposes = RECONCILED_PURPOSES.map(() => "?").join(",");
    const base = `FROM payment_references pr WHERE pr.validation_status = 'Validated' AND pr.payment_purpose IN (${purposes})
                    AND DATE(DATE_ADD(pr.validated_at, INTERVAL 8 HOUR)) BETWEEN ? AND ?
                    AND NOT EXISTS (SELECT 1 FROM financial_records fx WHERE fx.payment_reference_id = pr.payment_reference_id)`;
    const params = [...RECONCILED_PURPOSES, ...range];
    const totals = await query<{ count: number | string; cents: number | string | null; modules: string | null }>(
      `SELECT COUNT(*) AS count, CAST(ROUND(SUM(pr.amount) * 100) AS SIGNED) AS cents, GROUP_CONCAT(DISTINCT pr.payment_purpose) AS modules ${base}`, params);
    const refs = await query<RefRow>(
      `SELECT pr.reference_number AS reference, DATE_FORMAT(DATE_ADD(pr.validated_at, INTERVAL 8 HOUR), '%Y-%m-%d') AS date, CAST(ROUND(pr.amount * 100) AS SIGNED) AS cents, pr.payment_purpose AS module ${base}
        ORDER BY pr.validated_at DESC LIMIT ${REFERENCE_LIMIT}`, params);
    const count = Number(totals[0]?.count ?? 0);
    issues.push(issue({ code: "unmatched-payment-postings", title: "Validated payments without a ledger posting", label: "Unmatched", available: true, count, amount: totals[0]?.cents === null || totals[0]?.cents === undefined ? null : centsToPeso(totals[0].cents),
      rule: "Validated payment references for membership fees, POS/product and rental payments that have no linked financial record of any status.",
      limitation: "Posting can lag settlement, and some payment purposes are intentionally posted elsewhere (for example share capital). Only purposes with a ledger posting rule are checked.",
      modules: totals[0]?.modules ? totals[0].modules.split(",") : [], ledgerQuery: null }, refs, count, { href: "/portal/chairman/payments", label: "Open Payment Validation" }));

    for (const [module, purpose, source] of [["Rental", "Rental", "Rental"], ["Membership", "Associate Membership Fee", "Membership"]] as const) {
      const operational = await query<{ count: number | string; cents: number | string | null }>(
        `SELECT COUNT(*) AS count, CAST(ROUND(SUM(pr.amount) * 100) AS SIGNED) AS cents FROM payment_references pr
          WHERE pr.validation_status = 'Validated' AND pr.payment_purpose = ? AND DATE(DATE_ADD(pr.validated_at, INTERVAL 8 HOUR)) BETWEEN ? AND ?`, [purpose, ...range]);
      const ledger = await query<{ count: number | string; cents: number | string | null }>(
        `SELECT COUNT(*) AS count, CAST(ROUND(SUM(fr.amount) * 100) AS SIGNED) AS cents FROM financial_records fr LEFT JOIN financial_categories fc ON fc.financial_category_id = fr.financial_category_id
          WHERE ${postedOperatingSql("fr", "fc")} AND fr.record_type = 'Income' AND fr.source_module = ? AND ${inRange}`, [source, ...range]);
      const operationalAmount = centsToPeso(operational[0]?.cents); const postedAmount = centsToPeso(ledger[0]?.cents);
      reconciliation.push({ module, operationalLabel: `Validated ${purpose.toLowerCase()} payments`, operationalAmount, postedAmount, difference: Math.round((operationalAmount - postedAmount) * 100) / 100,
        operationalCount: Number(operational[0]?.count ?? 0), postedCount: Number(ledger[0]?.count ?? 0), available: true,
        caveat: "Compared by validation date and ledger record date. Partial payments, refunds, reversals and posting delays can create differences that are not errors." });
    }
  } else {
    issues.push(unavailable("unmatched-payment-postings", "Validated payments without a ledger posting", "Validated payment references need a linked financial record.", "payment_references"));
  }

  if (caps.pos_sales) {
    const operational = await query<{ count: number | string; cents: number | string | null }>(
      `SELECT COUNT(*) AS count, CAST(ROUND(SUM(total_amount) * 100) AS SIGNED) AS cents FROM pos_sales
        WHERE sale_status IN ('Paid', 'Completed') AND payment_status = 'Paid' AND DATE(sale_date) BETWEEN ? AND ?`, range);
    const ledger = await query<{ count: number | string; cents: number | string | null }>(
      `SELECT COUNT(*) AS count, CAST(ROUND(SUM(fr.amount) * 100) AS SIGNED) AS cents FROM financial_records fr LEFT JOIN financial_categories fc ON fc.financial_category_id = fr.financial_category_id
        WHERE ${postedOperatingSql("fr", "fc")} AND fr.record_type = 'Income' AND fr.source_module = 'POS' AND ${inRange}`, range);
    const operationalAmount = centsToPeso(operational[0]?.cents); const postedAmount = centsToPeso(ledger[0]?.cents);
    reconciliation.unshift({ module: "POS", operationalLabel: "Paid and completed POS sales", operationalAmount, postedAmount, difference: Math.round((operationalAmount - postedAmount) * 100) / 100,
      operationalCount: Number(operational[0]?.count ?? 0), postedCount: Number(ledger[0]?.count ?? 0), available: true,
      caveat: "Sales are matched by sale date and ledger record date. Refunds, cancelled sales and next-day posting can differ without an error; the ledger remains the source for headline totals." });
  } else {
    reconciliation.unshift({ module: "POS", operationalLabel: "Paid and completed POS sales", operationalAmount: null, postedAmount: 0, difference: null, operationalCount: null, postedCount: 0, available: false, caveat: "The pos_sales table is not available, so POS cannot be reconciled. Missing data is not zero." });
  }

  const reconciliationDifferences = reconciliation.filter(row => row.available && row.difference !== null && row.difference !== 0);
  issues.push({
    code: "pos-reconciliation", title: "Operational totals differ from ledger postings", label: "Reconciliation Difference", available: reconciliation.some(row => row.available), count: reconciliationDifferences.length,
    amount: reconciliationDifferences.length ? Math.round(reconciliationDifferences.reduce((total, row) => total + Math.abs(row.difference ?? 0), 0) * 100) / 100 : 0, dateRange,
    rule: "Operational sales or validated payments for the period compared with posted ledger income from the same module.",
    limitation: "A difference is a prompt to look, not an error. Timing, refunds, partial payments and reversals are expected causes.",
    references: reconciliationDifferences.map(row => ({ reference: `${row.module}: operational ${row.operationalAmount} vs ledger ${row.postedAmount}`, date: null, amount: row.difference, module: row.module })),
    truncated: false, modules: reconciliationDifferences.map(row => row.module), ledgerQuery: null, link: { href: "/portal/chairman/financial-ledger", label: "Open in Financial Ledger" },
  });

  return { integrity: { postedCount: posted.count, issues, reconciliation } satisfies IntegritySources, excluded };
}

async function loadCapital(query: Query, caps: Record<string, boolean>, filters: FinancialAnalyticsFilters, excluded: { income: number; expense: number; count: number }): Promise<CapitalContext> {
  const base = { excludedIncome: excluded.income, excludedExpense: excluded.expense, excludedCount: excluded.count };
  if (!caps.share_capital_accounts || !caps.share_capital_transactions) {
    return { available: false, totalBalance: null, addedInPeriod: null, memberContributions: null, interestAdditions: null, otherCredits: null, deductions: null, ...base };
  }
  const balance = await query<{ total: string | number | null }>("SELECT COALESCE(SUM(current_balance), 0) AS total FROM share_capital_accounts");
  const movements = await query<{ type: string; direction: string; cents: number | string | null }>(
    `SELECT transaction_type AS type, direction, CAST(ROUND(SUM(amount) * 100) AS SIGNED) AS cents FROM share_capital_transactions
      WHERE transaction_status = 'Posted' AND transaction_date BETWEEN ? AND ? GROUP BY transaction_type, direction`, [filters.start, filters.end]);
  const credits = movements.filter(row => row.direction === "Credit");
  const sum = (rows: typeof movements) => rows.reduce((total, row) => total + Number(row.cents ?? 0), 0);
  const contributions = sum(credits.filter(row => row.type === "Initial Share Capital" || row.type === "Additional Capital Contribution"));
  const interest = sum(credits.filter(row => row.type === "Dividend Added to Share Capital"));
  const other = sum(credits) - contributions - interest;
  return {
    available: true, totalBalance: Math.round(Number(balance[0]?.total ?? 0) * 100) / 100, addedInPeriod: centsToPeso(sum(credits)),
    memberContributions: centsToPeso(contributions), interestAdditions: centsToPeso(interest), otherCredits: centsToPeso(other), deductions: centsToPeso(sum(movements.filter(row => row.direction === "Debit"))), ...base,
  };
}
