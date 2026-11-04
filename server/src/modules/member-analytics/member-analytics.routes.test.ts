import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import cookieParser from "cookie-parser";
import request from "supertest";
import { createMemberAnalyticsRouter } from "./member-analytics.routes";
import { createMemberAnalyticsService } from "./member-analytics.service";
import { analyticsFixture } from "./member-analytics.test-fixture";
import type { AuthService } from "../auth/auth.service";
import type { AuthContext } from "../auth/auth.types";
import type { MemberRepository } from "../members/member.repository";
import { errorHandler } from "../../middleware/error-handler";
import { AppError } from "../../utils/app-error";

function setup(role = "chairman") {
  let reads = 0;
  let ids: string[] | undefined;
  let directoryMembershipType: string | undefined;
  const auth = { async authenticate(token: string) {
    if (!token) throw new AppError("Authentication required", 401, "UNAUTHENTICATED");
    return { user: { id: "1", displayName: "Analytics Test", role }, sessionId: "test", tokenHash: "test" } as AuthContext;
  } } as AuthService;
  const directory: Pick<MemberRepository, "list"> = { async list(query) { ids = query.memberIds; directoryMembershipType = query.membershipType; return { members: [], total: ids?.length ?? 0, page: query.page, pageSize: query.pageSize }; } };
  const service = createMemberAnalyticsService({ async load() { reads++; return analyticsFixture(); } }, directory);
  const app = express().use(cookieParser()).use("/api", createMemberAnalyticsRouter(auth, service)).use(errorHandler);
  return { app, reads: () => reads, ids: () => ids, directoryMembershipType: () => directoryMembershipType };
}
const query = "start=2026-01-01&end=2026-10-31&asOf=2026-11-02";
test("analytics, matching members and workbook export reject anonymous access before reading sources", async () => {
  const s = setup();
  for (const path of ["", "/matching-members", "/export"]) {
    const response = await request(s.app).get(`/api/chairman/member-analytics${path}?${query}`);
    assert.equal(response.status, 401);
  }
  assert.equal(s.reads(), 0);
});
for (const role of ["bookkeeper", "member"]) test(`${role} cannot read chairman analytics or exports`, async () => {
  const s = setup(role);
  for (const path of ["", "/matching-members", "/export"]) assert.equal((await request(s.app).get(`/api/chairman/member-analytics${path}?${query}`).set("Cookie", "trackcoop_session=test")).status, 403);
  assert.equal(s.reads(), 0);
});
test("chairman receives typed filtered report without internal matching IDs or individual member records", async () => {
  const s = setup();
  const response = await request(s.app).get(`/api/chairman/member-analytics?${query}&sectors=Rice`).set("Cookie", "trackcoop_session=test");
  assert.equal(response.status, 200); assert.equal(response.body.data.population, 1);
  assert.equal(response.headers["cache-control"], "private, no-store");
  assert.equal(response.body.data.members, undefined); assert.equal(response.body.data.memberIds, undefined);
});
test("matching-member endpoint reuses the full analytics population before directory pagination", async () => {
  const s = setup();
  const response = await request(s.app).get(`/api/chairman/member-analytics/matching-members?${query}&selection=attention&page=2&pageSize=1`).set("Cookie", "trackcoop_session=test");
  assert.equal(response.status, 200); assert.deepEqual(s.ids(), ["3"]); assert.equal(response.body.meta.total, 1); assert.equal(response.body.meta.page, 2);
});
test("as-of analytics membership type is not accidentally reapplied as a current directory type", async () => {
  const s = setup();
  assert.equal((await request(s.app).get(`/api/chairman/member-analytics/matching-members?${query}&membershipType=True%20Member`).set("Cookie", "trackcoop_session=test")).status, 200);
  assert.equal(s.directoryMembershipType(), undefined);
  assert.equal((await request(s.app).get(`/api/chairman/member-analytics/matching-members?${query}&membershipType=True%20Member&directoryMembershipType=Associate`).set("Cookie", "trackcoop_session=test")).status, 200);
  assert.equal(s.directoryMembershipType(), "Associate");
});
test("invalid reporting combinations and unrecognized selections fail validation without data access", async () => {
  const s = setup();
  assert.equal((await request(s.app).get("/api/chairman/member-analytics?start=2026-11-01&end=2026-01-01").set("Cookie", "trackcoop_session=test")).status, 400);
  assert.equal((await request(s.app).get(`/api/chairman/member-analytics/matching-members?${query}&selection=arbitrary`).set("Cookie", "trackcoop_session=test")).status, 400);
  assert.equal(s.reads(), 0);
});
test("authorized workbook export has a private download response and real OOXML ZIP", async () => {
  const s = setup();
  const response = await request(s.app).get(`/api/chairman/member-analytics/export?${query}`).set("Cookie", "trackcoop_session=test").buffer(true).parse((res, callback) => { const chunks: Buffer[] = []; res.on("data", chunk => chunks.push(Buffer.from(chunk))); res.on("end", () => callback(null, Buffer.concat(chunks))); });
  assert.equal(response.status, 200); assert.match(response.headers["content-disposition"], /2026-11-02\.xlsx/);
  assert.equal((response.body as Buffer).subarray(0, 2).toString(), "PK");
});
