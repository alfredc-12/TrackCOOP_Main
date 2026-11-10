import assert from "node:assert/strict";
import test from "node:test";
import JSZip from "jszip";
import { closePool, getPool } from "../../db/pool";
import { generateReport, getReportHomeData, reportToCsv, reportToPdf, reportToXlsx } from "./report-service";
import type { AuthorizedUser } from "./records-auth";

const user = { id: "1", numericId: 1, role: "bookkeeper", displayName: "Report verification" } as AuthorizedUser;
test.after(() => closePool());

test("progress preview uses normalized dates, preserves comparison basis in every export, and does not write", async (t) => {
  const queries: string[] = [];
  t.mock.method(getPool(), "query", async (sql: string) => {
    queries.push(sql); assert.match(sql, /^SELECT/);
    return [[{ metric: "Posted income", currentValue: "1200.00", previousValue: "1000.00", source: "Approved active ledger income" }], []];
  });
  t.mock.method(getPool(), "getConnection", () => { throw Error("Read-only progress must not open a write transaction"); });
  const result = await generateReport("cooperative-overview", { dateFrom: "2026-03-01", dateTo: "2026-03-31" }, user, { record: false });
  assert.equal(queries.length, 1);
  assert.equal(result.rows[0].changePercent, 20);
  assert.equal(result.rows[0].change, 200);
  assert.equal(result.summary[0].value, 1200);
  assert.ok(result.notes?.some((note) => note.includes("2026-01-29 to 2026-02-28")));
  assert.match(reportToCsv(result), /must not be added together/);
  const workbook = await JSZip.loadAsync(await reportToXlsx(result));
  assert.match(await workbook.file("xl/worksheets/sheet1.xml")!.async("string"), /must not be added together/);
  const pdf = await reportToPdf(result);
  assert.equal(pdf.subarray(0, 4).toString(), "%PDF");
});

test("new report generation authorizes roles before querying and rejects impossible dates", async (t) => {
  t.mock.method(getPool(), "query", () => { throw Error("Invalid requests must not access data"); });
  await assert.rejects(generateReport("cooperative-overview", {}, { ...user, role: "member" }, { record: false }), /permission/);
  await assert.rejects(generateReport("performance-trends", { dateFrom: "2026-02-30", dateTo: "2026-03-01" }, user, { record: false }), /valid start date/);
});

test("home loads actual history/options and counts only successfully generated reports within the role catalog", async (t) => {
  const queries: string[] = [];
  t.mock.method(getPool(), "query", async (sql: string) => {
    queries.push(sql);
    if (sql.includes("COUNT(*) AS total FROM reports")) return [[{ total: "7" }], []];
    if (sql.includes("SELECT DISTINCT provider")) return [[{ value: "Cash" }], []];
    if (sql.includes("FROM reports r")) return [[{ id: "1", reference: "RPT-001", reportKey: "cooperative-overview", title: "Cooperative Overview", category: "FINANCIAL", generatedAt: "2026-11-10", status: "Generated", filtersJson: '{"dateFrom":"2026-01-01"}' }], []];
    return [[], []];
  });
  const result = await getReportHomeData(user);
  assert.equal(result.generatedThisMonth, 7);
  assert.equal(result.recent[0].filters.dateFrom, "2026-01-01");
  assert.deepEqual(result.filterOptions.paymentMethods, ["Cash"]);
  assert.ok(queries.some((sql) => sql.includes("generation_status = 'Generated'")));
  assert.ok(queries.some((sql) => sql.includes("r.report_key IN (?)")));
});
