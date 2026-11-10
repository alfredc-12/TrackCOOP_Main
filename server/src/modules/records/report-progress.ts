import type { ReportColumn, ReportFilters, ReportResult } from "./records-types";
import type { AuthorizedUser } from "./records-auth";
import { documentVisibilitySql } from "./document-policy";
import { RecordsError } from "./records-error";

export const progressReportKeys = ["cooperative-overview", "performance-trends", "attention-needed"];
export type ProgressQuery = { sql: string; values: Array<string | number>; columns: ReportColumn[] };
const dayMs = 86_400_000;

export function manilaDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

function dateNumber(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new RecordsError("Choose valid calendar dates.", 422, "INVALID_REPORT_FILTER");
  }
  return date.getTime();
}

export function progressRange(filters: ReportFilters, now = new Date()) {
  const today = manilaDate(now);
  const dateFrom = filters.dateFrom || `${today.slice(0, 7)}-01`;
  const dateTo = filters.dateTo || today;
  const from = dateNumber(dateFrom), to = dateNumber(dateTo);
  if (from > to || to - from > 3660 * dayMs) throw new RecordsError("Choose an ordered period of ten years or less.", 422, "INVALID_REPORT_FILTER");
  const days = (to - from) / dayMs + 1;
  return { dateFrom, dateTo, previousFrom: new Date(from - days * dayMs).toISOString().slice(0, 10), previousTo: new Date(from - dayMs).toISOString().slice(0, 10) };
}

const posted = "fr.record_status = 'Active' AND fr.approved_by IS NOT NULL AND fr.record_type IN ('Income','Expense') AND (fr.payment_reference_id IS NULL OR linked.validation_status = 'Validated')";
const ledger = "financial_records fr LEFT JOIN payment_references linked ON linked.payment_reference_id = fr.payment_reference_id";
const metrics = [
  { metric: "Posted income", source: "Approved active ledger income", table: ledger, date: "fr.record_date", amount: "fr.amount", where: `${posted} AND fr.record_type = 'Income'` },
  { metric: "Posted expenses", source: "Approved active ledger expenses", table: ledger, date: "fr.record_date", amount: "fr.amount", where: `${posted} AND fr.record_type = 'Expense'` },
  { metric: "Net result", source: "Posted income minus posted expenses", table: ledger, date: "fr.record_date", amount: "CASE WHEN fr.record_type = 'Income' THEN fr.amount ELSE -fr.amount END", where: posted },
  { metric: "Paid store sales", source: "Paid/completed POS sales; Manila sale date", table: "pos_sales ps LEFT JOIN payment_references linked ON linked.payment_reference_id = ps.payment_reference_id", date: "DATE_ADD(ps.sale_date, INTERVAL 8 HOUR)", amount: "ps.total_amount", where: "ps.payment_status = 'Paid' AND ps.sale_status IN ('Paid','Completed') AND (ps.payment_reference_id IS NULL OR linked.validation_status = 'Validated')" },
  { metric: "Validated rental payments", source: "Validated rental references; Manila approval date", table: "payment_references pr", date: "DATE_ADD(pr.validated_at, INTERVAL 8 HOUR)", amount: "pr.amount", where: "pr.validation_status = 'Validated' AND pr.payment_purpose = 'Rental'" },
  { metric: "Capital contributions", source: "Validated capital payments; payment date", table: "share_capital_payments scp LEFT JOIN payment_references linked ON linked.payment_reference_id = scp.payment_reference_id", date: "scp.payment_date", amount: "scp.amount", where: "scp.payment_status = 'Validated' AND (scp.payment_reference_id IS NULL OR linked.validation_status = 'Validated')" },
];

