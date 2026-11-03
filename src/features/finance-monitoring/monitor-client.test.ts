import assert from "node:assert/strict";
import test from "node:test";
import { peso } from "./monitor-client";

test("decimal money display preserves aggregate cents beyond Number precision", () => {
  assert.equal(peso("9007199254740993.07"), "₱9,007,199,254,740,993.07");
  assert.equal(peso("0.10"), "₱0.10");
  assert.equal(peso("-0.20"), "-₱0.20");
  assert.equal(peso(1500), "₱1,500.00");
  assert.equal(peso(null), "—");
});
