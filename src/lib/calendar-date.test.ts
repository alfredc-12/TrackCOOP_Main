import assert from "node:assert/strict";
import { test } from "node:test";
import { calendarDateInMonth } from "./calendar-date";

test("keeps day 18 across month and year changes", () => {
  assert.equal(calendarDateInMonth(2024, 1, 18), "2024-02-18");
  assert.equal(calendarDateInMonth(2024, 2, 18), "2024-03-18");
  assert.equal(calendarDateInMonth(2025, 2, 18), "2025-03-18");
});

test("uses valid days in short and leap months without losing the preferred day", () => {
  assert.equal(calendarDateInMonth(2024, 1, 31), "2024-02-29");
  assert.equal(calendarDateInMonth(2023, 1, 31), "2023-02-28");
  assert.equal(calendarDateInMonth(2024, 3, 31), "2024-04-30");
  assert.equal(calendarDateInMonth(2024, 2, 31), "2024-03-31");
});

test("normalizes previous/next month navigation across year boundaries", () => {
  assert.equal(calendarDateInMonth(2024, -1, 18), "2023-12-18");
  assert.equal(calendarDateInMonth(2024, 12, 18), "2025-01-18");
});

test("honors minimum and maximum selectable dates", () => {
  const min = "2024-02-20";
  const max = "2024-04-10";
  assert.equal(calendarDateInMonth(2024, 1, 18, min, max), min);
  assert.equal(calendarDateInMonth(2024, 3, 18, min, max), max);
  assert.equal(calendarDateInMonth(2025, 3, 18, min, max), max);
  assert.equal(calendarDateInMonth(2024, 2, 18, min, max), "2024-03-18");
});
