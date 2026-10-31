import assert from "node:assert/strict";
import { test } from "node:test";
import { readLivelihoods, validateLivelihoods } from "./member-livelihoods";

test("reads old profiles as empty livelihoods and supports JSON storage", () => {
  assert.deepEqual(readLivelihoods(null), []);
  const items = [{ activity: "Sugarcane", plantingDate: "2025-11-01" }, { activity: "Poultry" }, { activity: "Coconut growing" }];
  assert.deepEqual(readLivelihoods(JSON.stringify(items)), items);
  assert.deepEqual(readLivelihoods(items), items);
  assert.deepEqual(validateLivelihoods([]), []);
});

test("rejects duplicate, excessive, malformed, and future-dated activities", () => {
  const invalid = [null, "Sugarcane", [{ activity: "" }], [{ activity: "x".repeat(81) }],
    [{ activity: "Rice" }, { activity: " rice " }], [{ activity: "Rice", plantingDate: "2099-01-01" }],
    [{ activity: "Corn", plantingDate: "2026-02-30" }], [{ activity: "Corn", plantingDate: "bad" }],
    [{ activity: "Poultry", injected: true }], Array.from({ length: 21 }, (_, index) => ({ activity: String(index) }))];
  for (const value of invalid) assert.throws(() => validateLivelihoods(value), /Check your crops and livelihoods/);
});
