import assert from "node:assert/strict";
import test, { before, after } from "node:test";
import express from "express";
import cookieParser from "cookie-parser";
import request from "supertest";
import JSZip from "jszip";
import { createFinancialAnalyticsRouter } from "./financial-analytics.routes";
import { createFinancialAnalyticsService } from "./financial-analytics.service";
import { fixtureSources } from "./financial-analytics.test-fixture";
import type { AuthService } from "../auth/auth.service";
import type { AuthContext } from "../auth/auth.types";
import { errorHandler } from "../../middleware/error-handler";
import { AppError } from "../../utils/app-error";

// The fixture expectations use November 2; freeze the request parser's clock too.
before(() => test.mock.timers.enable({ apis: ["Date"], now: new Date("2026-11-02T01:00:00Z") }));
after(() => test.mock.timers.reset());

function setup(role = "chairman") {
  let loads = 0;
  const auth = { async authenticate(token: string) {
    if (!token) throw new AppError("Authentication required", 401, "UNAUTHENTICATED");
    return { user: { id: "1", displayName: "Analytics Test", role }, sessionId: "test", tokenHash: "test" } as AuthContext;
  } } as AuthService;
  const service = createFinancialAnalyticsService({ async firstRecordDate() { return "2026-09-05"; }, async load() { loads++; return fixtureSources(); } }, () => new Date("2026-11-02T01:00:00Z"));
  const app = express().use(cookieParser()).use("/api", createFinancialAnalyticsRouter(auth, service)).use(errorHandler);
  return { app, loads: () => loads };
}
const cookie = ["Cookie", "trackcoop_session=test"] as const;
const query = "period=custom&start=2026-10-01&end=2026-10-31&compare=custom&compareStart=2026-09-01&compareEnd=2026-09-30&granularity=monthly";
const paths = ["", "/matrix", "/period?from=2026-10-01&to=2026-10-31&", "/export"];
const url = (path: string) => `/api/chairman/financial-analytics${path}${path.includes("?") ? "" : "?"}${query}`;

test("anonymous requests are rejected before any data is read", async () => {
  const s = setup();
  for (const path of paths) assert.equal((await request(s.app).get(url(path))).status, 401, path);
  assert.equal(s.loads(), 0);
});

for (const role of ["bookkeeper", "member"]) test(`${role} cannot read chairman financial analytics or exports`, async () => {
  const s = setup(role);
  for (const path of paths) assert.equal((await request(s.app).get(url(path)).set(...cookie)).status, 403, path);
  assert.equal(s.loads(), 0);
});

test("chairman receives a private, typed, reconciled report", async () => {
  const s = setup();
  const response = await request(s.app).get(url("")).set(...cookie);
  assert.equal(response.status, 200);
  assert.equal(response.headers["cache-control"], "private, no-store");
  const data = response.body.data;
  assert.deepEqual([data.overview.income, data.overview.expenses, data.overview.net], [15000, 4500, 10500]);
  assert.equal(data.netSurplusBridge.available, true);
  assert.equal(data.filters.asOf, "2026-11-02");
  assert.equal(JSON.stringify(data).includes("approved_by"), false);
});

test("matrix endpoint returns both classifications that reconcile", async () => {
  const response = await request(setup().app).get(url("/matrix")).set(...cookie);
  assert.equal(response.status, 200);
  assert.deepEqual([response.body.data.income.total, response.body.data.expense.total], [15000, 4500]);
});

test("period endpoint validates its window", async () => {
  const s = setup();
  const ok = await request(s.app).get(url("/period?from=2026-10-01&to=2026-10-15&")).set(...cookie);
  assert.equal(ok.status, 200);
  assert.equal(ok.body.data.income, 15000);
  for (const bad of ["from=2026-10-15&to=2026-10-01", "from=2026-13-01&to=2026-13-02", "from=2026-10-01&to=2027-01-01", "from=2026-10-01"]) {
    assert.equal((await request(s.app).get(url(`/period?${bad}&`)).set(...cookie)).status, 400, bad);
  }
});

test("invalid filters fail validation without data access", async () => {
  const s = setup();
  for (const bad of ["period=custom&start=2026-11-01&end=2026-01-01", "sources=Share%20Capital", "categories=abc", "recordType=Adjustment"]) {
    assert.equal((await request(s.app).get(`/api/chairman/financial-analytics?${bad}`).set(...cookie)).status, 400, bad);
  }
  assert.equal(s.loads(), 0);
});

for (const scope of ["full", "matrix", "period"]) test(`${scope} workbook export is a private OOXML download`, async () => {
  const extra = scope === "period" ? "&from=2026-10-01&to=2026-10-31" : "";
  const response = await request(setup().app).get(`${url("/export")}&scope=${scope}${extra}`).set(...cookie).buffer(true)
    .parse((res, callback) => { const chunks: Buffer[] = []; res.on("data", chunk => chunks.push(Buffer.from(chunk))); res.on("end", () => callback(null, Buffer.concat(chunks))); });
  assert.equal(response.status, 200);
  assert.match(response.headers["content-disposition"], new RegExp(`financial-analytics-${scope}-2026-11-02\\.xlsx`));
  assert.equal(response.headers["cache-control"], "private, no-store");
  const zip = await JSZip.loadAsync(response.body as Buffer);
  assert.ok(zip.file("xl/worksheets/sheet1.xml"));
});

test("unknown export scope is rejected", async () => {
  assert.equal((await request(setup().app).get(`${url("/export")}&scope=everything`).set(...cookie)).status, 400);
});
