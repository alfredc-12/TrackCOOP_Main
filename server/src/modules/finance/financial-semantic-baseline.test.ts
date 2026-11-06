import assert from "node:assert/strict";
import test from "node:test";
import type { Pool } from "mysql2/promise";
import { classifyFinancialRecord, duplicatePostingSql, postedOperatingSql, sourceMismatchSql, type FinancialRecordLike } from "./financial-posting-rules";
import { compareFinancialBases, type ReconcilableFinancialRow } from "../bookkeeper-dashboard/bookkeeper-dashboard.reconciliation";
import { formatCentavos, toCentavos } from "../bookkeeper-dashboard/bookkeeper-dashboard.money";
import { readOperatingTotals, type DashboardExecutor } from "../bookkeeper-dashboard/bookkeeper-dashboard.repository";
import { getPool } from "../../db/pool";
import { generateReport } from "../records/report-service";
import { paymentSource, exceptionSql, expectsFinance, expectsCapital } from "../finance-monitoring/payment-monitoring";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createPatronageRepository } from "../patronage/patronage.repository";
import { PATRONAGE_RATE, rentalRefund } from "../patronage/patronage-policy";

const base: ReconcilableFinancialRow = {
  id: "1", recordDate: "2026-06-01", recordType: "Income", recordStatus: "Active", approvedBy: "7",
  sourceModule: "POS", categoryCode: "POS_SALES", categoryName: "POS Sales", categoryType: "Income", amount: "1000.10",
  paymentChannel: "Cash", validationStatus: "Validated", paymentPurpose: "POS/Product",
};
// Synthetic amounts and statuses only. These fixtures do not represent cooperative records.
const rows: ReconcilableFinancialRow[] = [
  base,
  { ...base, id: "2", sourceModule: "Rental", categoryCode: "RENTAL_INCOME", amount: "500.20", paymentPurpose: "Rental" },
  { ...base, id: "3", sourceModule: "Membership", categoryCode: "MEMBERSHIP_FEE", amount: "200.00", paymentPurpose: "Associate Membership Fee" },
  { ...base, id: "4", sourceModule: "Membership", categoryCode: "MEMBERSHIP_FEE", amount: "1500.00", paymentPurpose: "Share Capital" },
  { ...base, id: "5", amount: "300.00", paymentChannel: "PayMongo", gatewayEnvironment: "Test" },
  { ...base, id: "6", recordType: "Expense", sourceModule: "Manual", categoryCode: "FUEL", categoryType: "Expense", approvedBy: null, amount: "75.00", paymentChannel: null, validationStatus: null, paymentPurpose: null },
  { ...base, id: "7", recordType: "Expense", sourceModule: "Manual", categoryCode: "FUEL", categoryType: "Expense", amount: "400.30", paymentChannel: null, validationStatus: null, paymentPurpose: null },
  { ...base, id: "8", recordStatus: "Voided", amount: "100.00" },
  { ...base, id: "9", recordStatus: "Reversed", validationStatus: "Reversed", amount: "200.00" },
  { ...base, id: "10", recordType: "Adjustment", reversalOfId: "9", validationStatus: "Reversed", amount: "-200.00" },
  { ...base, id: "11", validationStatus: "Pending", amount: "600.00" },
];
const total = (selected: ReconcilableFinancialRow[]) => formatCentavos(selected.reduce((sum, r) => sum + toCentavos(r.amount), 0));

test("approved operating fixture excludes capital, test, pending, voided and reversed rows", () => {
  const intendedIncome = rows.filter((r) => ["1", "2", "3"].includes(r.id));
  const intendedExpenses = rows.filter((r) => r.id === "7");
  assert.equal(total(intendedIncome), "1700.30");
  assert.equal(total(intendedExpenses), "400.30");
  assert.equal(formatCentavos(toCentavos(total(intendedIncome)) - toCentavos(total(intendedExpenses))), "1300.00");
  assert.equal(classifyFinancialRecord({ ...base, amount: 100010 }), "operating-income");
  for (const patch of [
    { approvedBy: null }, { recordStatus: "Voided" }, { recordStatus: "Reversed" },
    { sourceModule: "Share Capital" }, { capitalPayment: true }, { duplicate: true }, { superseded: true },
  ] satisfies Partial<FinancialRecordLike>[]) {
    assert.notEqual(classifyFinancialRecord({ ...base, amount: 100010, ...patch }), "operating-income");
  }
  assert.equal(toCentavos("0.10") + toCentavos("0.20"), 30);
  assert.equal(formatCentavos(toCentavos("1.005")), "1.01");
});

