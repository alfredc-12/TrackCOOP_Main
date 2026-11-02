import assert from "node:assert/strict";
import test from "node:test";
import cookieParser from "cookie-parser";
import express from "express";
import request from "supertest";
import JSZip from "jszip";
import { errorHandler } from "../../middleware/error-handler";
import { AppError } from "../../utils/app-error";
import {
  configurationFromSettings,
  defaultRfmFilters,
} from "./member-indicator.policy";
import { rfmDiagnostics } from "./member-indicator.workspace-query";
import { createMemberIndicatorRouter } from "./member-indicator.routes";
import type { AuthService } from "../auth/auth.service";
import type { RoleSlug } from "../auth/auth.types";
import type { RfmWorkspaceRepository } from "./member-indicator.workspace-repository";
import type { RfmWorkspace } from "./member-indicator.workspace-types";
const settings = configurationFromSettings(new Map());
function fixture(): RfmWorkspace {
  return {
    rows: [],
    total: 0,
    page: 1,
    pageSize: 20,
    filters: defaultRfmFilters(),
    settings,
    generatedAt: "2026-11-02T00:00:00Z",
    summary: {
      eligible: 0,
      scored: 0,
      notScored: 0,
      active: 0,
      needsMonitoring: 0,
      inactive: 0,
      coverage: null,
      average: null,
      median: null,
      latestCalculation: null,
      basisPeriods: [],
      versions: [],
      byType: [],
      quality: [],
    },
    ...rfmDiagnostics([], 0),
    options: { barangays: [], sectors: [], versions: [], bases: [] },
  };
}
function appFor(role: RoleSlug) {
  const calls: Array<{ method: string; value?: unknown }> = [];
  const repository: RfmWorkspaceRepository = {
    async workspace(filters, allRows) {
      calls.push({ method: "workspace", value: { filters, allRows } });
      return { ...fixture(), filters };
    },
    async history(id, page, pageSize, allRows) {
      calls.push({ method: "history", value: { id, page, pageSize, allRows } });
      return { rows: [], total: 0, page, pageSize };
    },
    async evidence(id, indicatorId) {
      calls.push({ method: "evidence", value: { id, indicatorId } });
      return {
        metadata: null,
        message:
          "Detailed source records are unavailable for this saved calculation.",
      };
    },
    async runs() {
      return { rows: [], total: 0 };
    },
    async preview(input) {
      calls.push({ method: "preview", value: input });
      return {
        basis: { start: "2025-11-02", end: "2026-11-02" },
        settings,
        affected: 0,
        newlyScored: 0,
        changed: 0,
        unchanged: 0,
        missingParticipation: 0,
        zeroContributions: 0,
        previewFingerprint: "a".repeat(64),
        generatedAt: "2026-11-02T00:00:00Z",
      };
    },
    async recalculate(input, auth, fingerprint) {
      calls.push({
        method: "recalculate",
        value: { input, auth, fingerprint },
      });
      return {
        ...(await repository.preview(input)),
        runId: "run-1",
        saved: 0,
        skippedIdentical: 0,
        computedAt: "2026-11-02T00:00:00Z",
      };
    },
  };
  const auth = {
    async authenticate(token?: string) {
      if (!token)
        throw new AppError(
          "Authentication is required",
          401,
          "UNAUTHENTICATED",
        );
      return {
        sessionId: "1",
        tokenHash: "hash",
        user: {
          id: "1",
          displayName: "Chair",
          username: "chair",
          email: "chair@example.test",
          role,
        },
      };
    },
  } as AuthService;
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use("/api", createMemberIndicatorRouter(auth, undefined, repository));
  app.use(errorHandler);
  return { app, calls };
}
const base = "/api/member-indicators/workspace";
for (const role of ["bookkeeper", "member"] as const)
  test(`${role} cannot inspect, preview, save or export RFM workspace data`, async () => {
    const { app, calls } = appFor(role);
    for (const path of [
      "",
      "/export",
      "/runs",
      "/10/history",
      "/10/history/export",
      "/10/evidence/80",
    ])
      assert.equal(
        (
          await request(app)
            .get(base + path)
            .set("Cookie", "trackcoop_session=test")
        ).status,
        403,
      );
    for (const path of ["/preview", "/recalculate"])
      assert.equal(
        (
          await request(app)
            .post(base + path)
            .set("Cookie", "trackcoop_session=test")
            .send({ basisPeriodEnd: "2026-11-02" })
        ).status,
        403,
      );
    assert.equal(calls.length, 0);
  });
test("anonymous workspace export is rejected", async () =>
  assert.equal(
    (await request(appFor("chairman").app).get(base + "/export")).status,
    401,
  ));
test("chairman filters reach one consistent workspace and exports request every matching row", async () => {
  const { app, calls } = appFor("chairman");
  const response = await request(app)
    .get(
      base +
        "?search=Rice&membershipType=Associate&minScore=7&context=historical&basisEnd=2026-01-31",
    )
    .set("Cookie", "trackcoop_session=test");
  assert.equal(response.status, 200);
  assert.equal(response.body.data.filters.minScore, 7);
  const file = await request(app)
    .get(base + "/export?search=Rice&page=2&pageSize=10")
    .set("Cookie", "trackcoop_session=test")
    .buffer(true)
    .parse((res, callback) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => callback(null, Buffer.concat(chunks)));
    });
  assert.equal(file.status, 200);
  assert.match(file.headers["content-type"], /spreadsheetml/);
  const zip = await JSZip.loadAsync(file.body);
  assert.ok(zip.file("xl/worksheets/sheet6.xml"));
  assert.equal((calls[1].value as { allRows: boolean }).allRows, true);
  assert.equal(
    (calls[1].value as { filters: { search: string } }).filters.search,
    "Rice",
  );
  const history = await request(app)
    .get(base + "/10/history/export")
    .set("Cookie", "trackcoop_session=test");
  assert.equal(history.status, 200);
  assert.deepEqual(calls[2], {
    method: "history",
    value: { id: "10", page: 1, pageSize: 100, allRows: true },
  });
});
test("invalid filters and unconfirmed recalculation are rejected before repository access", async () => {
  const { app, calls } = appFor("chairman");
  for (const query of [
    "sortBy=malicious",
    "minScore=13&maxScore=2",
    "pageSize=1000",
    "context=historical",
    "recencyScore=6",
  ])
    assert.equal(
      (
        await request(app)
          .get(`${base}?${query}`)
          .set("Cookie", "trackcoop_session=test")
      ).status,
      400,
    );
  const rejected = await request(app)
    .post(base + "/recalculate")
    .set("Cookie", "trackcoop_session=test")
    .send({ basisPeriodEnd: "2026-11-02" });
  assert.equal(rejected.status, 400);
  assert.equal(calls.length, 0);
  const preview = await request(app)
    .post(base + "/preview")
    .set("Cookie", "trackcoop_session=test")
    .send({ basisPeriodEnd: "2026-11-02" });
  assert.equal(preview.status, 200);
  assert.equal(
    calls.some((c) => c.method === "recalculate"),
    false,
  );
  const commit = await request(app)
    .post(base + "/recalculate")
    .set("Cookie", "trackcoop_session=test")
    .send({
      basisPeriodEnd: "2026-11-02",
      confirmed: true,
      previewFingerprint: preview.body.data.previewFingerprint,
    });
  assert.equal(commit.status, 200);
  assert.equal(
    calls.some((c) => c.method === "recalculate"),
    true,
  );
});
