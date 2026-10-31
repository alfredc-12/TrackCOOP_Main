import assert from "node:assert/strict";
import { test } from "node:test";
import { getSeasonGuide, isValidPlantingDate, manilaDateKey } from "./livelihoods";

test("uses Philippine dates and rejects invalid or future sowing dates", () => {
  assert.equal(manilaDateKey(new Date("2026-10-30T16:30:00Z")), "2026-10-31");
  assert.equal(isValidPlantingDate("2026-02-30", "2026-10-31"), false);
  assert.equal(isValidPlantingDate("2026-11-01", "2026-10-31"), false);
  assert.equal(isValidPlantingDate("2024-02-29", "2026-10-31"), true);
});

test("Batangas sugarcane guidance is historical and does not confirm the current harvest", () => {
  const guide = getSeasonGuide({ activity: "Sugarcane" }, "Batangas", "2026-10-31");
  assert.equal(guide.stage, "Typical harvest / milling period");
  assert.match(guide.basis, /not this year's confirmed dates/);
  assert.equal(guide.sources.length, 3);
  assert.equal(getSeasonGuide({ activity: "Sugarcane" }, "Batangas", "2026-07-01").stage, "Outside the broad milling guide");
  assert.equal(getSeasonGuide({ activity: "Sugarcane" }, "Cebu", "2026-10-31").stage, "Add a planting date");
});

test("planting dates override typical calendar windows and old crops need date review", () => {
  assert.equal(getSeasonGuide({ activity: "Sugarcane", plantingDate: "2026-10-01" }, "Batangas", "2026-10-31").stage, "Growing period — estimate");
  assert.equal(getSeasonGuide({ activity: "Sugarcane", plantingDate: "2025-11-01" }, "Batangas", "2026-10-31").stage, "Possible harvest window");
  assert.equal(getSeasonGuide({ activity: "Corn", plantingDate: "2026-01-01" }, "Batangas", "2026-10-31").stage, "Review your crop dates");
});

test("grain corn and rice windows are estimates rather than a guaranteed harvest", () => {
  const corn = getSeasonGuide({ activity: "Corn", plantingDate: "2026-07-23" }, "Batangas", "2026-10-31");
  assert.equal(corn.stage, "Possible harvest window");
  assert.match(corn.basis, /sweet and baby corn differ/);
  const rice = getSeasonGuide({ activity: "Rice", plantingDate: "2026-07-23" }, "Batangas", "2026-10-31");
  assert.equal(rice.stage, "Possible harvest window");
  assert.match(rice.basis, /not all/);
});

test("unknown dates and non-crop activities do not invent a local harvest season", () => {
  assert.equal(getSeasonGuide({ activity: "Rice" }, "Batangas", "2026-10-31").stage, "Add a planting date");
  assert.equal(getSeasonGuide({ activity: "Poultry" }, "Batangas", "2026-10-31").stage, "Your production cycle");
  assert.equal(getSeasonGuide({ activity: "Vegetables", plantingDate: "2026-08-01" }, "Batangas", "2026-10-31").stage, "Check your crop variety");
});
