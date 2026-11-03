import assert from "node:assert/strict";
import test from "node:test";
import { readRentalStatusLink } from "./rentalStatusLink";

const params = (query: string) => new URLSearchParams(query);

test("an emailed link carries the booking reference and the signed token", () => {
  assert.deepEqual(readRentalStatusLink(params("booking=rnt-2026-0025&k=v1.1900000000.abc_DEF-123")), {
    reference: "RNT-2026-0025",
    token: "v1.1900000000.abc_DEF-123",
    check: false,
  });
});

test("a link without a token still opens the dialog with the reference", () => {
  assert.deepEqual(readRentalStatusLink(params("booking=RNT-2026-0025")), { reference: "RNT-2026-0025", token: undefined, check: false });
});

test("check opens an empty dialog", () => {
  assert.deepEqual(readRentalStatusLink(params("check=1")), { reference: "", token: undefined, check: true });
});

test("nothing opens without a usable reference or the check flag", () => {
  assert.equal(readRentalStatusLink(params("")), null);
  assert.equal(readRentalStatusLink(params("k=v1.1.abc")), null);
  assert.equal(readRentalStatusLink(params("booking=")), null);
  assert.equal(readRentalStatusLink(null), null);
});

test("a mangled reference is ignored and its token is never used", () => {
  assert.equal(readRentalStatusLink(params("booking=../../etc&k=v1.1.abc")), null);
  assert.equal(readRentalStatusLink(params("booking=%3Cscript%3E")), null);
  assert.deepEqual(readRentalStatusLink(params("booking=%3Cscript%3E&check=1")), { reference: "", token: undefined, check: true });
});
