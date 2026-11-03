import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";
import express from "express";
import request from "supertest";
import { errorHandler } from "../../middleware/error-handler";
import type { EmailConfig } from "./email-config";
import { signReceiptToken } from "./email-crypto";
import { createPublicReceiptRouter } from "./public-receipt.routes";

const secretKey = randomBytes(32);
const now = new Date("2026-11-03T04:00:00Z");
const nowSeconds = Math.floor(now.getTime() / 1000);
const config = { secretKey } as EmailConfig;
const pdf = Buffer.from("%PDF-1.4 fake receipt");

function app(row: Record<string, unknown> | null, options: { readFile?: () => Promise<Buffer> } = {}) {
  const audit: unknown[][] = [];
  const pool = {
    async execute(sql: string, values: unknown[]) {
      if (sql.includes("audit_logs")) { audit.push(values); return [[], []]; }
      return [row ? [row] : [], []];
    },
  };
  const server = express();
  server.use("/api/public/receipts", createPublicReceiptRouter({ config, pool: pool as never, now: () => now, readFile: options.readFile ?? (async () => pdf) }));
  server.use((req, _res, next) => { req.requestId = "t"; next(); });
  server.use(errorHandler);
  return { server, audit };
}
const good = { receiptNumber: "PAY-RCPT-2026-000041", status: "Generated", reversedAt: null, filePath: "private/receipts/41.pdf", documentStatus: "Active" };
const link = (id = "41", expires = nowSeconds + 3600, key = secretKey) => `/api/public/receipts/${signReceiptToken(id, expires, key)}`;

test("a valid link streams the receipt PDF with private, no-store headers and leaves an audit entry without the token", async () => {
  const { server, audit } = app(good);
  const response = await request(server).get(link());
  assert.equal(response.status, 200);
  assert.equal(response.headers["content-type"], "application/pdf");
  assert.match(response.headers["content-disposition"], /attachment; filename="PAY-RCPT-2026-000041\.pdf"/);
  assert.equal(response.headers["cache-control"], "private, no-store");
  assert.equal(response.headers["referrer-policy"], "no-referrer");
  assert.equal(response.headers["x-robots-tag"], "noindex");
  assert.deepEqual(response.body, pdf);
  assert.equal(audit.length, 1);
  assert.equal(JSON.stringify(audit).includes("v1."), false);
});

test("expired, forged, retargeted or garbage links all get the same generic 404", async () => {
  const { server } = app(good);
  const expired = await request(server).get(link("41", nowSeconds - 1));
  const forged = await request(server).get(link("41", nowSeconds + 3600, randomBytes(32)));
  const garbage = await request(server).get("/api/public/receipts/not-a-token");
  for (const response of [expired, forged, garbage]) {
    assert.equal(response.status, 404);
    assert.equal(response.body.errors[0].code, "RECEIPT_LINK_INVALID");
  }
  assert.deepEqual(expired.body, forged.body);
});

test("a receipt that is missing, not generated, reversed or whose document is inactive is not served", async () => {
  for (const row of [null, { ...good, status: "Failed" }, { ...good, status: "Pending" }, { ...good, reversedAt: new Date() }, { ...good, documentStatus: "Archived" }]) {
    const response = await request(app(row).server).get(link());
    assert.equal(response.status, 404, JSON.stringify(row));
  }
});

test("a storage failure is reported as an error and never exposes the storage path", async () => {
  const { server } = app(good, { readFile: async () => { throw new Error("R2 bucket secret-bucket unreachable"); } });
  const response = await request(server).get(link());
  assert.ok(response.status >= 500);
  assert.equal(JSON.stringify(response.body).includes("secret-bucket"), false);
  assert.equal(JSON.stringify(response.body).includes("private/receipts"), false);
});
