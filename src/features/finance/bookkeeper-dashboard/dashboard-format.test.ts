import assert from "node:assert/strict";
import test from "node:test";
import {
  describeSurplusChange,
  formatCentavosPeso,
  formatManilaDate,
  formatManilaDateRange,
  formatManilaMonth,
  formatPercent,
  formatPeso,
  formatPesoSigned,
  parseCentavos,
} from "./dashboard-format";

test("parseCentavos and formatPeso preserve exact centavos without float drift", () => {
  assert.equal(parseCentavos("1000.50") + parseCentavos("2000.25"), 300075);
  assert.equal(formatCentavosPeso(300075), "₱3,000.75");
  assert.equal(formatPeso("0.00"), "₱0.00");
  assert.equal(formatPeso("-250.25"), "-₱250.25");
  assert.equal(formatPesoSigned("125.05"), "+₱125.05");
  assert.equal(formatPesoSigned("-125.05"), "-₱125.05");
  assert.equal(formatPesoSigned("0.00"), "₱0.00");
  assert.equal(formatPercent(null), "Not available");
  assert.equal(formatPercent("57.14"), "57.14%");
});

test("describeSurplusChange handles zero baseline, negative previous values, and sign changes", () => {
  const unavailable = describeSurplusChange(
    { available: false, percent: null, direction: null, absolute: "500.00", reason: "no-previous-value" },
    "500.00",
    "0.00",
    "Previous month",
  );
  assert.equal(unavailable.available, false);
  assert.equal(unavailable.headline, "Not available");
  assert.equal(unavailable.directionLabel, "Increased from ₱0.00");

  const turnaround = describeSurplusChange(
    { available: true, percent: "150.00", direction: "up", absolute: "150.00", reason: null },
    "50.00",
    "-100.00",
    "Previous month",
  );
  assert.equal(turnaround.headline, "+150.00%");
  assert.equal(turnaround.directionLabel, "Returned to surplus");
  assert.equal(turnaround.tone, "positive");

  const deeperDeficit = describeSurplusChange(
    { available: true, percent: "-100.00", direction: "down", absolute: "-100.00", reason: null },
    "-200.00",
    "-100.00",
    "Previous month",
  );
  assert.equal(deeperDeficit.directionLabel, "Deeper deficit");
  assert.equal(deeperDeficit.tone, "negative");
});

test("Manila date helpers format YYYY-MM-DD and YYYY-MM consistently", () => {
  assert.equal(formatManilaDateRange("2026-11-01", "2026-11-01"), formatManilaDate("2026-11-01"));
  assert.match(formatManilaDateRange("2026-11-01", "2026-11-04"), /Nov.*2026/);
  assert.match(formatManilaMonth("2026-11"), /Nov.*2026/);
});

