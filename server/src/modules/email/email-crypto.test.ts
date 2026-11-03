import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";
import { decryptSecret, encryptSecret, signReceiptToken, verifyReceiptToken } from "./email-crypto";

const key = randomBytes(32);
const otherKey = randomBytes(32);

test("a secret survives encryption and is not readable in the stored blob", () => {
  const blob = encryptSecret(JSON.stringify({ activationUrl: "https://example.test/activate/abc123" }), key, "dedupe-1");
  assert.equal(blob.includes(Buffer.from("activate")), false);
  assert.equal(blob.includes(Buffer.from("abc123")), false);
  assert.deepEqual(JSON.parse(decryptSecret(blob, key, "dedupe-1")), { activationUrl: "https://example.test/activate/abc123" });
});

test("two encryptions of the same secret differ (fresh nonce each time)", () => {
  assert.notDeepEqual(encryptSecret("same", key, "k"), encryptSecret("same", key, "k"));
});

test("a blob cannot be read with another key, moved to another row, or altered", () => {
  const blob = encryptSecret("secret", key, "row-1");
  assert.throws(() => decryptSecret(blob, otherKey, "row-1"));
  assert.throws(() => decryptSecret(blob, key, "row-2"));
  const tampered = Buffer.from(blob);
  tampered[tampered.length - 1] ^= 1;
  assert.throws(() => decryptSecret(tampered, key, "row-1"));
  assert.throws(() => decryptSecret(Buffer.alloc(5), key, "row-1"));
});

test("a receipt link verifies for its receipt until it expires", () => {
  const now = 1_800_000_000;
  const token = signReceiptToken("42", now + 3600, key);
  assert.deepEqual(verifyReceiptToken(token, key, now), { receiptId: "42" });
  assert.equal(verifyReceiptToken(token, key, now + 3600), null);
  assert.equal(verifyReceiptToken(token, key, now + 7200), null);
});

test("a receipt link cannot be forged, retargeted, extended or signed with another key", () => {
  const now = 1_800_000_000;
  const token = signReceiptToken("42", now + 3600, key);
  const [version, id, expires, signature] = token.split(".");
  assert.equal(verifyReceiptToken(`${version}.43.${expires}.${signature}`, key, now), null);
  assert.equal(verifyReceiptToken(`${version}.${id}.${Number(expires) + 86400}.${signature}`, key, now), null);
  assert.equal(verifyReceiptToken(token, otherKey, now), null);
  assert.equal(verifyReceiptToken(`${version}.${id}.${expires}.AAAA`, key, now), null);
  for (const junk of ["", "v1", "v1.1.2", "v2.42.9999999999.x", "a.b.c.d", `${token}.extra`, "../../etc/passwd"]) {
    assert.equal(verifyReceiptToken(junk, key, now), null, junk);
  }
});

test("a link does not carry anything but the receipt id and its expiry", () => {
  const token = signReceiptToken("7", 1_800_003_600, key);
  assert.match(token, /^v1\.7\.1800003600\.[A-Za-z0-9_-]+$/);
});
