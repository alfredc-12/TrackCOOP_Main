import assert from "node:assert/strict";
import test from "node:test";
import { analyticsMemberLink, analyticsParams, compareAnalyticsCells, defaultAnalyticsFilters, filtersFromParams, getAnalyticsMembers, getMemberAnalytics } from "./analytics-client";

test("analytics filter URL roundtrip and management deep-link preserve semantic selection", () => {
  const filters = { ...defaultAnalyticsFilters("2026-11-02"), sectors: ["Rice", "Fishery"], barangays: ["Mataas Na Pulo"], membershipType: "True Member" };
  assert.deepEqual(filtersFromParams(analyticsParams(filters), "2026-11-02"), filters);
  const url = new URL(analyticsMemberLink(filters, { kind: "barangay", value: "Aga", sector: "Rice" }), "https://example.invalid");
  assert.equal(url.pathname, "/portal/chairman/members"); assert.equal(url.searchParams.get("tab"), "directory"); assert.equal(url.searchParams.get("analytics"), "1");
  assert.equal(url.searchParams.get("cellSector"), "Rice");
});
test("supporting tables sort displayed currency and decimal percentages by value", () => {
  assert.ok(compareAnalyticsCells("₱1,000", "₱900") > 0);
  assert.ok(compareAnalyticsCells("12.05%", "12.5%") < 0);
  assert.ok(compareAnalyticsCells(-2, 1) < 0);
  assert.ok(compareAnalyticsCells("Barangay 2", "Barangay 10") < 0);
});
test("report and matching-directory requests retain /api prefix and original analytics membership filter", async t => {
  const urls: URL[] = [];
  t.mock.method(globalThis, "fetch", async (input: string, init?: RequestInit) => {
    const url = new URL(input); urls.push(url); assert.equal(init?.credentials, "include");
    return new Response(JSON.stringify({ success: true, data: url.pathname.endsWith("matching-members") ? [] : { population: 0 }, meta: { total: 0, page: 1, pageSize: 10 } }), { status: 200, headers: { "Content-Type": "application/json" } });
  });
  const filters = { ...defaultAnalyticsFilters("2026-11-02"), membershipType: "True Member" };
  await getMemberAnalytics(filters);
  await getAnalyticsMembers(analyticsParams(filters).toString(), { page: 1, pageSize: 10, membershipType: "All" });
  assert.equal(urls[0].pathname, "/api/chairman/member-analytics");
  assert.equal(urls[1].pathname, "/api/chairman/member-analytics/matching-members");
  assert.equal(urls[1].searchParams.get("membershipType"), "True Member");
  assert.equal(urls[1].searchParams.get("directoryMembershipType"), null);
  await getAnalyticsMembers(analyticsParams(filters).toString(), { page: 1, membershipType: "Associate" });
  assert.equal(urls[2].searchParams.get("membershipType"), "True Member");
  assert.equal(urls[2].searchParams.get("directoryMembershipType"), "Associate");
});