export function overviewQuery(filters: ReportFilters): ProgressQuery {
  const range = progressRange(filters), values: string[] = [];
  const sql = metrics.map((metric) => {
    values.push(range.dateFrom, range.dateTo, range.previousFrom, range.previousTo);
    return `SELECT '${metric.metric}' AS metric,
      COALESCE(SUM(CASE WHEN DATE(${metric.date}) BETWEEN ? AND ? THEN ${metric.amount} ELSE 0 END),0) AS currentValue,
      COALESCE(SUM(CASE WHEN DATE(${metric.date}) BETWEEN ? AND ? THEN ${metric.amount} ELSE 0 END),0) AS previousValue,
      '${metric.source}' AS source FROM ${metric.table} WHERE ${metric.where}`;
  }).join(" UNION ALL ");
  return { sql, values, columns: [
    { key: "metric", label: "Metric" }, { key: "currentValue", label: "Current (PHP)", format: "currency" },
    { key: "previousValue", label: "Previous (PHP)", format: "currency" }, { key: "change", label: "Change (PHP)", format: "currency" },
    { key: "changePercent", label: "Change %", format: "number" }, { key: "source", label: "Basis" },
  ] };
}

export function trendQuery(filters: ReportFilters): ProgressQuery {
  const range = progressRange(filters), values: string[] = [];
  const parts = metrics.map((metric, index) => {
    values.push(range.dateFrom, range.dateTo);
    return `SELECT DATE_FORMAT(${metric.date}, '%Y-%m') AS period, ${metrics.map((_, col) => `${col === index ? `SUM(${metric.amount})` : "0"} AS value${col}`).join(",")}
      FROM ${metric.table} WHERE ${metric.where} AND DATE(${metric.date}) BETWEEN ? AND ? GROUP BY DATE_FORMAT(${metric.date}, '%Y-%m')`;
  });
  return { sql: `SELECT period, ${metrics.map((_, index) => `SUM(value${index}) AS value${index}`).join(",")} FROM (${parts.join(" UNION ALL ")}) monthly GROUP BY period ORDER BY period`, values,
    columns: [{ key: "period", label: "Month" }, ...metrics.map((metric, index) => ({ key: `value${index}`, label: metric.metric, format: "currency" as const }))] };
}

export function attentionQuery(user: AuthorizedUser): ProgressQuery {
  const visibility = documentVisibilitySql({ role: user.role, userId: user.numericId });
  return { sql: `SELECT * FROM (
    SELECT 'Payments' AS area, CONCAT('PAY-',pr.payment_reference_id) AS reference, pr.payment_purpose AS subject,
      pr.validation_status AS issue, pr.amount AS amount, 'Check proof and saved details' AS nextStep
      FROM payment_references pr WHERE pr.validation_status IN ('Pending','Needs Clarification')
    UNION ALL
    SELECT 'Reconciliation',CONCAT('PAY-',pr.payment_reference_id),pr.payment_purpose,'Validated without posted ledger',pr.amount,'Review linked money record'
      FROM payment_references pr WHERE pr.validation_status = 'Validated' AND NOT EXISTS
      (SELECT 1 FROM financial_records fr WHERE fr.payment_reference_id = pr.payment_reference_id AND fr.record_status = 'Active' AND fr.approved_by IS NOT NULL)
    UNION ALL
    SELECT 'Stock', p.sku, p.product_name, CONCAT('Available: ', COALESCE(stock.onHand,0)-COALESCE(reserved.quantity,0), ' ',p.unit),NULL,'Review stock and reorder needs'
      FROM products p
      LEFT JOIN (SELECT product_id,SUM(quantity_change) AS onHand FROM inventory_movements GROUP BY product_id) stock ON stock.product_id=p.product_id
      LEFT JOIN (SELECT psi.product_id,SUM(psi.quantity) AS quantity FROM pos_sale_items psi JOIN pos_sales ps ON ps.pos_sale_id=psi.pos_sale_id WHERE ps.sale_status='Pending Payment' GROUP BY psi.product_id) reserved ON reserved.product_id=p.product_id
      WHERE p.track_inventory=1 AND p.product_status IN ('Active','Out of Stock') AND COALESCE(stock.onHand,0)-COALESCE(reserved.quantity,0)<=GREATEST(10,p.reorder_level)
    UNION ALL
    SELECT 'Documents',COALESCE(d.document_reference,CONCAT('DOC-',d.document_id)),d.title,
      CASE WHEN d.expiration_date < DATE(DATE_ADD(UTC_TIMESTAMP(),INTERVAL 8 HOUR)) THEN 'Expired' ELSE 'Expiring within 30 days' END,NULL,'Review and renew document'
      FROM documents d WHERE ${visibility.sql} AND d.document_status NOT IN ('Archived','Replaced')
      AND d.expiration_date <= DATE_ADD(DATE(DATE_ADD(UTC_TIMESTAMP(),INTERVAL 8 HOUR)),INTERVAL 30 DAY)
    ) attention ORDER BY area, reference`, values: visibility.values, columns: [
      { key: "area", label: "Area" }, { key: "reference", label: "Reference" }, { key: "subject", label: "Item" },
      { key: "issue", label: "Needs attention" }, { key: "amount", label: "Submitted amount (PHP)", format: "currency" }, { key: "nextStep", label: "Suggested follow-up" },
    ] };
}

