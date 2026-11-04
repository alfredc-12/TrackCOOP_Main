import test from "node:test";
import assert from "node:assert/strict";
import { placePhoto, photoDateBucket } from "./gallery-draft";
import type { LibraryPhoto } from "./gallery-client";
const p = (id: string) => ({ id, eligible: true }) as LibraryPhoto;
test("moving an existing selection swaps slots and never duplicates it", () => {
  const a = p("gallery:1"),
    b = p("announcement:1");
  const original = [a, b, null, null, null, null, null];
  const n = placePhoto(original, a, 1);
  assert.equal(n[0], b);
  assert.equal(n[1], a);
  assert.equal(original[0], a);
});
test("time buckets use Manila day, calendar week and calendar month", () => {
  const now = new Date("2026-11-04T01:00:00Z");
  assert.equal(photoDateBucket("2026-11-03T17:00:00Z", now), "Today");
  assert.equal(photoDateBucket("2026-11-02T01:00:00Z", now), "This week");
  assert.equal(photoDateBucket("2026-11-01T01:00:00Z", now), "This month");
  assert.equal(photoDateBucket("2026-10-31T01:00:00Z", now), "Older");
});
