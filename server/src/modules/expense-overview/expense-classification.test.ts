import assert from "node:assert/strict";
import test from "node:test";
import { classificationSql, classifyExpense, registryBackedSql } from "./expense-classification";
import { describeExpense } from "./expense-record-details";
import { fromCents, percentChange, percentOf, toCents } from "./expense-money";
import { expenseFilterSchema, expenseRecordQuerySchema } from "./expense-overview.schema";

const expense = (categoryCode: string, categoryType = "Expense", sourceModule: string | null = "Manual") => classifyExpense({ categoryCode, categoryType, sourceModule });

test("known operating categories are operating, and Rental or POS source does not change that", () => {
  for (const code of ["SALARIES_WAGES", "FUEL_GASOLINE", "UTILITIES", "REPAIR_MAINTENANCE", "OFFICE_SUPPLIES", "SUPPLIES", "INSURANCE", "TRANSPORTATION", "OTHER_EXPENSE"]) {
    assert.deepEqual(expense(code), { expenseClass: "operating", basis: "registry" });
  }
  assert.equal(expense("FUEL_GASOLINE", "Expense", "Rental").expenseClass, "operating");
  assert.equal(expense("OFFICE_SUPPLIES", "Expense", "POS").expenseClass, "operating");
});

test("money that leaves without being an expense is never operating", () => {
  assert.equal(expense("DIVIDEND_PAYMENT").expenseClass, "non_expense_disbursement");
  assert.equal(expense("CAPITAL_REFUND").expenseClass, "non_expense_disbursement");
  assert.equal(expense("LOAN_PRINCIPAL").expenseClass, "non_expense_disbursement");
  // Anything booked from the share-capital module is a capital movement whatever its category says.
  assert.equal(expense("OTHER_EXPENSE", "Expense", "Share Capital").expenseClass, "non_expense_disbursement");
});

test("capital purchases and cost of goods are kept apart from operating costs", () => {
  assert.equal(expense("EQUIPMENT_PURCHASE").expenseClass, "capital");
  assert.equal(expense("PRODUCT_COST").expenseClass, "other_recognized");
});

test("a custom Expense category is operating by default and flagged as a default, never dropped", () => {
  assert.deepEqual(expense("TRAINING_COSTS"), { expenseClass: "operating", basis: "default" });
});

test("an Expense row on an Income or Both category cannot be classified", () => {
  assert.deepEqual(expense("ADJUSTMENTS", "Both"), { expenseClass: "unclassified", basis: "unresolved" });
  assert.deepEqual(expense("RENTAL_INCOME", "Income"), { expenseClass: "unclassified", basis: "unresolved" });
});

test("the SQL expressions name every registry code and only safe literals", () => {
  const sql = classificationSql("r", "c");
  assert.match(sql, /'DIVIDEND_PAYMENT'/);
  assert.match(sql, /'SALARIES_WAGES'/);
  assert.match(sql, /r\.source_module = 'Share Capital'/);
  assert.match(registryBackedSql(), /THEN 1 ELSE 0/);
});

test("money is summed as cents without floating-point drift", () => {
  assert.equal(toCents("0.10") + toCents("0.20"), 30);
  assert.equal(fromCents(toCents("1234567.89") + toCents("0.01")), 1234567.9);
  assert.equal(toCents(null), 0);
  assert.equal(percentOf(25, 100), 25);
  assert.equal(percentOf(1, 0), null);
  assert.equal(percentChange(150, 100), 50);
  assert.equal(percentChange(50, 100), -50);
  assert.equal(percentChange(10, 0), null);
});

test("rental expense JSON becomes a description and exposes the entered payee, not proof of payment", () => {
  const rental = describeExpense(JSON.stringify({ description: "Tractor fuel", payee: "Shell Nasugbu", paymentMethod: "Cash", referenceNumber: "R-1" }), "Rental", "Fuel");
  assert.equal(rental.description, "Tractor fuel");
  assert.equal(rental.rental?.payee, "Shell Nasugbu");
  assert.equal(describeExpense("  plain   text ", "Manual", "Fuel").description, "plain text");
  assert.equal(describeExpense(null, "Manual", "Fuel").description, "Fuel");
  assert.equal(describeExpense("{not json", "Rental", "Fuel").description, "{not json");
});

test("filters default to this month, operating expenses and the previous period", () => {
  const parsed = expenseFilterSchema.parse({});
  assert.equal(parsed.period, "this_month");
  assert.deepEqual(parsed.classes, ["operating"]);
  assert.equal(parsed.compare, "previous");
});

test("filter lists accept comma-separated values and reject bad ones", () => {
  const parsed = expenseFilterSchema.parse({ categoryIds: "3,4,3", sourceModules: "Rental,POS", classes: "operating,capital" });
  assert.deepEqual(parsed.categoryIds, ["3", "4"]);
  assert.deepEqual(parsed.sourceModules, ["Rental", "POS"]);
  assert.deepEqual(parsed.classes, ["operating", "capital"]);
  assert.equal(expenseFilterSchema.safeParse({ sourceModules: "Bank" }).success, false);
  assert.equal(expenseFilterSchema.safeParse({ categoryIds: "abc" }).success, false);
  assert.equal(expenseFilterSchema.safeParse({ period: "custom", startDate: "2026-02-30", endDate: "2026-03-01" }).success, false);
  assert.equal(expenseFilterSchema.safeParse({ period: "custom", startDate: "2026-03-05", endDate: "2026-03-01" }).success, false);
  assert.equal(expenseFilterSchema.safeParse({ period: "custom", startDate: "2026-03-01" }).success, false);
  assert.equal(expenseFilterSchema.safeParse({ amountMin: "500", amountMax: "100" }).success, false);
});

test("a range without a period is treated as custom, and sorting is allow-listed", () => {
  const parsed = expenseFilterSchema.parse({ startDate: "2026-01-01", endDate: "2026-01-31" });
  assert.equal(parsed.period, "custom");
  assert.equal(expenseRecordQuerySchema.safeParse({ sortBy: "amount; DROP TABLE" }).success, false);
  const query = expenseRecordQuerySchema.parse({ page: "2", pageSize: "50", sortBy: "category", sortDirection: "asc" });
  assert.deepEqual([query.page, query.pageSize, query.sortBy, query.view], [2, 50, "category", "posted"]);
  assert.equal(expenseRecordQuerySchema.safeParse({ pageSize: "500" }).success, false);
});
