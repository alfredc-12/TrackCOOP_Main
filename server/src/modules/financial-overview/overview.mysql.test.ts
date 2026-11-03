import assert from "node:assert/strict";
import test from "node:test";
import mysql, { type Pool } from "mysql2/promise";
import JSZip from "jszip";
import { createFinanceRepository } from "../finance/finance.repository";
import { getFinancialTransparency } from "../finance/financial-transparency";
import { createOverviewRepository } from "./overview.repository";
import { overviewFilterSchema, cents } from "./overview.schema";
import { overviewExport } from "./overview.export";
import { postedOperatingSql } from "../finance/financial-posting-rules";
const enabled = process.env.OVERVIEW_LOCAL_SQL_TEST === "1",
  now = new Date("2026-11-03T04:00:00Z");
const filters = (patch: Record<string, unknown> = {}) =>
  overviewFilterSchema.parse({
    period: "custom",
    startDate: "2026-10-01",
    endDate: "2026-10-31",
    ...patch,
  });
export const ddl = [
  `CREATE TABLE financial_categories(financial_category_id BIGINT PRIMARY KEY,category_code VARCHAR(80),category_name VARCHAR(255),category_type VARCHAR(20),is_active TINYINT)`,
  `CREATE TABLE users(user_id BIGINT PRIMARY KEY,display_name VARCHAR(100))`,
  `CREATE TABLE seasons(season_id BIGINT PRIMARY KEY,season_name VARCHAR(100))`,
  `CREATE TABLE pos_sales(pos_sale_id BIGINT PRIMARY KEY)`,
  `CREATE TABLE rental_bookings(rental_booking_id BIGINT PRIMARY KEY)`,
  `CREATE TABLE payment_references(payment_reference_id BIGINT PRIMARY KEY,reference_number VARCHAR(100),payment_purpose VARCHAR(80),payment_channel VARCHAR(40),gateway_environment VARCHAR(20),validation_status VARCHAR(30),amount DECIMAL(14,2))`,
  `CREATE TABLE financial_records(financial_record_id BIGINT PRIMARY KEY,record_number VARCHAR(100),payment_reference_id BIGINT NULL,financial_category_id BIGINT,record_type VARCHAR(30),source_module VARCHAR(40),source_record_id BIGINT NULL,amount DECIMAL(14,2),record_date DATE,record_status VARCHAR(30),approved_by BIGINT NULL,recorded_by BIGINT,correction_of_record_id BIGINT NULL,reversal_of_record_id BIGINT NULL,remarks TEXT,created_at DATETIME,season_id BIGINT NULL)`,
  `CREATE TABLE audit_logs(audit_log_id BIGINT AUTO_INCREMENT PRIMARY KEY,user_id BIGINT,entity_table VARCHAR(80),record_id BIGINT,action VARCHAR(80),action_time DATETIME,description TEXT)`,
  `CREATE TABLE documents(document_id BIGINT PRIMARY KEY,title VARCHAR(255),document_type VARCHAR(80),access_level VARCHAR(40),document_status VARCHAR(40),related_module VARCHAR(80),related_record_id BIGINT,uploaded_at DATETIME)`,
];
export async function seedOverview(pool: Pool) {
  for (const sql of ddl) {
    const name = /CREATE TABLE (\w+)/.exec(sql)![1];
    await pool.query(`DROP TABLE IF EXISTS ${name}`);
    await pool.query(sql);
  }
  await pool.query(`INSERT INTO users VALUES (1,'Bookkeeper'),(2,'Chairman')`);
  await pool.query(`INSERT INTO seasons VALUES (1,'Harvest 2026')`);
  await pool.query(`INSERT INTO pos_sales VALUES (1),(2)`);
  await pool.query(`INSERT INTO rental_bookings VALUES (1)`);
  await pool.query(
    `INSERT INTO financial_categories VALUES (1,'POS_SALES','Product sales','Income',1),(2,'RENTAL_INCOME','Rental services','Income',1),(3,'DONATIONS_GRANTS','Donations and grants','Income',1),(4,'UTILITIES','Utilities','Expense',1),(5,'PRODUCT_COST','Product purchases','Expense',1),(6,'CUSTOM','Custom category','Both',1),(7,'SHARE_CAPITAL','Capital contributions','Income',1),(8,'TRANSFER','Internal transfers','Both',1),(9,'OFFICE_SUPPLIES','Office supplies','Expense',0),(10,'INCOME_ONLY','Income-only category','Income',1),(11,'LOAN_PRINCIPAL','Loan principal','Both',1),(12,'EQUIPMENT_PURCHASE','Equipment assets','Expense',1)`,
  );
  await pool.query(
    `INSERT INTO payment_references VALUES (1,'SALE-1','POS/Product','PayMongo','Live','Validated',1000),(2,'RENT-1','Rental','Cash','Manual','Validated',500),(3,'CAP-1','Share Capital','Cash','Manual','Validated',25),(4,'SALE-DUP','POS/Product','Cash','Manual','Validated',300)`,
  );
  const add = async (
    id: number,
    type: string,
    amount: string,
    category: number,
    source = "Manual",
    status = "Active",
    posted: number | null = 1,
    ref: number | null = null,
    sourceId: number | null = null,
    parent: number | null = null,
    rev: number | null = null,
    date = "2026-10-10",
    remarks = "Recorded financial activity",
  ) => {
    await pool.execute(
      `INSERT INTO financial_records VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        id,
        `FIN-${id}`,
        ref,
        category,
        type,
        source,
        sourceId,
        amount,
        date,
        status,
        posted,
        1,
        parent,
        rev,
        remarks,
        `${date} 02:00:00`,
        1,
      ],
    );
  };
  await add(
    1,
    "Income",
    "1000.00",
    1,
    "POS",
    "Active",
    1,
    1,
    1,
    null,
    null,
    "2026-10-05",
  );
  await add(
    2,
    "Income",
    "500.00",
    2,
    "Rental",
    "Active",
    1,
    2,
    1,
    null,
    null,
    "2026-10-07",
  );
  await add(3, "Income", "200.00", 3);
  await add(4, "Expense", "100.00", 4, "Rental");
  await add(5, "Expense", "200.00", 5, "POS");
  await add(6, "Expense", "100.00", 6);
  await add(7, "Expense", "50.00", 9);
  await add(8, "Income", "70.00", 1, "Manual", "Active", null);
  await add(9, "Expense", "80.00", 4, "Manual", "Active", null);
  await add(10, "Income", "500.00", 1, "Manual", "Voided");
  await add(11, "Income", "100.00", 1, "Manual", "Corrected");
  await add(12, "Income", "120.00", 1, "Manual", "Active", 1, null, null, 11);
  await add(13, "Income", "100.00", 1, "Manual", "Reversed");
  await add(
    14,
    "Adjustment",
    "-100.00",
    6,
    "Manual",
    "Active",
    1,
    null,
    null,
    null,
    13,
  );
  await add(15, "Income", "1000.00", 7, "Share Capital");
  await add(16, "Income", "500.00", 7, "Other");
  await add(17, "Expense", "100.00", 8);
  await add(18, "Expense", "1000.00", 11);
  await add(19, "Expense", "2000.00", 12);
  await add(20, "Income", "25.00", 6, "Payment", "Active", 1, 3);
  await add(21, "Expense", "20.00", 10);
  await add(22, "Income", "300.00", 1, "POS", "Active", 1, 4, 2);
  await add(23, "Income", "300.00", 1, "POS", "Active", 1, 4, 2);
  await add(24, "Income", "40.00", 1);
  await add(25, "Income", "60.00", 1, "Manual", "Active", 1, null, null, 24);
  await add(26, "Income", "80.00", 1, "POS", "Active", 1, null, 999);
  await add(27, "Income", "45.00", 1, "Payment", "Active", 1, 999);
  await add(28, "Income", "1.10", 3);
  await add(29, "Expense", "0.30", 6);
  await add(
    30,
    "Income",
    "800.00",
    3,
    "Manual",
    "Active",
    1,
    null,
    null,
    null,
    null,
    "2026-09-10",
  );
  await add(
    31,
    "Expense",
    "300.00",
    4,
    "Manual",
    "Active",
    1,
    null,
    null,
    null,
    null,
    "2026-09-10",
  );
  await pool.query(
    `INSERT INTO audit_logs(user_id,entity_table,record_id,action,action_time,description) VALUES (1,'financial_records',12,'financial_record.corrected','2026-10-10 02:00:00','Corrected entry')`,
  );
  await pool.query(
    `INSERT INTO documents VALUES (1,'Approved correction receipt','Receipt','Admin-only','Active','Finance',12,'2026-10-10'),(2,'Restricted private receipt','Receipt','Bookkeeper-only','Active','Finance',12,'2026-10-10')`,
  );
}
test(
  "Financial Overview real SQL calculations, consistent record scope and full exports",
  { skip: !enabled },
  async (t) => {
    const setup = await mysql.createConnection({
      host: "127.0.0.1",
      port: 33319,
      user: "root",
    });
    const [identity] = await setup.query<mysql.RowDataPacket[]>(
      "SELECT @@datadir AS directory",
    );
    assert.match(
      String(identity[0].directory).replace(/\\/g, "/"),
      /TrackCOOP_FinancialOverview_Worktree\/\.overview-test-data/i,
    );
    await setup.query(
      "CREATE DATABASE IF NOT EXISTS trackcoop_overview_fixture",
    );
    await setup.end();
    const pool = mysql.createPool({
      host: "127.0.0.1",
      port: 33319,
      user: "root",
      database: "trackcoop_overview_fixture",
      timezone: "Z",
      dateStrings: true,
    });
    const repo = createOverviewRepository(pool, () => now);
    try {
      await seedOverview(pool);
      await t.test(
        "posted income, grants, legitimate POS/Rental expenses, custom and inactive historical categories are included",
        async () => {
          const r = await repo.summary(filters());
          assert.equal(r.summary.income, "1881.10");
          assert.equal(r.summary.expense, "450.30");
          assert.equal(r.summary.net, "1430.80");
          assert.equal(r.summary.incomeRecords, 6);
          assert.equal(r.summary.expenseRecords, 5);
          assert.equal(r.review.unpostedIncome, 1);
          assert.equal(r.review.unpostedExpense, 1);
          assert.ok(r.review.records >= 7);
          assert.ok(
            r.categories.expense.some(
              (c) => !c.active && c.code === "OFFICE_SUPPLIES",
            ),
          );
        },
      );
      await t.test(
        "capital, principal, transfers, assets, unposted, voided and superseded/reversed entries do not inflate totals",
        async () => {
          const list = await repo.activity(filters({ pageSize: 100 }));
          const ids = list.items.map((r) => r.id);
          for (const id of [
            "8",
            "9",
            "10",
            "11",
            "13",
            "14",
            "15",
            "16",
            "17",
            "18",
            "19",
            "20",
            "21",
            "22",
            "23",
            "24",
            "26",
            "27",
          ])
            assert.ok(!ids.includes(id), id);
          assert.ok(ids.includes("12"));
          assert.ok(ids.includes("25"));
        },
      );
      await t.test(
        "category and source sums reconcile to both headlines and exact decimal arithmetic",
        async () => {
          const r = await repo.summary(filters());
          assert.ok(Object.values(r.reconciliation).every(Boolean));
          assert.equal(
            r.categories.income.reduce(
              (sum, x) => sum + cents(x.amount),
              BigInt(0),
            ),
            cents(r.summary.income),
          );
          assert.equal(
            r.sources.reduce((sum, x) => sum + cents(x.expense), BigInt(0)),
            cents(r.summary.expense),
          );
          const [direct] = await pool.query<mysql.RowDataPacket[]>(
            `SELECT SUM(CASE WHEN fr.record_type='Income' THEN fr.amount ELSE 0 END) AS income,SUM(CASE WHEN fr.record_type='Expense' THEN fr.amount ELSE 0 END) AS expense FROM financial_records fr LEFT JOIN financial_categories fc ON fc.financial_category_id=fr.financial_category_id WHERE ${postedOperatingSql()} AND record_date BETWEEN '2026-10-01' AND '2026-10-31'`,
          );
          assert.equal(direct[0].income, r.summary.income);
          assert.equal(direct[0].expense, r.summary.expense);
        },
      );
      await t.test(
        "legacy summary, transparency and finance trends use the identical operating population",
        async () => {
          const common = await repo.summary(filters({ period: "all_time" }));
          const legacy = createFinanceRepository(pool);
          const summary = await legacy.summary();
          assert.equal(summary.incomeTotal.toFixed(2), common.summary.income);
          assert.equal(summary.expenseTotal.toFixed(2), common.summary.expense);
          assert.equal(summary.netTotal.toFixed(2), common.summary.net);
          const selected = await repo.summary(filters());
          const transparency = await getFinancialTransparency(pool, {
            period: "custom",
            startDate: "2026-10-01",
            endDate: "2026-10-31",
          });
          assert.equal(
            transparency.incomeTotal.toFixed(2),
            selected.summary.income,
          );
          assert.equal(
            transparency.expenseTotal.toFixed(2),
            selected.summary.expense,
          );
          const trend = (await legacy.trends()).find(
            (row) => row.month === "2026-10",
          );
          assert.equal(trend!.incomeTotal.toFixed(2), selected.summary.income);
          assert.equal(
            trend!.expenseTotal.toFixed(2),
            selected.summary.expense,
          );
        },
      );
      await t.test(
        "status-focused selections narrow only activity; full counts and stable server pages are preserved",
        async () => {
          const r = await repo.summary(filters({ view: "review" }));
          assert.equal(r.summary.income, "1881.10");
          const list = await repo.activity(
            filters({ view: "income", pageSize: 2, page: 2 }),
          );
          assert.equal(list.total, 6);
          assert.equal(list.page, 2);
          assert.equal(list.items.length, 2);
          assert.ok(list.items.every((r) => r.type === "Income"));
          const review = await repo.activity(
            filters({ view: "review", reviewKind: "classification" }),
          );
          assert.ok(review.items.some((r) => r.id === "21"));
        },
      );
      await t.test(
        "search, source, category, actor, amount and season filters share the same base; audit records stay visible",
        async () => {
          const r = await repo.summary(filters({ source: "Rental" }));
          assert.equal(r.summary.income, "500.00");
          assert.equal(r.summary.expense, "100.00");
          const c = await repo.summary(
            filters({
              categoryId: "6",
              amountMax: "100.00",
              recordedBy: "1",
              approvedBy: "1",
              seasonId: "1",
            }),
          );
          assert.equal(c.summary.expense, "100.30");
          assert.equal(
            (await repo.activity(filters({ search: "SALE-1" }))).items[0].id,
            "1",
          );
          assert.equal(
            (
              await repo.activity(
                filters({ view: "history", recordStatus: "Voided" }),
              )
            ).items[0].id,
            "10",
          );
          assert.equal(
            (await repo.activity(filters({ view: "adjustments" }))).items[0].id,
            "14",
          );
        },
      );
      await t.test(
        "period comparison, all-time/empty periods, and zero/negative net are transparent",
        async () => {
          const r = await repo.summary(filters());
          assert.equal(r.previous!.income, "800.00");
          assert.equal(r.previous!.expense, "300.00");
          const empty = await repo.summary(
            filters({ search: "missing member" }),
          );
          assert.equal(empty.summary.net, "0.00");
          assert.equal(empty.changes.income.percent, null);
          const all = await repo.summary(filters({ period: "all_time" }));
          assert.equal(all.previous, null);
          assert.equal(all.summary.income, "2681.10");
          const deficit = await repo.summary(filters({ categoryId: "4" }));
          assert.equal(deficit.summary.net, "-100.00");
        },
      );
      await t.test(
        "trend bucket sums agree with summary and empty months remain visible",
        async () => {
          const r = await repo.summary(
            filters({
              period: "custom",
              startDate: "2026-08-01",
              endDate: "2026-10-31",
              granularity: "month",
            }),
          );
          assert.equal(r.trend.length, 3);
          assert.equal(r.trend[0].income, "0.00");
          assert.equal(
            r.trend.reduce((sum, x) => sum + cents(x.net), BigInt(0)),
            cents(r.summary.net),
          );
        },
      );
      await t.test(
        "detail is read-only, exposes relationships/authors/history and only authorized document metadata",
        async () => {
          const r = await repo.detail("12");
          assert.equal(r.recordedBy.name, "Bookkeeper");
          assert.equal(r.correctionOfId, "11");
          assert.ok(r.related.some((x) => x.id === "11"));
          assert.equal(r.history.length, 1);
          assert.equal(r.documents.length, 1);
          assert.equal(r.documents[0].title, "Approved correction receipt");
          await assert.rejects(() => repo.detail("999"), {
            code: "FINANCIAL_RECORD_NOT_FOUND",
          });
        },
      );
      await t.test(
        "missing season support remains explicit instead of inventing data",
        async () => {
          await pool.query(
            "ALTER TABLE financial_records DROP COLUMN season_id",
          );
          try {
            assert.equal((await repo.options()).capabilities.seasons, false);
            await assert.rejects(
              () => repo.summary(filters({ seasonId: "1" })),
              { code: "OVERVIEW_SEASON_UNAVAILABLE" },
            );
            assert.equal(
              (await repo.summary(filters())).summary.income,
              "1881.10",
            );
          } finally {
            await pool.query(
              "ALTER TABLE financial_records ADD season_id BIGINT NULL",
            );
            await pool.query("UPDATE financial_records SET season_id=1");
          }
        },
      );
      await t.test(
        "income/expense exports contain all filtered records and reconciled summary, with formula-safe text",
        async () => {
          await pool.query(
            "UPDATE financial_records SET remarks='=HYPERLINK(1)' WHERE financial_record_id=12",
          );
          const bytes = await overviewExport(
            repo,
            filters({ pageSize: 1 }),
            "xlsx",
          );
          const zip = await JSZip.loadAsync(bytes);
          const sheets = await Promise.all(
            Object.keys(zip.files)
              .filter((k) => /^xl\/worksheets\/.*\.xml$/.test(k))
              .map((k) => zip.file(k)!.async("string")),
          );
          const text = sheets.join("");
          assert.match(text, /1881.10/);
          assert.match(text, /450.30/);
          assert.match(text, /FIN-29/);
          assert.match(text, /FIN-1</);
          assert.doesNotMatch(text, /<f[ >]/);
          assert.doesNotMatch(text, /FIN-8</);
          const originalRemarks =
            "Exact recorded remark " + "details ".repeat(100) + "END-OF-REMARK";
          await pool.execute(
            "UPDATE financial_records SET remarks=? WHERE financial_record_id=12",
            [originalRemarks],
          );
          const complete = await repo.activity(filters({ search: "FIN-12" }));
          assert.equal(complete.items[0].description, originalRemarks);
          const wrappedPdf = await overviewExport(
            repo,
            filters({ search: "FIN-12" }),
            "pdf",
          );
          assert.equal(wrappedPdf.subarray(0, 4).toString(), "%PDF");

          const pdf = await overviewExport(repo, filters(), "pdf");
          assert.equal(pdf.subarray(0, 4).toString(), "%PDF");
          assert.ok(pdf.length > 1000);
        },
      );
    } finally {
      await pool.end();
    }
  },
);
