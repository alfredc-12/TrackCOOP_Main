import assert from "node:assert/strict";
import test from "node:test";
import { attentionSignal, completionSignal, growthSignal, statusTone } from "./analytics-signals";

test("missing results and unscored members stay neutral rather than implying failure or completion", () => {
  assert.equal(completionSignal(null).tone, "neutral");
  assert.equal(growthSignal(null).tone, "neutral");
  assert.equal(attentionSignal(null, 0, 0).tone, "neutral");
  assert.equal(statusTone("Not Yet Scored"), "neutral");
  assert.equal(statusTone("Unknown ledger"), "neutral");
});

test("attention distinguishes recorded overdue/inactive signals from monitoring and a clear count", () => {
  assert.equal(attentionSignal(2, 1, 0).tone, "danger");
  assert.equal(attentionSignal(2, 0, 1).tone, "danger");
  assert.equal(attentionSignal(2, 0, 0).tone, "warning");
  assert.equal(attentionSignal(0, 0, 0).tone, "good");
  assert.equal(statusTone("Above maximum"), "danger");
  assert.equal(statusTone("Below required"), "warning");
});

test("rate presentation uses complete versus partial records without inventing performance thresholds", () => {
  assert.equal(completionSignal(100).tone, "good");
  assert.equal(completionSignal(99).tone, "warning");
  assert.equal(completionSignal(1).tone, "warning");
  assert.equal(growthSignal(-1).tone, "danger");
  assert.equal(growthSignal(0).tone, "neutral");
  assert.equal(growthSignal(1).tone, "good");
});
