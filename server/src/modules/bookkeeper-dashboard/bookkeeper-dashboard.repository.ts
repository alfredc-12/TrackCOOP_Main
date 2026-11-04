import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { postedOperatingSql, postedRecordSql, capitalMovementSql } from "../finance/financial-posting-rules";
import { paymentSource, exceptionSql } from "../finance-monitoring/payment-monitoring";
import { utcBoundary } from "../../utils/manila-calendar";

export type DashboardExecutor = Pick<PoolConnection, "execute">;
type Row = RowDataPacket & Record<string, string | number | null>;

/** PayMongo test-mode references are never operational. */
export const testPaymentSql = (reference = "p") =>
  `(${reference}.payment_channel = 'PayMongo' AND ${reference}.gateway_environment = 'Test')`;
const linkedTestPaymentSql = (record = "fr") =>
  `EXISTS (SELECT 1 FROM payment_references dash_test WHERE dash_test.payment_reference_id = ${record}.payment_reference_id AND ${testPaymentSql("dash_test")})`;

/** Inclusive Manila calendar dates against a DATE column. */
const window = (column: string) => `${column} >= ? AND ${column} < DATE_ADD(?, INTERVAL 1 DAY)`;
export type DateRange = { start: string; end: string };
const range = (r: DateRange) => [r.start, r.end];

/**
 * Operating eligibility is the existing shared rule (`postedOperatingSql`): posted, active, income/expense only,
 * excluding capital movements, superseded, duplicate, mismatched or test-linked and broken-source records.
 * The dashboard adds no looser or private variant.
 */
const operating = postedOperatingSql("fr", "fc");
const financeFrom = "FROM financial_records fr LEFT JOIN financial_categories fc ON fc.financial_category_id = fr.financial_category_id";
const dec = (expression: string) => `CAST(COALESCE(${expression}, 0) AS DECIMAL(18,2))`;

export async function readOperatingTotals(db: DashboardExecutor, r: DateRange) {
  const [rows] = await db.execute<Row[]>(
    `SELECT ${dec("SUM(CASE WHEN fr.record_type = 'Income' THEN fr.amount END)")} AS income,
            ${dec("SUM(CASE WHEN fr.record_type = 'Expense' THEN fr.amount END)")} AS expenses,
            COALESCE(SUM(fr.record_type = 'Income'), 0) AS incomeCount,
            COALESCE(SUM(fr.record_type = 'Expense'), 0) AS expenseCount
       ${financeFrom}
      WHERE ${operating} AND ${window("fr.record_date")}`,
    range(r),
  );
  return rows[0];
}

/** Posted, active adjustments, shown separately and never netted into operating surplus. */
export async function readAdjustments(db: DashboardExecutor, r: DateRange) {
  const [rows] = await db.execute<Row[]>(
    `SELECT ${dec("SUM(fr.amount)")} AS total,
            COUNT(fr.financial_record_id) AS count,
            ${dec("SUM(CASE WHEN fr.reversal_of_record_id IS NOT NULL THEN fr.amount END)")} AS reversalTotal,
            COALESCE(SUM(fr.reversal_of_record_id IS NOT NULL), 0) AS reversalCount
       FROM financial_records fr
      WHERE ${postedRecordSql("fr")} AND fr.record_type = 'Adjustment'
        AND NOT ${linkedTestPaymentSql("fr")}
        AND ${window("fr.record_date")}`,
    range(r),
  );
  return rows[0];
}

export async function readTrend(db: DashboardExecutor, r: DateRange) {
  const [rows] = await db.execute<Row[]>(
    `SELECT DATE_FORMAT(fr.record_date, '%Y-%m') AS month,
            ${dec("SUM(CASE WHEN fr.record_type = 'Income' THEN fr.amount END)")} AS income,
            ${dec("SUM(CASE WHEN fr.record_type = 'Expense' THEN fr.amount END)")} AS expenses
       ${financeFrom}
      WHERE ${operating} AND ${window("fr.record_date")}
      GROUP BY DATE_FORMAT(fr.record_date, '%Y-%m')
      ORDER BY month ASC`,
    range(r),
  );
  return rows;
}

/**
 * Sources are mapped from category code (with the originating module for POS and Rental), never by label.
 * Anything unmapped is "other" so totals always equal Operating Income.
 */
