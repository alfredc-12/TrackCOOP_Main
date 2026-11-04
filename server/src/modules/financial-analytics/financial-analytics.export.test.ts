import assert from "node:assert/strict";
import test from "node:test";
import JSZip from "jszip";
import { buildWorkbook, matrixSheets, periodSheets, reportSheets, safeCell } from "./financial-analytics.export";
import { createFinancialAnalyticsEngine } from "./financial-analytics.engine";
import { fixtureFilters, fixtureSources } from "./financial-analytics.test-fixture";

const engine = () => createFinancialAnalyticsEngine(fixtureSources(), fixtureFilters(), new Date("2026-11-02T01:00:00Z"));

test("cells that could start a formula are neutralized and non-finite numbers become N/A", () => {
  for (const text of ["=SUM(A1)", "+1+1", "-2+3", "@cmd", "\t=1"]) assert.equal(safeCell(text), `'${text}`);
  assert.equal(safeCell("Plain"), "Plain");
  assert.equal(safeCell(12.5), 12.5);
  assert.equal(safeCell(Number.NaN), "N/A");
  assert.equal(safeCell(null), "N/A");
});

test("workbook is a real OOXML zip with escaped inline strings and 31-character sheet names", async () => {
  const buffer = await buildWorkbook([{ name: "A very long sheet name that exceeds thirty one characters / [x]", rows: [["<b>&", '=HYPERLINK("x")', 1.25]] }]);
  assert.equal(buffer.subarray(0, 2).toString(), "PK");
  const zip = await JSZip.loadAsync(buffer);
  const sheet = await zip.file("xl/worksheets/sheet1.xml")!.async("string");
  assert.match(sheet, /&lt;b&gt;&amp;/);
  assert.match(sheet, /&apos;=HYPERLINK/);
  assert.doesNotMatch(sheet, /<f>/);
  const workbook = await zip.file("xl/workbook.xml")!.async("string");
  assert.ok(/name="([^"]+)"/.exec(workbook)![1].length <= 31);
});

test("summary workbook carries context, definitions, comparison, reconciliation and totals that match the report", () => {
  const { result, matrix } = engine();
  const sheets = reportSheets(result, { income: matrix("Income"), expense: matrix("Expense") });
  assert.deepEqual(sheets.map(s => s.name), ["Report context", "Financial Analytics Summary", "Income by Source", "Income by Category", "Expense by Category", "Net Surplus Comparison", "Performance Trend", "Income matrix", "Expense matrix", "Financial Seasonality", "Financial Record Integrity", "Insights"]);
  const context = sheets[0].rows.flat().join("|");
  for (const expected of ["Generated (UTC)", "2026-10-01 to 2026-10-31", "2026-09-01 to 2026-09-30", "Recorded Net Surplus", "Not an official CDA financial statement"]) assert.ok(context.includes(expected), expected);
  const summary = sheets[1].rows;
  assert.deepEqual(summary[1].slice(0, 3), ["Recorded Operating Income", 15000, 15000]);
  assert.deepEqual(summary[3].slice(0, 4), ["Recorded Net Surplus (indicative)", 10500, 10000, 500]);
  assert.deepEqual(sheets[2].rows.at(-1), ["Difference", 0], "source rows reconcile to eligible income");
  const bridge = sheets[5].rows.find(row => row[0] === "Reconciliation")!;
  assert.equal(bridge[2], bridge[3]);
});

test("matrix and period exports reuse the same context", () => {
  const { result, matrix, periodDetail } = engine();
  assert.equal(matrixSheets(result, { income: matrix("Income"), expense: matrix("Expense") }).length, 3);
  const period = periodSheets(result, periodDetail({ from: "2026-10-01", to: "2026-10-31" }));
  assert.equal(period[1].rows.find(row => row[0] === "Net surplus")![1], 10500);
});
