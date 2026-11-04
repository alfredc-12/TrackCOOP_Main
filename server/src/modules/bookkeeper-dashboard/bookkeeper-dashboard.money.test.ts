import assert from "node:assert/strict";
import test from "node:test";
import { formatCentavos, percentChange, sharePercent, toCentavos } from "./bookkeeper-dashboard.money";

test("DECIMAL strings convert to exact centavos without float drift", () => {
  assert.equal(toCentavos("0.10") + toCentavos("0.20"), 30);
  assert.equal(toCentavos("1234567890.05"), 123456789005);
  assert.equal(toCentavos("-12.5"), -1250);
  assert.equal(toCentavos(null), 0);
  assert.equal(toCentavos("abc"), 0);
  assert.equal(toCentavos("1.005"), 101); // third decimal rounds half up
  assert.equal(toCentavos(19.99), 1999);
});

test("centavos format as fixed two-decimal pesos including negatives and zero", () => {
  assert.equal(formatCentavos(0), "0.00");
  assert.equal(formatCentavos(5), "0.05");
  assert.equal(formatCentavos(-5), "-0.05");
  assert.equal(formatCentavos(123456), "1234.56");
});

test("share percent is exact, rounded to two decimals, and unavailable without a positive total", () => {
  assert.equal(sharePercent(1, 3), "33.33");
  assert.equal(sharePercent(2, 3), "66.67");
  assert.equal(sharePercent(0, 100), "0.00");
  assert.equal(sharePercent(10, 0), null);
  const parts = [100050, 200025, 50000];
  const total = parts.reduce((a, b) => a + b, 0);
  assert.equal(parts.map((p) => sharePercent(p, total)).join(","), "28.58,57.14,14.28");
});

test("percentage change handles zero, negative previous values and sign changes", () => {
  assert.deepEqual(percentChange(15000, 10000), { available: true, percent: "50.00", direction: "up", absolute: "50.00", reason: null });
  assert.equal(percentChange(5000, 10000).percent, "-50.00");
  assert.equal(percentChange(5000, 10000).direction, "down");
  // Previous deficit of 100 improving to a surplus of 50: (50 - -100) / |-100| = +150%
  assert.equal(percentChange(5000, -10000).percent, "150.00");
  // Deficit that deepens: (-200 - -100) / 100 = -100%
  assert.equal(percentChange(-20000, -10000).percent, "-100.00");
  const zero = percentChange(5000, 0);
  assert.equal(zero.available, false);
  assert.equal(zero.percent, null);
  assert.equal(zero.reason, "no-previous-value");
  assert.equal(zero.absolute, "50.00");
  assert.equal(percentChange(0, 0).direction, "flat");
  assert.equal(percentChange(10000, 10000).percent, "0.00");
});