const sourceCase = `CASE
  WHEN fr.source_module = 'POS' OR UPPER(COALESCE(fc.category_code, '')) = 'POS_SALES' THEN 'pos'
  WHEN fr.source_module = 'Rental' OR UPPER(COALESCE(fc.category_code, '')) = 'RENTAL_INCOME' THEN 'rental'
  WHEN UPPER(COALESCE(fc.category_code, '')) IN ('MEMBERSHIP_FEE', 'ASSOCIATE_MEMBERSHIP_FEE') THEN 'membership'
  WHEN UPPER(COALESCE(fc.category_code, '')) = 'DONATIONS_GRANTS' THEN 'donations'
  ELSE 'other' END`;

export async function readIncomeBySource(db: DashboardExecutor, r: DateRange) {
  const [rows] = await db.execute<Row[]>(
    `SELECT ${sourceCase} AS source, ${dec("SUM(fr.amount)")} AS amount, COUNT(*) AS count
       ${financeFrom}
      WHERE ${operating} AND fr.record_type = 'Income' AND ${window("fr.record_date")}
      GROUP BY ${sourceCase}`,
    range(r),
  );
  return rows;
}

export async function readExpensesByCategory(db: DashboardExecutor, r: DateRange) {
  const [rows] = await db.execute<Row[]>(
    `SELECT CAST(fc.financial_category_id AS CHAR) AS id,
            COALESCE(NULLIF(fc.category_name, ''), 'Uncategorized') AS name,
            ${dec("SUM(fr.amount)")} AS amount, COUNT(*) AS count
       ${financeFrom}
      WHERE ${operating} AND fr.record_type = 'Expense' AND ${window("fr.record_date")}
      GROUP BY fc.financial_category_id, fc.category_name
      ORDER BY SUM(fr.amount) DESC, fc.category_name ASC`,
    range(r),
  );
  return rows;
}

/**
 * Member capital contributions come from the share-capital ledger, not from financial_records.
 * Only payment credits and their reversal debits are counted; dividends, patronage capitalisation
 * and other credits are different movements. Test-mode PayMongo payments are excluded.
 */
export async function readCapitalReceived(db: DashboardExecutor, r: DateRange) {
  const [rows] = await db.execute<Row[]>(
    `SELECT ${dec("SUM(CASE WHEN t.source_type = 'share_capital_payment' AND t.direction = 'Credit' THEN t.amount END)")} AS gross,
            ${dec("SUM(CASE WHEN t.source_type = 'share_capital_payment_reversal' AND t.direction = 'Debit' THEN t.amount END)")} AS reversals,
            COALESCE(SUM(t.source_type = 'share_capital_payment'), 0) AS count
       FROM share_capital_transactions t
       LEFT JOIN share_capital_payments sp ON sp.share_payment_id = t.source_id
       LEFT JOIN payment_references p ON p.payment_reference_id = sp.payment_reference_id
      WHERE t.transaction_status = 'Posted'
        AND t.source_type IN ('share_capital_payment', 'share_capital_payment_reversal')
        AND NOT COALESCE(${testPaymentSql("p")}, 0)
        AND ${window("t.transaction_date")}`,
    range(r),
  );
  return rows[0];
}

export async function readCapitalBalance(db: DashboardExecutor) {
  const [rows] = await db.execute<Row[]>(
    `SELECT ${dec("SUM(current_balance)")} AS balance,
            COUNT(DISTINCT CASE WHEN current_balance > 0 THEN member_id END) AS holders
       FROM share_capital_accounts`,
  );
  return rows[0];
}

/** Finalized (Chairman-approved) refunds still pending, net of capitalisation already approved. */
export async function readPatronageOutstanding(db: DashboardExecutor) {
  const [rows] = await db.execute<Row[]>(
    `SELECT ${dec("SUM(GREATEST(a.refund_amount - COALESCE(t.approved, 0), 0))")} AS outstanding,
            COUNT(*) AS allocations
       FROM patronage_allocations a
       JOIN patronage_periods p ON p.patronage_period_id = a.patronage_period_id
       LEFT JOIN (SELECT patronage_allocation_id, SUM(amount) AS approved
                    FROM patronage_capital_transfers WHERE transfer_status = 'Approved'
                   GROUP BY patronage_allocation_id) t ON t.patronage_allocation_id = a.patronage_allocation_id
      WHERE p.period_status = 'Finalized' AND a.payment_status = 'Pending'
        AND a.refund_amount - COALESCE(t.approved, 0) > 0`,
  );
  return rows[0];
}

