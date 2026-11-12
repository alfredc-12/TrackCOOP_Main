import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import cookieParser from "cookie-parser";
import request from "supertest";
import { createSettingsRouter } from "./settings.routes";
import { createActivityRouter } from "../audit-logs/activity.routes";
import type { SettingsRepository } from "./settings.repository";
import type { ActivityRepository } from "../audit-logs/activity.repository";
import type { AuthService } from "../auth/auth.service";
import type { AuthContext } from "../auth/auth.types";
import { errorHandler } from "../../middleware/error-handler";
import { AppError } from "../../utils/app-error";
test("Chairman-only settings/history routes validate before persistence and expose no audit mutations", async () => {
  let role = "chairman",
    reads = 0,
    saves = 0;
  const auth = {
    authenticate: async (token: string) => {
      if (!token) throw new AppError("Login required", 401, "UNAUTHENTICATED");
      return {
        sessionId: "1",
        tokenHash: "fixture",
        user: { id: "1", role, displayName: "Officer" },
      } as AuthContext;
    },
  } as unknown as AuthService;
  const settings = {
    catalog: async () => {
      reads++;
      return {
        settings: [],
        categories: [],
        technical: [],
        participationStatuses: [],
      };
    },
    save: async () => {
      saves++;
      return { settings: [] };
    },
  } as unknown as SettingsRepository;
  const audit = {
    list: async () => ({ items: [], total: 25, page: 2, pageSize: 10 }),
    options: async () => ({ users: [], categories: [] }),
    detail: async () => ({ id: "1", label: "Updated a system setting" }),
  } as unknown as ActivityRepository;
  const app = express()
    .use(cookieParser())
    .use(express.json())
    .use("/api", createSettingsRouter(auth, settings))
    .use("/api", createActivityRouter(auth, audit))
    .use(errorHandler);
  for (const path of [
    "/system-settings/catalog",
    "/system-settings",
    "/audit-logs",
    "/audit-logs/options",
    "/audit-logs/1",
  ]) {
    assert.equal((await request(app).get("/api" + path)).status, 401);
    for (role of ["bookkeeper", "member"])
      assert.equal(
        (
          await request(app)
            .get("/api" + path)
            .set("Cookie", "trackcoop_session=fixture")
        ).status,
        403,
      );
  }
  for (role of ["chairman", "bookkeeper"]) {
    const response = await request(app)
      .get("/api/system-settings/high-value-crops")
      .set("Cookie", "trackcoop_session=fixture");
    assert.equal(response.status, 200);
    assert.deepEqual(response.body.data, []);
  }
  role = "member";
  assert.equal(
    (
      await request(app)
        .get("/api/system-settings/high-value-crops")
        .set("Cookie", "trackcoop_session=fixture")
    ).status,
    403,
  );
  assert.equal(reads, 2);
  role = "chairman";
  const response = await request(app)
    .get("/api/audit-logs?page=2")
    .set("Cookie", "trackcoop_session=fixture");
  assert.equal(response.status, 200);
  assert.equal(response.body.meta.total, 25);
  assert.equal(response.body.meta.page, 2);
  assert.equal(response.headers["cache-control"], "private, no-store");
  assert.equal(
    (
      await request(app)
        .put("/api/system-settings/batch")
        .set("Cookie", "trackcoop_session=fixture")
        .send({
          changes: [{ key: "x", value: 1, expectedRevision: "invalid" }],
        })
    ).status,
    422,
  );
  assert.equal(saves, 0);
  assert.equal(
    (
      await request(app)
        .get("/api/audit-logs?start=2026-11-03&end=2026-10-01")
        .set("Cookie", "trackcoop_session=fixture")
    ).status,
    422,
  );
  assert.equal(
    (
      await request(app)
        .post("/api/audit-logs/1")
        .set("Cookie", "trackcoop_session=fixture")
        .send({ description: "tamper" })
    ).status,
    404,
  );
  assert.equal(
    (
      await request(app)
        .delete("/api/audit-logs/1")
        .set("Cookie", "trackcoop_session=fixture")
    ).status,
    404,
  );
});
