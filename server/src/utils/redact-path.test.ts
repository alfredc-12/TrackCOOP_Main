import assert from "node:assert/strict";
import test from "node:test";
import { redactPath } from "./redact-path";

test("receipt tokens never appear in a logged path", () => {
  assert.equal(redactPath("/api/public/receipts/v1.41.1793682000.abcDEF_-123"), "/api/public/receipts/[redacted]");
  assert.equal(redactPath("/api/public/receipts/v1.41.1.sig?download=1"), "/api/public/receipts/[redacted]?download=1");
});

test("other paths are left alone", () => {
  assert.equal(redactPath("/api/rental/inquiries"), "/api/rental/inquiries");
});