test("diagnostic helper currently includes a pending POS reference that the operating SQL excludes", async () => {
  const result = compareFinancialBases(rows);
  assert.equal(result.operatingDashboard.income, "2300.30");
  assert.equal(result.operatingDashboard.expenses, "400.30");
  assert.equal(result.operatingDashboard.netSurplus, "1900.00");
  assert.equal(result.operatingDashboard.adjustmentsDisclosed, "-200.00");
  let statement = "";
  const db = { async execute(sql: string) { statement = sql; return [[{ income: "1700.30", expenses: "400.30" }], []]; } } as unknown as DashboardExecutor;
  await readOperatingTotals(db, { start: "2026-01-01", end: "2026-12-31" });
  assert.ok(statement.includes(postedOperatingSql("fr", "fc")));
  assert.match(statement, /linked_ref\.validation_status<>'Validated'/);
  assert.match(statement, /linked_ref\.amount<>fr\.amount/);
  assert.match(statement, /gateway_environment='Test'/);
  assert.match(statement, /payment_purpose='Share Capital'/);
  // The mock does not execute SQL: 1700.30 is the independently enumerated fixture expectation.
});

test("current patronage repository excludes adjustments from net while diagnostic helper subtracts them", async () => {
  const calls: string[] = [];
  const db = { async execute(sql: string) {
    calls.push(sql);
    if (calls.length === 1) return [[{ memberId: "1", memberCode: "SYNTHETIC", memberName: "Fixture", membershipType: "True Member", purchasePatronage: 0, rentalPatronage: "500.20" }], []];
    return [[{ posIncome: "1900.10", rentalIncome: "500.20", posExpenses: "0.00", rentalExpenses: "0.00", otherExpenses: "400.30", adjustments: "-200.00", postedRecordCount: 7, unpostedRecordCount: 1 }], []];
  } } as unknown as Pool;
  const actual = await createPatronageRepository(db).financialBasis("2026-01-01", "2026-12-31");
  assert.equal(actual.totalOperatingIncome, 2400.2999999999997);
  assert.equal(toCentavos(actual.totalOperatingIncome), 240030);
  assert.equal(actual.totalOperatingExpenses, 400.3);
  assert.equal(actual.adjustments, -200);
  assert.equal(actual.netOperatingSurplus, 2000);
  assert.equal(actual.estimatedRefund, 15.01);
  assert.equal(PATRONAGE_RATE, 3);
  assert.equal(rentalRefund(500.2), 15.01);
  assert.match(calls[0], /m\.membership_type = 'True Member'/);
  assert.match(calls[0], /gateway_environment/);
  assert.doesNotMatch(calls[1], /JOIN payment_references|gateway_environment/);
  assert.equal(compareFinancialBases(rows).incumbentPatronageBasis.netOperatingSurplus, "1800.00");
  // Repository totals are observed from synthetic aggregate inputs, not a live SQL execution or payout.
});


