import assert from "node:assert/strict";
import test from "node:test";
import { hasLedgerFilters, listFinancialRecords, parseLedgerFilters } from "./finance-api";

test("ledger filters accept only well-formed drill-down values", () => {
  const filters = parseLedgerFilters({ startDate: "2026-10-01", endDate: "2026-10-31", financialCategoryIds: "3|x|4", sourceModules: "POS|Crypto|Share Capital", recordType: "Income", recordStatus: "Voided", posting: "unposted", search: " FIN-1 " });
  assert.deepEqual(filters, { startDate: "2026-10-01", endDate: "2026-10-31", financialCategoryIds: ["3", "4"], sourceModules: ["POS", "Share Capital"], recordType: "Income", recordStatus: "Voided", posting: "unposted", search: "FIN-1" });
});

test("malformed, reversed or injected values are dropped", () => {
  assert.deepEqual(parseLedgerFilters({ startDate: "2026-13-40", endDate: "tomorrow", recordType: "DROP", posting: "all", financialCategoryIds: "1; DROP" }), {});
  assert.deepEqual(parseLedgerFilters({ startDate: "2026-10-31", endDate: "2026-10-01" }), {}, "a reversed range is discarded rather than returning nothing");
  assert.deepEqual(parseLedgerFilters({ recordType: ["Income", "Expense"] }), { recordType: "Income" });
});

test("search alone is not a filter, so the ledger keeps its original paging behavior", () => {
  assert.equal(hasLedgerFilters({ search: "FIN" }), false);
  assert.equal(hasLedgerFilters({ posting: "posted" }), true);
});

test("requests carry filters to the API and the unfiltered request is unchanged", async t => {
  const urls: URL[] = [];
  t.mock.method(globalThis, "fetch", async (input: string) => {
    urls.push(new URL(input));
    return new Response(JSON.stringify({ success: true, data: [], meta: {} }), { status: 200, headers: { "Content-Type": "application/json" } });
  });
  await listFinancialRecords("abc");
  await listFinancialRecords("", { startDate: "2026-10-01", endDate: "2026-10-31", sourceModules: ["POS"], financialCategoryIds: ["3"], posting: "posted", recordType: "Income" });
  assert.deepEqual([urls[0].searchParams.get("pageSize"), urls[0].searchParams.get("sortBy"), urls[0].searchParams.get("search"), urls[0].searchParams.get("startDate")], ["50", "createdAt", "abc", null]);
  assert.deepEqual([urls[1].searchParams.get("pageSize"), urls[1].searchParams.get("sortBy"), urls[1].searchParams.get("startDate"), urls[1].searchParams.get("sourceModules"), urls[1].searchParams.get("financialCategoryIds"), urls[1].searchParams.get("posting"), urls[1].searchParams.get("recordType")], ["100", "recordDate", "2026-10-01", "POS", "3", "posted", "Income"]);
});
