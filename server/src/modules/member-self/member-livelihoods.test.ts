import assert from "node:assert/strict";
import { test } from "node:test";
import { inspectStoredLivelihoods, readLivelihoods, validateLivelihoods } from "./member-livelihoods";

test("reads old profiles as empty livelihoods and supports JSON storage", () => {
  assert.deepEqual(readLivelihoods(null), []);
  const items = [{ activity: "Sugarcane", plantingDate: "2025-11-01" }, { activity: "Poultry" }, { activity: "Coconut growing" }];
  assert.deepEqual(readLivelihoods(JSON.stringify(items)), items);
  assert.deepEqual(readLivelihoods(items), items);
  assert.deepEqual(validateLivelihoods([]), []);
});

test("legacy names, empty optional dates and exact duplicates remain readable without a data rewrite", () => {
  const stored = ["Rice", { activity: " Poultry ", plantingDate: null }, { activity: "Rice", plantingDate: "" }];
  const original = JSON.stringify(stored);
  assert.deepEqual(inspectStoredLivelihoods(stored), { livelihoods: [{ activity: "Rice" }, { activity: "Poultry" }], issues: [] });
  assert.deepEqual(readLivelihoods(original), [{ activity: "Rice" }, { activity: "Poultry" }]);
  assert.equal(JSON.stringify(stored), original);
  assert.throws(() => validateLivelihoods(stored));
});

test("invalid entries retain other valid data and produce actionable review issues", () => {
  const stored = [
    { activity: "Sugarcane", plantingDate: "2020-01-01" },
    { activity: "Rice", plantingDate: "2099-01-01" },
    { activity: "" },
    { activity: "Poultry", legacyNotes: "Original notes" },
  ];
  const result = inspectStoredLivelihoods(stored);
  assert.deepEqual(result.livelihoods, [{ activity: "Sugarcane", plantingDate: "2020-01-01" }, { activity: "Rice" }, { activity: "Poultry" }]);
  assert.equal(result.issues.length, 3);
  assert.equal(stored[1].plantingDate, "2099-01-01");
});

test("conflicting crop cycles require review instead of selecting a planting date", () => {
  const result = inspectStoredLivelihoods([{ activity: "Rice", plantingDate: "2020-01-01" }, { activity: "rice", plantingDate: "2020-02-01" }]);
  assert.deepEqual(result.livelihoods, [{ activity: "Rice" }]);
  assert.ok(result.issues.some(issue => issue.includes("different sowing dates")));
  assert.throws(() => readLivelihoods("not-json"));
  assert.ok(inspectStoredLivelihoods({ activity: "Rice" }).issues.length);
});

test("rejects duplicate, excessive, malformed, and future-dated activities", () => {
  const invalid = [null, "Sugarcane", [{ activity: "" }], [{ activity: "x".repeat(81) }],
    [{ activity: "Rice" }, { activity: " rice " }], [{ activity: "Rice", plantingDate: "2099-01-01" }],
    [{ activity: "Corn", plantingDate: "2026-02-30" }], [{ activity: "Corn", plantingDate: "bad" }],
    [{ activity: "Poultry", injected: true }], Array.from({ length: 21 }, (_, index) => ({ activity: String(index) }))];
  for (const value of invalid) assert.throws(() => validateLivelihoods(value), /Check your crops and livelihoods/);
});
