import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import JSZip from "jszip";
import mysql, { type Pool } from "mysql2/promise";
import { createFinanceRepository } from "../finance/finance.repository";
import { classifyExpense, expenseClasses } from "./expense-classification";
import { exportExpenseReport } from "./expense-export";
import { createExpenseOverviewRepository } from "./expense-overview.repository";
import { expenseFilterSchema, expenseRecordQuerySchema } from "./expense-overview.schema";
import { createExpenseOverviewService } from "./expense-overview.service";
import type { AuthContext } from "../auth/auth.types";

/**
 * Runs the Financial Overview SQL against a real MySQL schema (baseline + seasons).
 *
 * Opt in with EXPENSE_TEST_DB_NAME (must end in `_test`) plus optional EXPENSE_TEST_DB_HOST / _PORT / _USER /
 * _PASSWORD. The ledger, seasons, audit log and users are emptied first, so the test refuses to
 * run against any database whose name does not end in `_test`.
 *
 * The clock is pinned to 2026-11-12 (Asia/Manila). "This month" is therefore 1-12 November, compared with
 * 1-12 October. Every expected figure below is worked out by hand from the fixture, not read from the SQL.
 */
const database = process.env.EXPENSE_TEST_DB_NAME;
const enabled = Boolean(database && database.endsWith("_test"));
const clock = () => new Date("2026-11-12T04:00:00Z"); // 12:00 in Manila

const auth: AuthContext = {
  sessionId: "1",
  tokenHash: "hash",
  user: { id: "1", displayName: "Chair", email: "chair@example.test", username: "chair", role: "chairman" },
};