test("existing financial report captures its broader SQL contract and synthetic modeled totals", async (t) => {
  const db = getPool();
  const calls: string[] = [];
  const modeledRows = rows.filter((r) => ["1", "2", "3", "4", "5", "7"].includes(r.id));
  t.mock.method(db, "query", async (sql: string) => {
    calls.push(sql);
    if (sql.includes("fr.record_number AS recordNumber")) return [modeledRows.map((r) => ({ recordNumber: `SYN-${r.id}`, recordDate: r.recordDate, recordType: r.recordType, category: r.categoryCode, source: r.sourceModule, amount: r.amount })), []];
    if (sql.includes("AS income") && sql.includes("AS transactions")) return [[{ income: "3500.30", expense: "400.30", transactions: 6 }], []];
    throw new Error("Unexpected report query");
  });
  t.mock.method(db, "execute", async () => { throw new Error("No database execution allowed"); });
  const user = { id: "1", numericId: 1, role: "chairman" as const, displayName: "Synthetic", email: "synthetic@example.test", username: "fixture" };
  const report = await generateReport("financial-summary", { dateFrom: "2026-01-01", dateTo: "2026-12-31" }, user, { record: false });
  assert.equal(report.rows.length, 6);
  assert.equal(report.summary.find((x) => x.label === "Confirmed income")?.value, 3500.3);
  assert.equal(report.summary.find((x) => x.label === "Confirmed expense")?.value, 400.3);
  assert.equal(report.summary.find((x) => x.label === "Net amount")?.value, 3100);
  for (const sql of calls) {
    assert.match(sql, /fr\.approved_by IS NOT NULL/);
    assert.match(sql, /pr\.validation_status = 'Validated'/);
    assert.doesNotMatch(sql, /gateway_environment|payment_purpose|duplicate_record/);
  }
  // Rows and aggregates are mock responses based on the declared fixture; SQL was not executed.
});

test("tracked financial SQL views expose active-row totals without posted or source exclusions", () => {
  const schema = readFileSync(path.resolve(process.cwd(), "server/database/TrackCOOP_MAIN_Database.sql"), "utf8");
  for (const view of ["v_dashboard_financial_overview", "v_financial_monthly_summary"]) {
    const match = schema.match(new RegExp(`CREATE VIEW ${view} AS([\\s\\S]*?);`, "i"));
    assert.ok(match, view);
    assert.match(match[1], /record_status\s*=\s*'Active'/);
    assert.doesNotMatch(match[1], /approved_by|gateway_environment|reversal_of_record_id/);
  }
  const viewIncome = rows.filter((r) => r.recordStatus === "Active" && r.recordType === "Income");
  const viewExpenses = rows.filter((r) => r.recordStatus === "Active" && r.recordType === "Expense");
  assert.equal(total(viewIncome), "4100.30");
  assert.equal(total(viewExpenses), "475.30");
  assert.equal(formatCentavos(toCentavos(total(viewIncome)) - toCentavos(total(viewExpenses))), "3625.00");
  // This is an independent fixture model of the source predicates, not an executed database view.
});

test("receipt and source anomalies are diagnostics rather than extra settlement writers", () => {
  assert.match(expectsFinance, /POS\/Product.*Rental/);
  assert.match(expectsCapital, /Share Capital/);
  assert.match(paymentSource, /payment_receipts/);
  assert.match(paymentSource, /financeMismatchCount/);
  assert.match(exceptionSql, /receiptState IS NULL/);
  assert.match(exceptionSql, /'Failed','Pending','Processing'/);
  assert.match(exceptionSql, /validation_status='Reversed'/);
  assert.doesNotMatch(exceptionSql, /INSERT|UPDATE|DELETE/i);
});


test("duplicate, refunded and mismatched-source checks are not interchangeable", () => {
  const duplicates = duplicatePostingSql("fr");
  assert.match(duplicates, /duplicate_record\.payment_reference_id=fr\.payment_reference_id/);
  assert.match(duplicates, /duplicate_record\.financial_record_id<>fr\.financial_record_id/);
  const source = sourceMismatchSql("fr");
  assert.match(source, /linked_ref\.validation_status<>'Validated'/);
  assert.match(source, /linked_ref\.amount<>fr\.amount/);
  assert.doesNotMatch(source, /gateway_status|partially_refunded|refunded/);
  // A gateway refund may be handled by source reversal; no source-state or SQL execution is inferred here.
  assert.notEqual(classifyFinancialRecord({ ...base, amount: 100010, duplicate: true }), "operating-income");
});
