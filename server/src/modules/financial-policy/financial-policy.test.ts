import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppError } from "../../utils/app-error";
import { errorHandler } from "../../middleware/error-handler";
import type { AuthService } from "../auth/auth.service";
import type { AuthContext } from "../auth/auth.types";
import { assessConfiguration, thresholdAmount, validateConfig, type PolicyRevision } from "./financial-policy.model";
import { createFinancialPolicyRouter } from "./financial-policy.routes";
import type { FinancialPolicyRepository } from "./financial-policy.repository";

const now = new Date("2026-11-06T12:00:00Z");
function revision(kind: "threshold" | "restrictions", state: "DRAFT" | "APPROVED", config: PolicyRevision["config"]): PolicyRevision {
  return { kind, version: 2, state, config, createdBy: "1", createdAt: "2026-11-06T00:00:00Z", approvedBy: state === "APPROVED" ? "1" : null, approvedAt: state === "APPROVED" ? "2026-11-06T00:00:00Z" : null, effectiveAt: state === "APPROVED" ? "2026-11-06T00:00:00Z" : null };
}
const threshold = revision("threshold", "APPROVED", { amountPhp: "123.45" });
const empty = revision("restrictions", "APPROVED", { categoryIds: [], sources: [] });

test("threshold validation is exact, positive, bounded and never throws on malformed input", () => {
  for (const input of ["0", "0.00", "-1", "foo", "1e2", "1.001", "1000000000000", "", "01", "Infinity"]) assert.equal(thresholdAmount.safeParse(input).success, false, input);
  for (const input of ["0.01", "1", "999999999999.99"]) assert.equal(thresholdAmount.safeParse(input).success, true, input);
});

test("absent, draft, valid, empty, populated and invalid configurations remain distinguishable", () => {
  assert.equal(assessConfiguration(null, null, now).hypotheticalActiveResult, "POLICY_CONFIGURATION_REQUIRED");
  assert.equal(assessConfiguration({ ...threshold, state: "DRAFT" }, null, now).threshold, "DRAFT");
  assert.equal(assessConfiguration(threshold, { ...empty, state: "DRAFT" }, now).restrictions, "DRAFT");
  const complete = assessConfiguration(threshold, empty, now);
  assert.equal(complete.threshold, "APPROVED_VALID_AMOUNT");
  assert.equal(complete.restrictions, "APPROVED_EMPTY");
  assert.equal(complete.lifecycle, "Inactive");
  assert.equal(complete.futureActivationEligible, false);
  assert.equal(complete.configurationComplete, true);
  assert.equal(assessConfiguration(threshold, revision("restrictions", "APPROVED", { categoryIds: ["3"], sources: ["Manual"] }), now).restrictions, "APPROVED_WITH_ENTRIES");
  assert.equal(assessConfiguration({ ...threshold, config: { amountPhp: "0" } }, empty, now).threshold, "INVALID");
  assert.equal(assessConfiguration(threshold, empty, now, { threshold: 1, restrictions: 2 }).hypotheticalActiveResult, "POLICY_CONFIGURATION_REQUIRED");
  assert.equal(assessConfiguration({ ...threshold, effectiveAt: "2026-11-07T00:00:00Z" }, empty, now).threshold, "NOT_YET_EFFECTIVE");
  assert.throws(() => validateConfig("restrictions", { categoryIds: ["3", "3"], sources: [] }));
  assert.throws(() => validateConfig("restrictions", { categoryIds: [], sources: ["invented"] }));
});

test("configuration routes require Chairman identity and pass its actor and version to persistence", async () => {
  let role = "chairman";
  let writes = 0;
  const auth = { authenticate: async (token: string) => {
    if (!token) throw new AppError("Login required", 401, "UNAUTHENTICATED");
    return { sessionId: "1", tokenHash: "fixture", user: { id: "8", role, displayName: "Officer" } } as AuthContext;
  } } as unknown as AuthService;
  const repository = {
    history: async () => [],
    save: async (_kind: unknown, expected: number, actor: string) => { writes++; assert.equal(expected, 0); assert.equal(actor, "8"); return threshold; },
  } as unknown as FinancialPolicyRepository;
  const app = express().use(cookieParser()).use(express.json()).use("/api", createFinancialPolicyRouter(auth, repository)).use(errorHandler);
  const path = "/api/financial-policy/threshold/approve";
  assert.equal((await request(app).post(path).send({ expectedVersion: 0, effectiveAt: "2026-11-07T00:00:00Z" })).status, 401);
  for (role of ["member", "bookkeeper"]) {
    assert.equal((await request(app).post(path).set("Cookie", "trackcoop_session=fixture").send({ expectedVersion: 0, effectiveAt: "2026-11-07T00:00:00Z" })).status, 403);
    assert.equal((await request(app).get("/api/financial-policy").set("Cookie", "trackcoop_session=fixture")).status, 403);
  }
  assert.equal(writes, 0);
  role = "chairman";
  assert.equal((await request(app).post(path).set("Cookie", "trackcoop_session=fixture").send({ expectedVersion: 0, effectiveAt: "bad" })).status, 422);
  assert.equal((await request(app).post(path).set("Cookie", "trackcoop_session=fixture").send({ expectedVersion: 0, effectiveAt: "2026-11-07T00:00:00Z" })).status, 201);
  assert.equal(writes, 1);
  assert.equal((await request(app).post("/api/financial-policy/activate").set("Cookie", "trackcoop_session=fixture").send({})).status, 404);
});