export async function readInterestAwaitingAction(db: DashboardExecutor) {
  const [rows] = await db.execute<Row[]>(
    `SELECT COALESCE(SUM(dividend_status = 'Withdrawal Requested'), 0) AS withdrawalCount,
            ${dec("SUM(CASE WHEN dividend_status = 'Withdrawal Requested' THEN dividend_amount END)")} AS withdrawalAmount,
            COALESCE(SUM(dividend_status = 'Capitalization Requested'), 0) AS capitalizationCount,
            ${dec("SUM(CASE WHEN dividend_status = 'Capitalization Requested' THEN dividend_amount END)")} AS capitalizationAmount
       FROM member_dividends
      WHERE dividend_status IN ('Withdrawal Requested', 'Capitalization Requested')`,
  );
  return rows[0];
}

const operational = `NOT ${testPaymentSql("p")}`;

/** Attention counts. Lifetime backlog except `approvedToday`, which uses the Asia/Manila calendar day. */
export async function readAttention(db: DashboardExecutor, today: string) {
  const [counts] = await db.execute<Row[]>(
    `SELECT COALESCE(SUM(p.validation_status = 'Pending' AND p.payment_channel <> 'PayMongo'), 0) AS awaitingReview,
            COALESCE(SUM(p.validation_status = 'Pending' AND p.payment_channel = 'PayMongo'), 0) AS awaitingGateway,
            COALESCE(SUM(p.validation_status = 'Needs Clarification'), 0) AS needsClarification,
            COALESCE(SUM(p.validation_status = 'Validated' AND p.eventValidatedAt >= ? AND p.eventValidatedAt < ?), 0) AS approvedToday,
            COALESCE(SUM(${exceptionSql}), 0) AS exceptions
       FROM ${paymentSource}
      WHERE ${operational}`,
    [utcBoundary(today), utcBoundary(today, true)],
  );
  const [tests] = await db.execute<Row[]>(
    `SELECT COUNT(*) AS total FROM payment_references p WHERE ${testPaymentSql("p")}`,
  );
  const [items] = await db.execute<Row[]>(
    `SELECT CAST(p.payment_reference_id AS CHAR) AS id, p.reference_number AS referenceNumber,
            COALESCE(p.payer_name, m.full_name) AS payer, p.payment_purpose AS purpose,
            p.payment_channel AS channel, CAST(p.amount AS DECIMAL(18,2)) AS amount,
            p.validation_status AS status, p.submitted_at AS submittedAt,
            CASE WHEN ${exceptionSql} THEN 'exception'
                 WHEN p.validation_status = 'Needs Clarification' THEN 'clarification'
                 ELSE 'manual-review' END AS reason
       FROM ${paymentSource}
      WHERE ${operational}
        AND ((p.validation_status = 'Pending' AND p.payment_channel <> 'PayMongo')
             OR p.validation_status = 'Needs Clarification' OR ${exceptionSql})
      ORDER BY (${exceptionSql}) DESC, p.submitted_at ASC, p.payment_reference_id ASC
      LIMIT 5`,
  );
  return { counts: counts[0], tests: tests[0], items };
}

/** Recent ledger entries in the period (financial postings only; unvalidated submissions are not ledger rows). */
export async function readRecentRecords(db: DashboardExecutor, r: DateRange) {
  const [rows] = await db.execute<Row[]>(
    `SELECT CAST(fr.financial_record_id AS CHAR) AS id, fr.record_number AS recordNumber,
            DATE_FORMAT(fr.record_date, '%Y-%m-%d') AS date, fr.source_module AS source,
            COALESCE(NULLIF(fc.category_name, ''), 'Uncategorized') AS category,
            fr.record_type AS recordType, CAST(fr.amount AS DECIMAL(18,2)) AS amount,
            fr.record_status AS recordStatus, (fr.approved_by IS NOT NULL) AS posted,
            (${operating}) AS operating, (${capitalMovementSql("fr", "fc")}) AS capital,
            CAST(fr.payment_reference_id AS CHAR) AS paymentReferenceId
       ${financeFrom}
      WHERE ${window("fr.record_date")}
      ORDER BY fr.record_date DESC, fr.financial_record_id DESC
      LIMIT 10`,
    range(r),
  );
  return rows;
}

