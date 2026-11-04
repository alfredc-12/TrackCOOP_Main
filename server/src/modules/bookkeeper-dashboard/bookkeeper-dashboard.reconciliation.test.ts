import assert from "node:assert/strict";
import test from "node:test";
import {
  compareFinancialBases,
  proposedManilaSettlementRecordDate,
  resolveStrictSettlementCategoryCodes,
  type ReconcilableFinancialRow,
} from "./bookkeeper-dashboard.reconciliation";

const baseRow: ReconcilableFinancialRow = {
  id: "1",
  recordDate: "2026-11-02",
  recordType: "Income",
  recordStatus: "Active",
  approvedBy: "7",
  sourceModule: "POS",
  categoryCode: "POS_SALES",
  categoryName: "POS Sales",
  categoryType: "Income",
  amount: "1000.00",
};

test("reconciliation detects patronage reversal double-counting and dividend share-capital leakage", () => {
  const fixture: ReconcilableFinancialRow[] = [
    // Valid POS sale ₱2,000.00
    { ...baseRow, id: "1", amount: "2000.00" },
    // Reversed POS sale ₱500.00 (status changed to Reversed) + its negative Adjustment row (-₱500.00)
    { ...baseRow, id: "2", amount: "500.00", recordStatus: "Reversed" },
    {
      ...baseRow,
      id: "3",
      recordType: "Adjustment",
      amount: "-500.00",
      reversalOfId: "2",
    },
    // Membership-settled Share Capital payment ₱1,500.00 that fell back to MEMBERSHIP_FEE
    {
      ...baseRow,
      id: "4",
      sourceModule: "Membership",
      categoryCode: "MEMBERSHIP_FEE",
      categoryName: "Membership Fee",
      paymentPurpose: "Share Capital",
      amount: "1500.00",
    },
    // Operating expense ₱400.00
    {
      ...baseRow,
      id: "5",
      recordType: "Expense",
      sourceModule: "Manual",
      categoryCode: "FUEL_GASOLINE",
      categoryName: "Fuel and Gasoline",
      categoryType: "Expense",
      amount: "400.00",
    },
    // PayMongo Test-mode POS sale ₱300.00
    {
      ...baseRow,
      id: "6",
      amount: "300.00",
      paymentChannel: "PayMongo",
      gatewayEnvironment: "Test",
    },
  ];

  const report = compareFinancialBases(fixture);

  // Authoritative Bookkeeper Dashboard: ₱2,000.00 income − ₱400.00 expense = ₱1,600.00 surplus
  assert.equal(report.operatingDashboard.income, "2000.00");
  assert.equal(report.operatingDashboard.expenses, "400.00");
  assert.equal(report.operatingDashboard.netSurplus, "1600.00");
  assert.equal(report.operatingDashboard.adjustmentsDisclosed, "-500.00");

  // Incumbent Patronage: includes Test ₱300 (₱2,300) − ₱400 expense + (-₱500 adjustment) = ₱1,400
  assert.equal(report.incumbentPatronageBasis.netOperatingSurplus, "1400.00");
  // Proposed Patronage: ₱2,000 − ₱400 = ₱1,600 (reversal not subtracted twice, Test excluded)
  assert.equal(report.proposedPatronageBasis.netOperatingSurplus, "1600.00");

  // Incumbent Dividend Basis: counts ₱2,000 + ₱1,500 (Membership capital!) + ₱300 (Test!) = ₱3,800 income, ₱3,400 net
  assert.equal(report.incumbentDividendBasis.income, "3800.00");
  assert.equal(report.incumbentDividendBasis.netSurplus, "3400.00");
  // Proposed Dividend Basis matches Operating Dashboard: ₱2,000 income, ₱1,600 net
  assert.equal(report.proposedDividendBasis.netSurplus, "1600.00");

  const codes = report.discrepancies.map((item) => item.code);
  assert.deepEqual(codes, [
    "PATRONAGE_REVERSAL_DOUBLE_COUNT",
    "DIVIDEND_INCLUDES_MEMBERSHIP_SHARE_CAPITAL",
    "DIVIDEND_INCLUDES_TEST_PAYMENT",
    "PATRONAGE_INCLUDES_TEST_PAYMENT",
  ]);
});

test("strict settlement category resolution never falls back to income categories for Share Capital", () => {
  assert.deepEqual(resolveStrictSettlementCategoryCodes("Share Capital"), ["SHARE_CAPITAL"]);
  assert.equal(resolveStrictSettlementCategoryCodes("Share Capital").includes("MEMBERSHIP_FEE"), false);
  assert.equal(resolveStrictSettlementCategoryCodes("Share Capital").includes("OTHER_INCOME"), false);
  assert.deepEqual(resolveStrictSettlementCategoryCodes("Associate Membership Fee"), [
    "ASSOCIATE_MEMBERSHIP_FEE",
    "MEMBERSHIP_FEE",
  ]);
});

test("proposed Manila settlement date converts UTC 16:00–23:59 to the next Philippine calendar day", () => {
  // 2026-10-31 23:30 UTC is 2026-11-01 07:30 in Asia/Manila
  const paidAt = new Date("2026-10-31T23:30:00Z");
  assert.equal(proposedManilaSettlementRecordDate(paidAt), "2026-11-01");
  // 2026-10-31 15:59 UTC is 2026-10-31 23:59 in Asia/Manila
  assert.equal(proposedManilaSettlementRecordDate(new Date("2026-10-31T15:59:00Z")), "2026-10-31");
});