export function comparisonRows(rows: ReportResult["rows"]) {
  return rows.map((row) => {
    const currentValue = Number(row.currentValue), previousValue = Number(row.previousValue);
    const change = Math.round((currentValue - previousValue) * 100) / 100;
    return { ...row, currentValue, previousValue, change, changePercent: previousValue === 0 ? null : Math.round(change / Math.abs(previousValue) * 10000) / 100 };
  });
}

export function completeTrendMonths(rows: ReportResult["rows"], filters: ReportFilters) {
  const range = progressRange(filters), byMonth = new Map(rows.map((row) => [row.period, row]));
  const result: ReportResult["rows"] = [];
  let month = range.dateFrom.slice(0, 7);
  while (month <= range.dateTo.slice(0, 7)) {
    result.push(byMonth.get(month) ?? Object.fromEntries([["period", month], ...metrics.map((_, index) => [`value${index}`, 0])]));
    const date = new Date(`${month}-01T00:00:00Z`); date.setUTCMonth(date.getUTCMonth() + 1); month = date.toISOString().slice(0, 7);
  }
  return result;
}

export function progressNotes(key: string, filters: ReportFilters) {
  if (key === "attention-needed") return ["Current snapshot at generation time; not a historical backlog. Submitted payment amounts are not confirmed income. One record may have more than one issue.", "Low stock uses available on-hand stock minus pending-order reservations, with the existing minimum threshold of 10. Documents follow your access permissions."];
  const range = progressRange(filters);
  return [`Current: ${range.dateFrom} to ${range.dateTo}. Previous equal-length period: ${range.previousFrom} to ${range.previousTo}. Calendar dates use Manila time.`,
    "Income, sales, rental payments, and capital contributions overlap and must not be added together. Capital contributions are not operating income. Net result is posted income minus posted expenses, not a full audited profit statement.",
    "Zero means no qualifying recorded activity. Missing or unposted activity is not estimated. Percentage change is unavailable for a zero baseline; negative baselines use their absolute value.",
    "Trends reflect the current status of dated records; reversals can change prior results. Partial months include only the selected dates. Approved targets and historical stock/backlog snapshots are not available."];
}

export function progressSummary(key: string, rows: ReportResult["rows"]): ReportResult["summary"] {
  if (key === "attention-needed") return [{ label: "Issues requiring review", value: rows.length, format: "number" }];
  if (key === "cooperative-overview") return rows.slice(0, 3).map((row) => ({ label: String(row.metric), value: Number(row.currentValue), format: "currency" }));
  return [{ label: "Months covered", value: rows.length, format: "number" }, ...[0, 1, 2].map((index) => ({ label: metrics[index].metric, value: rows.reduce((total, row) => total + Number(row[`value${index}`] ?? 0), 0), format: "currency" as const }))];
}