describe("Financial Overview SQL against MySQL", { skip: enabled ? false : "set EXPENSE_TEST_DB_NAME=<name>_test to run" }, () => {
  let pool: Pool;
  let seq = 0;
  const run = (sql: string, values: unknown[] = []) => pool.query(sql, values);
  const category = new Map<string, number>();

  const filters = (query: Record<string, string> = {}) => expenseFilterSchema.parse({ period: "this_month", ...query });
  const repository = () => createExpenseOverviewRepository(pool);
  const service = () => createExpenseOverviewService(repository(), clock);

  async function insert(row: {
    category: string; amount: number; date: string; type?: string; source?: string; sourceRecord?: number | null;
    status?: string; posted?: boolean; remarks?: string | null; season?: number | null; reversalOf?: number | null; recorder?: number;
  }) {
    seq += 1;
    const [result] = await run(
      `INSERT INTO financial_records (record_number, financial_category_id, recorded_by, approved_by, record_type, source_module, source_record_id,
         season_id, amount, record_date, record_status, reversal_of_record_id, remarks)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [`T-${String(seq).padStart(5, "0")}`, category.get(row.category), row.recorder ?? 2, row.posted === false ? null : 1, row.type ?? "Expense", row.source ?? "Manual",
        row.sourceRecord ?? null, row.season ?? null, row.amount, row.date, row.status ?? "Active", row.reversalOf ?? null, row.remarks ?? null],
    );
    return (result as { insertId: number }).insertId;
  }

  before(async () => {
    pool = mysql.createPool({
      host: process.env.EXPENSE_TEST_DB_HOST ?? "127.0.0.1",
      port: Number(process.env.EXPENSE_TEST_DB_PORT ?? 3306),
      user: process.env.EXPENSE_TEST_DB_USER ?? "root",
      password: process.env.EXPENSE_TEST_DB_PASSWORD ?? "",
      database,
      timezone: "Z",
      supportBigNumbers: true,
      bigNumberStrings: true,
      decimalNumbers: false,
    });
    await run("SET FOREIGN_KEY_CHECKS = 0");
    for (const table of ["financial_records", "audit_logs", "seasons", "users"]) await run(`TRUNCATE TABLE ${table}`);
    await run("SET FOREIGN_KEY_CHECKS = 1");
    await run("INSERT INTO roles (role_name, role_slug) VALUES ('Chairman', 'chairman'), ('Bookkeeper', 'bookkeeper') ON DUPLICATE KEY UPDATE role_slug = VALUES(role_slug)");
    const [roles] = await run("SELECT role_id AS id, role_slug AS slug FROM roles");
    const role = Object.fromEntries((roles as Array<{ id: number; slug: string }>).map((item) => [item.slug, item.id]));
    await run("INSERT INTO users (user_id, role_id, username, email, password_hash, display_name, account_status) VALUES (1, ?, 'chair', 'chair@x.test', 'x', 'Chair Person', 'Active'), (2, ?, 'book', 'book@x.test', 'x', 'Book Keeper', 'Active')", [role.chairman, role.bookkeeper]);
    await run("INSERT INTO seasons (season_id, season_name, season_type, season_year, start_date, end_date, season_status) VALUES (1, 'Wet 2026', 'Wet', 2026, '2026-06-01', '2026-11-30', 'Active')");

    const extra: Array<[string, string, string, number]> = [
      ["SALARIES_WAGES", "Salaries and Wages", "Expense", 1],
      ["DIVIDEND_PAYMENT", "Member Dividend Payment", "Expense", 1],
      ["SHARE_CAPITAL", "Share Capital", "Income", 1],
      ["EQUIPMENT_PURCHASE", "Equipment Purchase", "Expense", 1],
      ["TRAINING_COSTS", "Training Costs", "Expense", 1],
      ["OLD_TRAINING", "Old Training", "Expense", 0],
      ["ADJUSTMENTS", "Adjustments", "Both", 1],
    ];
    for (const [code, name, type, active] of extra) {
      await run("INSERT INTO financial_categories (category_code, category_name, category_type, is_system_category, is_active) VALUES (?, ?, ?, 0, ?) ON DUPLICATE KEY UPDATE category_name = VALUES(category_name)", [code, name, type, active]);
    }
    const [categories] = await run("SELECT financial_category_id AS id, category_code AS code FROM financial_categories");
    for (const item of categories as Array<{ id: number; code: string }>) category.set(item.code, item.id);

    // ---- 1-12 November (current window)
    await insert({ category: "FUEL_GASOLINE", amount: 1000.1, date: "2026-11-03" });
    await insert({ category: "FUEL_GASOLINE", amount: 500.2, date: "2026-11-05", source: "Rental", sourceRecord: 5 });
    await insert({ category: "UTILITIES", amount: 2000, date: "2026-11-10", season: 1 });
    await insert({ category: "SALARIES_WAGES", amount: 5000, date: "2026-11-12" });
    await insert({ category: "TRAINING_COSTS", amount: 300, date: "2026-11-02" });
    await insert({ category: "OFFICE_SUPPLIES", amount: 120, date: "2026-11-12", source: "POS" });
    await insert({ category: "PRODUCT_COST", amount: 700, date: "2026-11-04" });
    await insert({ category: "EQUIPMENT_PURCHASE", amount: 9000, date: "2026-11-06" });
    await insert({ category: "DIVIDEND_PAYMENT", amount: 4000, date: "2026-11-07", source: "Share Capital" });
    await insert({ category: "OFFICE_SUPPLIES", amount: 250, date: "2026-11-08", source: "POS", posted: false });
    const voided = await insert({ category: "UTILITIES", amount: 123, date: "2026-11-09", status: "Voided" });
    const reversed = await insert({ category: "FUEL_GASOLINE", amount: 800, date: "2026-11-03", status: "Reversed" });
    await insert({ category: "FUEL_GASOLINE", amount: -800, date: "2026-11-03", type: "Adjustment", reversalOf: reversed });
    await insert({ category: "ADJUSTMENTS", amount: 77, date: "2026-11-11" });
    await insert({ category: "FUEL_GASOLINE", amount: 50, date: "2026-11-20" }); // dated after "today"
    await insert({ category: "SHARE_CAPITAL", amount: 99_999, date: "2026-11-05", type: "Income" });
    await insert({ category: "PRODUCT_COST", amount: 15, date: "2026-11-04", source: "Rental", sourceRecord: 88 });
    await insert({ category: "PRODUCT_COST", amount: 15, date: "2026-11-04", source: "Rental", sourceRecord: 88 });
    const mismatched = await insert({ category: "DIVIDEND_PAYMENT", amount: 10, date: "2026-11-08", source: "Share Capital" });
    await insert({ category: "DIVIDEND_PAYMENT", amount: -10, date: "2026-11-08", type: "Adjustment", source: "Share Capital", reversalOf: mismatched });
    void voided;

    // ---- 1-12 October (comparison window) and one row outside the elapsed days
    await insert({ category: "FUEL_GASOLINE", amount: 800, date: "2026-10-04" });
    await insert({ category: "UTILITIES", amount: 2000, date: "2026-10-05" });
    await insert({ category: "OFFICE_SUPPLIES", amount: 100, date: "2026-10-06" });
    await insert({ category: "REPAIR_MAINTENANCE", amount: 400, date: "2026-10-07" });
    await insert({ category: "UTILITIES", amount: 999, date: "2026-10-20", remarks: "=HYPERLINK(\"http://evil\",\"x\")" });
    await insert({ category: "OLD_TRAINING", amount: 40, date: "2026-09-01" });

    // ---- 130 small rows in August to prove nothing stops at 100
    for (let day = 0; day < 130; day += 1) await insert({ category: "OTHER_EXPENSE", amount: 1, date: `2026-08-${String((day % 28) + 1).padStart(2, "0")}` });

    await run("INSERT INTO audit_logs (user_id, action, entity_table, record_id, description) VALUES (2, 'financial_record.posted', 'financial_records', 1, 'posted')");
  });

  after(async () => {
    await pool.end();
  });

  it("headline total counts posted operating expenses from every source and nothing else", async () => {
    const summary = await service().summary(filters());
    // 1000.10 + 500.20 (Rental) + 2000 + 5000 + 300 (custom category) + 120 (POS) = 8920.30
    assert.equal(summary.totals.amount, 8920.3);
    assert.equal(summary.totals.records, 6);
    assert.equal(summary.totals.averageAmount, 1486.72); // 8920.30 / 6
    assert.deepEqual([summary.period.effective.startDate, summary.period.effective.endDate, summary.period.effective.partial, summary.period.effective.days], ["2026-11-01", "2026-11-12", true, 12]);
  });

  it("compares against the same elapsed days of the previous month", async () => {
    const summary = await service().summary(filters());
    assert.deepEqual(summary.period.previous, { startDate: "2026-10-01", endDate: "2026-10-12", days: 12 });
    // 800 + 2000 + 100 + 400 = 3300; the 999 on 20 October is outside the elapsed days.
    assert.deepEqual(summary.previousTotals, { records: 4, amount: 3300 });
    assert.deepEqual(summary.change, { amount: 5620.3, percent: 170.31, basis: "ok" });
  });

  it("reports N/A percentage when the previous period is zero, and no change without a comparison", async () => {
    // 1 September is compared with 31 August, which has no rows.
    const zero = await service().summary(filters({ period: "custom", startDate: "2026-09-01", endDate: "2026-09-01" }));
    assert.equal(zero.totals.amount, 40);
    assert.deepEqual(zero.change, { amount: 40, percent: null, basis: "no_previous_base" });
    const none = await service().summary(filters({ compare: "none" }));
    assert.deepEqual(none.change, { amount: null, percent: null, basis: "no_comparison" });
  });

  it("largest category is by posted amount with its share", async () => {
    const summary = await service().summary(filters());
    assert.equal(summary.largestCategory?.name, "Salaries and Wages");
    assert.equal(summary.largestCategory?.amount, 5000);
    assert.equal(summary.largestCategory?.share, 56.05); // 5000 / 8920.30
  });

  it("category, source, matrix and trend totals all add up to the headline", async () => {
    const s = service();
    const f = filters();
    const [summary, categories, sources, matrix, trend] = await Promise.all([s.summary(f), s.categories(f), s.sources(f), s.matrix(f), s.trends(f)]);
    assert.equal(categories.total, summary.totals.amount);
    assert.equal(categories.items.reduce((sum, item) => sum + item.records, 0), summary.totals.records);
    assert.equal(Math.round(categories.items.reduce((sum, item) => sum + (item.share ?? 0), 0)), 100);
    assert.deepEqual(sources.items.map((item) => [item.sourceModule, item.amount]), [["Manual", 8300.1], ["Rental", 500.2], ["POS", 120]]);
    assert.equal(sources.total, summary.totals.amount);
    assert.equal(matrix.total, summary.totals.amount);
    assert.equal(matrix.reconciles, true);
    assert.equal(matrix.records, summary.totals.records);
    assert.equal(trend.total, summary.totals.amount);
    assert.equal(trend.granularity, "day");
    assert.equal(trend.buckets.length, 12);
    assert.equal(trend.buckets.find((bucket) => bucket.key === "2026-11-03")?.amount, 1000.1);
    assert.equal(trend.buckets.find((bucket) => bucket.key === "2026-11-09")?.amount, 0); // zero-filled, and the voided 123 is not there
    assert.equal(trend.buckets[3].previous?.amount, 800); // 4 November against 4 October
    assert.equal(trend.previousTotal, 3300);
  });

  it("change drivers add up to the overall change and include new and stopped categories", async () => {
    const drivers = await service().drivers(filters());
    assert.equal(drivers.available, true);
    assert.equal(drivers.totalChange, 5620.3);
    assert.equal(drivers.reconciles, true);
    const byName = Object.fromEntries(drivers.items.map((item) => [item.name, item]));
    assert.equal(byName["Fuel and Gasoline"].change, 700.3);
    assert.equal(byName["Salaries and Wages"].state, "new");
    assert.equal(byName["Training Costs"].state, "new");
    assert.equal(byName["Repair and Maintenance"].state, "stopped");
    assert.equal(byName["Repair and Maintenance"].change, -400);
    assert.equal(byName["Utilities"].state, "unchanged");
    assert.equal(drivers.largestIncrease?.name, "Salaries and Wages");
    assert.equal(drivers.largestDecrease?.name, "Repair and Maintenance");
    assert.equal(Math.round((drivers.items.reduce((sum, item) => sum + (item.contribution ?? 0), 0)) * 10) / 10, 100);
  });

  it("separates other classes instead of adding them to operating or hiding them", async () => {
    const summary = await service().summary(filters());
    const classes = Object.fromEntries(summary.reconciliation.classTotals.map((item) => [item.expenseClass, item.amount]));
    assert.deepEqual(classes, { operating: 8920.3, other_recognized: 730, capital: 9000, non_expense_disbursement: 4010, unclassified: 77 });
    // Financial Analytics counts every posted non-capital-movement expense: everything except the share-capital dividend rows.
    assert.equal(summary.reconciliation.recognizedExpenseTotal, 18727.3);
    assert.equal(summary.reconciliation.analyticsComparableTotal, 18727.3);
    assert.equal(summary.reconciliation.reconciles, true);
    const capital = await service().summary(filters({ classes: "capital" }));
    assert.equal(capital.totals.amount, 9000);
    const both = await service().summary(filters({ classes: "operating,other_recognized" }));
    assert.equal(both.totals.amount, 9650.3);
  });

  it("unposted, voided, reversed and unclassified rows stay out of posted totals but are counted", async () => {
    const { secondary } = await service().summary(filters());
    assert.deepEqual(secondary.unposted, { records: 1, amount: 250 });
    assert.deepEqual(secondary.voided, { records: 1, amount: 123 });
    assert.deepEqual(secondary.correctedOrReversed, { records: 1, amount: 800 });
    assert.deepEqual(secondary.needsClassification, { records: 1, amount: 77 });
  });

  it("the table and the cards agree, and pagination covers every record", async () => {
    const s = service();
    const base = { period: "this_month" };
    const page1 = await s.records(expenseRecordQuerySchema.parse({ ...base, pageSize: "4", sortBy: "amount", sortDirection: "desc" }));
    assert.equal(page1.total, 6);
    assert.equal(page1.totalAmount, 8920.3);
    assert.deepEqual(page1.records.map((record) => record.amount), [5000, 2000, 1000.1, 500.2]);
    const page2 = await s.records(expenseRecordQuerySchema.parse({ ...base, pageSize: "4", page: "2", sortBy: "amount", sortDirection: "desc" }));
    assert.deepEqual(page2.records.map((record) => record.amount), [300, 120]);
    const unposted = await s.records(expenseRecordQuerySchema.parse({ ...base, view: "unposted", classes: "operating" }));
    assert.deepEqual([unposted.total, unposted.records[0]?.postingStatus], [1, "Unposted"]);
    const voided = await s.records(expenseRecordQuerySchema.parse({ ...base, view: "voided" }));
    assert.equal(voided.records[0]?.postingStatus, "Voided");
  });

  it("search, category, source, amount, recorder and season filters narrow the same population", async () => {
    const s = service();
    const count = async (extra: Record<string, string>) => (await s.records(expenseRecordQuerySchema.parse({ period: "this_month", ...extra }))).total;
    assert.equal(await count({ search: "fuel" }), 2);
    assert.equal(await count({ search: "T-00002" }), 1);
    assert.equal(await count({ categoryIds: String(category.get("UTILITIES")) }), 1);
    assert.equal(await count({ sourceModules: "Rental" }), 1);
    assert.equal(await count({ sourceModules: "Rental,POS" }), 2);
    assert.equal(await count({ amountMin: "1000", amountMax: "2000" }), 2);
    assert.equal(await count({ recordedBy: "1" }), 0);
    assert.equal(await count({ postedBy: "1" }), 6);
    assert.equal(await count({ seasonId: "1" }), 1);
    assert.equal(await count({ search: "100%" }), 0); // LIKE wildcards are escaped, not interpreted
  });

  it("integrity checks find the planted problems and use neutral labels", async () => {
    const integrity = await service().integrity(filters());
    const check = Object.fromEntries(integrity.checks.map((item) => [item.id, item]));
    assert.equal(check.unposted.records, 1);
    assert.equal(check.classification.records, 1);
    assert.equal(check["reversal-mismatch"].records, 1); // the 10.00 dividend row that still has an Active reversal
    assert.equal(check["void-audit"].records, 1);
    assert.equal(check.duplicates.records, 2);
    assert.equal(check["future-dated"].records, 1);
    assert.equal(check["reversal-entries"].records, 0); // the offsetting rows are Adjustments, not expenses
    assert.ok(integrity.reviewCount >= 4);
  });

  it("record detail shows relationships, history and the limits of what is known", async () => {
    const [rows] = await run("SELECT financial_record_id AS id FROM financial_records WHERE record_number = 'T-00001'");
    const detail = await service().recordDetail(String((rows as Array<{ id: number }>)[0].id));
    assert.equal(detail?.postingStatus, "Posted");
    assert.equal(detail?.history.length, 1);
    assert.equal(detail?.disbursement.verified, false);
    assert.equal(detail?.evidence.available, false);
    assert.equal(await service().recordDetail("999999"), null);
    const [incomeRows] = await run("SELECT financial_record_id AS id FROM financial_records WHERE record_type = 'Income' LIMIT 1");
    assert.equal(await service().recordDetail(String((incomeRows as Array<{ id: number }>)[0].id)), null);
  });

  it("filter options list inactive categories that still have history", async () => {
    const options = await service().options();
    assert.equal(options.capabilities.seasons, true);
    assert.equal(options.categories.find((item) => item.code === "OLD_TRAINING")?.isActive, false);
    assert.ok(options.sourceModules.some((item) => item.value === "Rental"));
    assert.deepEqual(options.recordedBy.map((item) => item.name), ["Book Keeper"]);
  });

  it("the TypeScript classifier and the SQL classifier agree for every posted row", async () => {
    const all = filters({ classes: expenseClasses.join(","), period: "all_time" });
    const s = service();
    const everything = await s.records(expenseRecordQuerySchema.parse({ period: "all_time", classes: expenseClasses.join(","), pageSize: "100", sortBy: "amount", sortDirection: "desc" }));
    assert.ok(everything.total > 100);
    const [rows] = await run(
      `SELECT c.category_code AS code, c.category_type AS type, r.source_module AS source, COUNT(*) AS n, SUM(r.amount) AS amount FROM financial_records r JOIN financial_categories c USING (financial_category_id)
        WHERE r.record_type = 'Expense' AND r.record_status = 'Active' AND r.approved_by IS NOT NULL AND r.record_date <= '2026-11-12' GROUP BY c.category_code, c.category_type, r.source_module`,
    );
    const expected = new Map<string, number>();
    for (const row of rows as Array<{ code: string; type: string; source: string; amount: string }>) {
      const { expenseClass } = classifyExpense({ categoryCode: row.code, categoryType: row.type, sourceModule: row.source });
      expected.set(expenseClass, (expected.get(expenseClass) ?? 0) + Math.round(Number(row.amount) * 100));
    }
    const sqlTotals = await repository().classTotals(all, { startDate: null, endDate: "2026-11-12" });
    for (const item of sqlTotals) assert.equal(Math.round(item.amount * 100), expected.get(item.expenseClass), item.expenseClass);
    assert.equal(sqlTotals.length, expected.size);
  });

  it("nothing stops at 100 records: the list and the exports cover the whole filtered population", async () => {
    const august = { period: "custom", startDate: "2026-08-01", endDate: "2026-08-31", compare: "none" };
    const s = service();
    const query = expenseRecordQuerySchema.parse({ ...august, pageSize: "100", page: "2" });
    const page = await s.records(query);
    assert.equal(page.total, 130);
    assert.equal(page.records.length, 30);
    // The Bookkeeper's report no longer truncates at the 100 most recent records.
    const finance = createFinanceRepository(pool);
    const limited = await finance.operatingExpenses({ startDate: "2026-08-01", endDate: "2026-08-31" });
    const all = await finance.operatingExpenses({ startDate: "2026-08-01", endDate: "2026-08-31" }, { all: true });
    assert.equal(limited.items.length, 100);
    assert.equal(all.items.length, 130);
    assert.equal(all.count, 130);
    // The Chairman's Excel export holds every row, with totals that match.
    const file = await exportExpenseReport(s, { filters: expenseFilterSchema.parse(august), kind: "records", view: "posted", sortBy: "recordDate", sortDirection: "desc", format: "xlsx" }, auth, clock());
    const zip = await JSZip.loadAsync(file.buffer);
    const sheet = await zip.file("xl/worksheets/sheet2.xml")!.async("string");
    assert.equal((sheet.match(/<row /g) ?? []).length, 131); // header + 130 records
    assert.match(file.filename, /^trackcoop-expenses-records-2026-11-12\.xlsx$/);
  });

  it("exported text cannot run as a spreadsheet formula", async () => {
    const file = await exportExpenseReport(service(), { filters: expenseFilterSchema.parse({ period: "custom", startDate: "2026-10-15", endDate: "2026-10-25", compare: "none" }), kind: "records", view: "posted", sortBy: "recordDate", sortDirection: "desc", format: "xlsx" }, auth, clock());
    const zip = await JSZip.loadAsync(file.buffer);
    const sheet = await zip.file("xl/worksheets/sheet2.xml")!.async("string");
    assert.ok(sheet.includes("&apos;=HYPERLINK"), "the formula text is stored with a leading apostrophe");
    assert.ok(!/<t[^>]*>=HYPERLINK/.test(sheet));
  });

  it("a PDF summary renders", async () => {
    const file = await exportExpenseReport(service(), { filters: filters(), kind: "summary", view: "posted", sortBy: "recordDate", sortDirection: "desc", format: "pdf" }, auth, clock());
    assert.equal(file.buffer.subarray(0, 4).toString(), "%PDF");
  });

  it("insights quote real figures with their basis", async () => {
    const insights = await service().insights(filters());
    const ids = insights.map((item) => item.id);
    assert.ok(ids.includes("change") && ids.includes("largest") && ids.includes("unposted"));
    const change = insights.find((item) => item.id === "change")!;
    assert.match(change.text, /PHP 5,620\.30 \(170\.31%\) higher/);
    assert.match(change.basis, /2026-11-01 to 2026-11-12/);
  });

  it("a period that has not started yet reports nothing rather than zeros dressed as results", async () => {
    const future = await service().summary(filters({ period: "custom", startDate: "2027-01-01", endDate: "2027-01-31" }));
    assert.equal(future.totals.records, 0);
    assert.match(future.limitations.join(" "), /not started/);
  });
});
