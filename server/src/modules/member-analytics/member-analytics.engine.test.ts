import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createAnalyticsEngine } from "./member-analytics.engine";
import { analyticsFixture, fixtureFilters } from "./member-analytics.test-fixture";
import { endExclusive, localDate, normalizeBarangay, parseAnalyticsFilters } from "./member-analytics.filters";
import { NASUGBU_BARANGAYS } from "./nasugbu-barangays";
import { analyticsSheets, exportAnalyticsWorkbook } from "./member-analytics.export";
import JSZip from "jszip";

test("approved population uses actual approval, excludes pending and undated records; growth uses pre-period base", () => {
  const { result, matchingIds } = createAnalyticsEngine(analyticsFixture(), fixtureFilters);
  assert.equal(result.kpis.total, 5); assert.equal(result.kpis.newApprovals, 4); assert.equal(result.kpis.baseline, 1); assert.equal(result.kpis.growth, 400);
  assert.deepEqual(matchingIds({ kind: "new" }), ["2", "3", "4", "5"]);
  assert.equal(result.coverage.find(c => c.code === "UNDATED_APPROVAL")?.count, 1);
});
test("zero denominators are unavailable, not zero percent", () => {
  const { result } = createAnalyticsEngine(analyticsFixture(), { ...fixtureFilters, sectors: ["Fishery"] });
  assert.equal(result.kpis.growth, null); assert.equal(result.kpis.capitalCompletion, null);
});
test("Manila midnight, leap dates and invalid ranges are handled explicitly", () => {
  assert.equal(localDate("2026-01-01T16:00:00Z"), "2026-01-02");
  assert.equal(endExclusive("2026-01-01"), "2026-01-01T16:00:00.000Z");
  assert.throws(() => parseAnalyticsFilters({ start: "2026-02-30" }));
  assert.throws(() => parseAnalyticsFilters({ start: "2026-10-01", end: "2026-09-01" }));
  assert.throws(() => parseAnalyticsFilters({ asOf: "2999-01-01" }));
  assert.throws(() => parseAnalyticsFilters({ sectors: "Other" }));
});
test("multi-select primary-sector and normalized location filters drive every aggregate and matching IDs", () => {
  const source = analyticsFixture();
  const engine = createAnalyticsEngine(source, { ...fixtureFilters, sectors: ["Rice", "Corn"], barangays: ["Brgy. Aga"] });
  assert.equal(engine.result.population, 2); assert.equal(engine.result.sectors.reduce((n, s) => n + s.count, 0), 2);
  assert.equal(engine.result.geography.reduce((n, g) => n + g.totalMembers, 0), 2);
  assert.deepEqual(engine.matchingIds(), ["1", "2"]);
  assert.equal(normalizeBarangay("1 (Poblacion)"), normalizeBarangay("Barangay 1"));
  assert.equal(normalizeBarangay("Munting Indang"), normalizeBarangay("Munting Indan"));
});
test("90-day cohorts count distinct participants and exclude immature windows", () => {
  const { result } = createAnalyticsEngine(analyticsFixture(), fixtureFilters);
  assert.equal(result.kpis.mature90, 3); assert.equal(result.kpis.participated90, 1);
  assert.equal(result.kpis.participation90, 33.33);
  assert.equal(result.engagement.cohorts.find(c => c.month === "2026-10" && c.days === 90)?.rate, null);
});
test("capital uses posted credits minus reversal debits; Associates excluded from completion and attention is a union", () => {
  const { result, matchingIds } = createAnalyticsEngine(analyticsFixture(), fixtureFilters);
  assert.equal(result.capital.totalBalance, 11500); assert.equal(result.kpis.capitalCompletion, 100);
  assert.equal(result.kpis.eligibleCapital, 3); assert.equal(result.capital.deductions, 1000);
  assert.equal(result.kpis.attention, 1); assert.equal(result.kpis.overdueCapital, 1);
  assert.deepEqual(matchingIds({ kind: "attention" }), ["3"]);
  assert.equal(result.capital.stages.reduce((n, s) => n + s.count, 0), result.population);
});
test("no synthetic overdue deadline; mismatched account/missing ledger makes completion unknown", () => {
  const source = analyticsFixture(); source.members[2].deadline = null; source.accounts[0].balance = 9999;
  const { result } = createAnalyticsEngine(source, fixtureFilters);
  assert.equal(result.kpis.overdueCapital, 0); assert.equal(result.capital.unknown, 1); assert.equal(result.kpis.capitalCompletion, null);
  source.accounts[0].balance = 4000; source.capital = source.capital.filter(e => e.memberId !== "2");
  assert.equal(createAnalyticsEngine(source, fixtureFilters).result.capital.unknown, 1);
});
test("Not Yet Scored remains separate, and legacy/configuration-mismatched RFM histories are never compared", () => {
  const source = analyticsFixture(); const report = createAnalyticsEngine(source, fixtureFilters).result;
  assert.equal(report.engagement.distribution.find(d => d.name === "Not Yet Scored")?.count, 3);
  assert.equal(report.engagement.comparable, 1);
  source.indicators[1].fingerprint = null;
  assert.equal(createAnalyticsEngine(source, fixtureFilters).result.engagement.comparable, 0);
  source.indicators[1].fingerprint = "different-settings";
  assert.equal(createAnalyticsEngine(source, fixtureFilters).result.engagement.comparable, 0);
});
test("equivalent annual RFM bases compare across different month-end days without accepting six-month windows", () => {
  const source = analyticsFixture(); source.indicators[0].start = "2024-12-31"; source.indicators[0].end = "2025-12-31";
  assert.equal(createAnalyticsEngine(source, fixtureFilters).result.engagement.comparable, 1);
  source.indicators[0].start = "2025-06-30";
  assert.equal(createAnalyticsEngine(source, fixtureFilters).result.engagement.comparable, 0);
});
test("as-of filters exclude later RFM snapshots, future approvals and capital transactions", () => {
  const source = analyticsFixture();
  const { result } = createAnalyticsEngine(source, { ...fixtureFilters, end: "2026-01-31", asOf: "2026-01-31" });
  assert.equal(result.population, 2); assert.equal(result.capital.totalBalance, 5500);
  assert.equal(result.engagement.distribution.find(d => d.name === "Active")?.count, 0);
});
test("referral success requires approved linked member and validated payment evidence", () => {
  const source = analyticsFixture();
  assert.equal(createAnalyticsEngine(source, fixtureFilters).result.referrals.qualified, 1);
  source.validatedApplications = [];
  const result = createAnalyticsEngine(source, fixtureFilters).result;
  assert.equal(result.referrals.qualified, 0); assert.equal(result.referrals.missingEvidence, 1);
});
test("journey uses one submission cohort with explicit milestones and gaps, not unrelated status totals", () => {
  const source = analyticsFixture();
  const result = createAnalyticsEngine(source, fixtureFilters).result;
  assert.equal(result.recruitment.journeyCohort, 1);
  assert.equal(result.recruitment.journey.find(j => j.stage === "Approved")?.count, 1);
  assert.equal(result.recruitment.journey.find(j => j.stage === "Payment Confirmed")?.count, 0);
  assert.equal(result.recruitment.journey.find(j => j.stage === "Approved")?.medianDays, 9);
});
test("recruitment best periods include zero calendar months and resolve ties deterministically", () => {
  const result = createAnalyticsEngine(analyticsFixture(), fixtureFilters).result;
  assert.equal(result.recruitment.bestMonth?.month, "2026-01");
  assert.deepEqual(result.recruitment.bestQuarter, { start: "2026-01", end: "2026-03", count: 3 });
  assert.equal(result.recruitment.monthly.length, 10);
});
test("actual geometry names match all comparison rows, including zero-count barangays", () => {
  const geo = JSON.parse(readFileSync("src/lib/Nasugbu.geojson", "utf8"));
  assert.deepEqual([...NASUGBU_BARANGAYS].sort(), geo.features.map((f: { properties: { adm4_en: string } }) => f.properties.adm4_en).sort());
  assert.equal(createAnalyticsEngine(analyticsFixture(), fixtureFilters).result.geography.length, 42);
});
test("missing optional activity tables make participation rates unavailable and disclose coverage", () => {
  const source = analyticsFixture(); source.capabilities.cooperative_activities = false; source.participation = [];
  const result = createAnalyticsEngine(source, fixtureFilters).result;
  assert.equal(result.kpis.participation90, null);
  assert.ok(result.coverage.some(c => c.code === "MISSING_cooperative_activities"));
});
test("recorded deadlines partition confirmed obligations, with 30-day warning and no ordinary Associate obligation", () => {
  const source = analyticsFixture(); source.members[2].deadline = "2026-11-20"; source.members[3].deadline = "2026-01-01";
  const { result, matchingIds } = createAnalyticsEngine(source, fixtureFilters);
  assert.equal(result.capital.deadlineCategories.find(c => c.name === "Due within 30 days")?.count, 1);
  assert.equal(result.capital.deadlineCategories.reduce((n, c) => n + c.count, 0), 4);
  assert.deepEqual(matchingIds({ kind: "deadline", value: "Due within 30 days" }), ["3"]);
  assert.ok(result.insights.some(i => i.id === "deadlines"));
});
test("actual Approved application history supplies a missing approval date, never application creation", () => {
  const source = analyticsFixture(); source.members[2].approvedAt = null;
  assert.equal(createAnalyticsEngine(source, fixtureFilters).result.population, 5);
  source.applicationHistory = [];
  assert.equal(createAnalyticsEngine(source, fixtureFilters).result.population, 4);
});
test("interest and patronage transfers are separated from payment contributions without altering total balance", () => {
  const source = analyticsFixture();
  source.capital[4].paymentSource = "Patronage Refund";
  source.capital.push({ id: "7", memberId: "1", date: "2026-05-01", direction: "Credit", type: "Dividend Added to Capital", amount: 100, source: "interest", sourceId: null });
  source.accounts[0].balance = 4100;
  const result = createAnalyticsEngine(source, fixtureFilters).result;
  assert.equal(result.capital.totalBalance, 11600); assert.equal(result.capital.interest, 100);
  assert.equal(result.capital.otherCredits, 4000); assert.equal(result.capital.contributions, 4500);
});
test("above-maximum balances remain visible as exceptions; negative balances are unknown rather than positive-below-target", () => {
  const source = analyticsFixture(); source.capital[0].amount = 16000; source.accounts[0].balance = 16000;
  assert.equal(createAnalyticsEngine(source, fixtureFilters).result.capital.stages.find(s => s.name === "Above maximum")?.count, 1);
  source.capital[0].direction = "Debit"; source.accounts[0].balance = -16000;
  assert.equal(createAnalyticsEngine(source, fixtureFilters).result.capital.unknown, 1);
});
test("small recruitment samples do not produce a ranking insight, and unavailable attention is not a false zero", () => {
  const source = analyticsFixture();
  assert.ok(!createAnalyticsEngine(source, fixtureFilters).result.insights.some(i => i.id === "recruitment"));
  source.capabilities.member_status_indicators = false; source.indicators = [];
  assert.equal(createAnalyticsEngine(source, fixtureFilters).result.kpis.attention, null);
});
test("snapshot membership history is respected in semantic filtering and period matrix change", () => {
  const source = analyticsFixture(); source.statusHistory = [{ memberId: "1", at: "2025-03-01T01:00:00Z", membershipType: "Associate", officialStatus: "Active" }, { memberId: "1", at: "2026-10-01T01:00:00Z", membershipType: "True Member", officialStatus: "Active" }];
  const result = createAnalyticsEngine(source, { ...fixtureFilters, asOf: "2026-01-31", end: "2026-01-31", membershipType: "True Member" }).result;
  assert.equal(result.population, 1);
  assert.equal(result.geography.find(g => g.barangay === "Aga")?.cells.find(c => c.sector === "Corn")?.periodChange, 1);
});
test("status transitions within the same timestamp use the latest history ID", () => {
  const source = analyticsFixture();
  source.statusHistory = [
    { id: "10", memberId: "1", at: "2025-03-01T01:00:00Z", membershipType: "Associate", officialStatus: "Active" },
    { id: "11", memberId: "1", at: "2025-03-01T01:00:00Z", membershipType: "True Member", officialStatus: "Active" },
  ];
  assert.equal(createAnalyticsEngine(source, { ...fixtureFilters, membershipType: "True Member" }).result.population, 3);
});
test("Excel export contains all filtered aggregate rows plus context/definitions, with safe string cells", async () => {
  const result = createAnalyticsEngine(analyticsFixture(), fixtureFilters).result;
  const sheets = analyticsSheets(result);
  assert.equal(sheets.find(s => s.name === "Barangays and sectors")?.rows.length, 253);
  result.coverage.push({ code: "TEST", message: '=HYPERLINK("bad") <&>' });
  const zip = await JSZip.loadAsync(await exportAnalyticsWorkbook(result));
  assert.ok(zip.file("xl/workbook.xml"));
  const first = await zip.file("xl/worksheets/sheet1.xml")!.async("string");
  assert.match(first, /t="inlineStr"/); assert.match(first, /&lt;&amp;&gt;/); assert.doesNotMatch(first, /<f>/);
});
