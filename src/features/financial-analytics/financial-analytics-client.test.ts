import assert from "node:assert/strict";
import test from "node:test";
import {
  activeChips, compareCells, defaultFinancialFilters, downloadFinancialAnalytics, filtersFromParams, filtersToParams, getFinancialAnalytics, getFinancialMatrix,
  getFinancialPeriod, integrityLedgerLink, ledgerLink, ledgerSearchLink, peso, percent, signedPeso, signedPercent, validateFilters,
  type FinancialFilters, type IntegrityIssue,
} from "./financial-analytics-client";

const today = "2026-11-02";
const base = defaultFinancialFilters();

test("default filters produce a clean URL and every filter survives a round trip", () => {
  assert.equal(filtersToParams(base).toString(), "");
  const filters: FinancialFilters = { ...base, period: "custom", start: "2026-03-01", end: "2026-03-31", compare: "custom", compareStart: "2025-03-01", compareEnd: "2025-03-31", recordType: "Expense", categoryIds: ["4", "9"], sourceModules: ["POS", "Rental"], minAmount: "100", maxAmount: "9999.5", reference: "FIN-2026", granularity: "weekly" };
  assert.deepEqual(filtersFromParams(filtersToParams(filters)), filters);
});

test("untrusted URL values fall back instead of reaching the API", () => {
  const parsed = filtersFromParams(new URLSearchParams("period=forever&compare=x&recordType=Adjustment&categories=1|abc|2;drop&sources=POS|Crypto&granularity=hourly"));
  assert.deepEqual([parsed.period, parsed.compare, parsed.recordType, parsed.categoryIds, parsed.sourceModules, parsed.granularity], ["this-year", "previous", "all", ["1"], ["POS"], "auto"]);
});

test("validation explains the first problem and accepts a coherent draft", () => {
  assert.equal(validateFilters(base, today), "");
  assert.match(validateFilters({ ...base, period: "custom", start: "2026-03-01", end: "" }, today), /both a start and an end/);
  assert.match(validateFilters({ ...base, period: "custom", start: "2026-04-01", end: "2026-03-01" }, today), /on or before the end/);
  assert.match(validateFilters({ ...base, period: "custom", start: "2026-04-01", end: "2026-12-01" }, today), /Future dates/);
  assert.match(validateFilters({ ...base, compare: "custom", compareStart: "2025-01-01" }, today), /comparison start and end/);
  assert.match(validateFilters({ ...base, minAmount: "10", maxAmount: "5" }, today), /minimum amount/);
  assert.match(validateFilters({ ...base, minAmount: "-1" }, today), /zero or greater/);
});

test("active chips can each be removed individually and hide default values", () => {
  const filters: FinancialFilters = { ...base, recordType: "Income", categoryIds: ["3", "4"], sourceModules: ["POS"], minAmount: "50" };
  const chips = activeChips(filters, id => `Cat ${id}`);
  assert.deepEqual(chips.map(chip => chip.label), ["Type: Income", "Category: Cat 3", "Category: Cat 4", "Source: POS", "Min ₱50.00"]);
  assert.deepEqual({ ...filters, ...chips[1].clear }.categoryIds, ["4"]);
  assert.equal(activeChips(base, String).length, 0);
});

test("peso, percentage and signed formatting never invent values for missing data", () => {
  assert.equal(peso(1234.5), "₱1,234.50");
  assert.equal(peso(-50), "−₱50.00");
  assert.equal(peso(null), "N/A");
  assert.equal(percent(null), "N/A");
  assert.equal(percent(12.34), "12.3%");
  assert.equal(signedPeso(-5), "−₱5.00");
  assert.equal(signedPeso(0), "₱0.00");
  assert.equal(signedPercent(4), "+4%");
  assert.equal(signedPercent(null), "N/A");
});

