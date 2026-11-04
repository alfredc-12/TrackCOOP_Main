import assert from "node:assert/strict";
import test from "node:test";
import { capitalMovementSql, classifyFinancialRecord, postedOperatingSql, postedRecordSql, type FinancialRecordLike } from "./financial-posting-rules";

const base: FinancialRecordLike = { recordType: "Income", recordStatus: "Active", approvedBy: "7", sourceModule: "POS", categoryCode: "POS_SALES", categoryName: "POS Sales" };
const classify = (patch: Partial<FinancialRecordLike>) => classifyFinancialRecord({ ...base, ...patch });

test("posted active income and expense rows are operating", () => {
  assert.equal(classify({}), "operating-income");
  assert.equal(classify({ recordType: "Expense", sourceModule: "Manual", categoryCode: "FUEL" }), "operating-expense");
});

test("system-posted rows are included because the flows stamp approved_by", () => {
  for (const sourceModule of ["POS", "Rental", "Membership", "Payment"]) assert.equal(classify({ sourceModule }), "operating-income");
});

test("active rows without an approver are unposted, not final", () => {
  assert.equal(classify({ approvedBy: null }), "unposted");
  assert.equal(classify({ approvedBy: "" }), "unposted");
});

test("voided, corrected and reversed history never counts", () => {
  for (const recordStatus of ["Voided", "Corrected", "Reversed"]) assert.equal(classify({ recordStatus }), "inactive");
});

test("adjustments are separate and a reversal adjustment never changes operating totals", () => {
  assert.equal(classify({ recordType: "Adjustment" }), "adjustment");
});

test("share-capital movements are excluded from both income and expense", () => {
  assert.equal(classify({ sourceModule: "Share Capital" }), "capital-movement");
  assert.equal(classify({ recordType: "Expense", sourceModule: "Share Capital", categoryCode: "DIVIDEND_PAYMENT" }), "capital-movement");
  assert.equal(classify({ sourceModule: "Other", categoryCode: "share_capital" }), "capital-movement");
  assert.equal(classify({ sourceModule: "Other", categoryCode: "X", categoryName: "Member Share Capital" }), "capital-movement");
});

test("SQL fragments mirror the TypeScript rule and honor aliases", () => {
  const sql = postedOperatingSql("r", "c");
  assert.match(sql, /r\.record_status = 'Active'/);
  assert.match(sql, /r\.approved_by IS NOT NULL/);
  assert.match(sql, /r\.record_type IN \('Income', 'Expense'\)/);
  assert.match(sql, /NOT \(r\.source_module = 'Share Capital'/);
  assert.match(capitalMovementSql("r", "c"), /SHARE_CAPITAL/);
  assert.equal(postedRecordSql("x"), "x.record_status = 'Active' AND x.approved_by IS NOT NULL");
});