test("table cells sort by explicit keys, numerically, with N/A last", () => {
  assert.ok(compareCells({ sort: 1000, node: "₱1,000" }, { sort: 900, node: "₱900" }) > 0);
  assert.ok(compareCells({ sort: -2, node: "−₱2" }, { sort: 1, node: "₱1" }) < 0);
  assert.ok(compareCells("Barangay 2", "Barangay 10") < 0);
  assert.ok(compareCells(null, 5) > 0);
  assert.ok(compareCells(5, null) < 0);
});

test("ledger links keep the analytics window and filters and are safe to parse", () => {
  const report = { filters: { start: "2026-10-01", end: "2026-10-31", categoryIds: ["3"], sourceModules: ["POS"], recordType: "Income" } } as Parameters<typeof ledgerLink>[0];
  const url = new URL(ledgerLink(report), "https://example.invalid");
  assert.equal(url.pathname, "/portal/chairman/financial-ledger");
  assert.deepEqual([url.searchParams.get("startDate"), url.searchParams.get("endDate"), url.searchParams.get("financialCategoryIds"), url.searchParams.get("sourceModules"), url.searchParams.get("recordType"), url.searchParams.get("from")], ["2026-10-01", "2026-10-31", "3", "POS", "Income", "analytics"]);
  const cell = new URL(ledgerLink(report, { financialCategoryIds: "7", sourceModules: "Rental", recordType: undefined }, { from: "2026-10-10", to: "2026-10-12" }), "https://example.invalid");
  assert.deepEqual([cell.searchParams.get("startDate"), cell.searchParams.get("endDate"), cell.searchParams.get("financialCategoryIds"), cell.searchParams.get("sourceModules"), cell.searchParams.get("recordType")], ["2026-10-10", "2026-10-12", "7", "Rental", null]);
  assert.equal(new URL(ledgerSearchLink(" FIN-2026-000317 "), "https://example.invalid").searchParams.get("search"), "FIN-2026-000317");
});

test("integrity links open the ledger with the exact rule filter or the payment validation page", () => {
  const issue = (href: string, ledgerQuery: Record<string, string> | null) => ({ link: { href, label: "Open" }, ledgerQuery }) as unknown as IntegrityIssue;
  const unposted = new URL(integrityLedgerLink(issue("/portal/chairman/financial-ledger", { startDate: "2026-10-01", endDate: "2026-10-31", posting: "unposted" }))!, "https://example.invalid");
  assert.equal(unposted.searchParams.get("posting"), "unposted");
  assert.equal(integrityLedgerLink(issue("/portal/chairman/payments", null)), "/portal/chairman/payments");
  assert.equal(integrityLedgerLink({ link: null, ledgerQuery: null } as unknown as IntegrityIssue), null);
});

test("API requests keep the /api prefix, credentials and filter parameters", async t => {
  const urls: URL[] = [];
  t.mock.method(globalThis, "fetch", async (input: string, init?: RequestInit) => {
    const url = new URL(input); urls.push(url); assert.equal(init?.credentials, "include");
    if (url.pathname.endsWith("/export")) return new Response("PK", { status: 200 });
    return new Response(JSON.stringify({ success: true, data: {}, meta: {} }), { status: 200, headers: { "Content-Type": "application/json" } });
  });
  const filters: FinancialFilters = { ...base, period: "last-month", categoryIds: ["3"] };
  await getFinancialAnalytics(filters);
  await getFinancialMatrix(filters);
  await getFinancialPeriod(filters, "2026-10-01", "2026-10-31");
  assert.deepEqual(urls.map(url => url.pathname), ["/api/chairman/financial-analytics", "/api/chairman/financial-analytics/matrix", "/api/chairman/financial-analytics/period"]);
  assert.equal(urls[0].searchParams.get("period"), "last-month");
  assert.equal(urls[0].searchParams.get("categories"), "3");
  assert.deepEqual([urls[2].searchParams.get("from"), urls[2].searchParams.get("to")], ["2026-10-01", "2026-10-31"]);
});

test("export failures surface a readable message instead of saving an error page", async t => {
  t.mock.method(globalThis, "fetch", async () => new Response("denied", { status: 403 }));
  await assert.rejects(downloadFinancialAnalytics(base), /could not be created/);
});
