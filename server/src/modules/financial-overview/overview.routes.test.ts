import assert from "node:assert/strict";
import test from "node:test";
import request from "supertest";
import express from "express";
import cookieParser from "cookie-parser";
import { createFinancialOverviewRouter } from "./overview.routes";
import { createFinanceRouter } from "../finance/finance.routes";
import type { OverviewRepository } from "./overview.repository";
import type { FinanceService } from "../finance/finance.service";
import type { AuthService } from "../auth/auth.service";
import type { AuthContext } from "../auth/auth.types";
import { AppError } from "../../utils/app-error";
import { errorHandler } from "../../middleware/error-handler";
test("Overview is chairman-only and mutation permissions remain Bookkeeper-only", async () => {
  let role = "chairman",
    read = 0,
    created = 0;
  const auth = {
    authenticate: async (token: string) => {
      if (!token) throw new AppError("Login required", 401, "UNAUTHENTICATED");
      return {
        sessionId: "1",
        tokenHash: "fixture",
        user: { id: "1", role, displayName: "Staff" },
      } as AuthContext;
    },
  } as unknown as AuthService;
  const repo = {
    summary: async () => {
      read++;
      return { summary: { income: "10.00" } };
    },
    activity: async () => ({ items: [], total: 0, page: 1, pageSize: 10 }),
    options: async () => ({ categories: [] }),
    detail: async () => ({ id: "1" }),
  } as unknown as OverviewRepository;
  const finance = {
    createOperatingExpense: async () => {
      created++;
      return { id: "1" };
    },
  } as unknown as FinanceService;
  const app = express()
    .use(cookieParser())
    .use(express.json())
    .use("/api", createFinancialOverviewRouter(auth, repo))
    .use("/api", createFinanceRouter(auth, finance))
    .use(errorHandler);
  const path = "/api/financial-overview/summary";
  assert.equal((await request(app).get(path)).status, 401);
  for (role of ["bookkeeper", "member"])
    assert.equal(
      (await request(app).get(path).set("Cookie", "trackcoop_session=fixture"))
        .status,
      403,
    );
  role = "chairman";
  const response = await request(app)
    .get(path)
    .set("Cookie", "trackcoop_session=fixture");
  assert.equal(response.status, 200);
  assert.equal(response.headers["cache-control"], "private, no-store");
  assert.equal(read, 1);
  assert.equal(
    (
      await request(app)
        .get(path + "?sortBy=bad")
        .set("Cookie", "trackcoop_session=fixture")
    ).status,
    422,
  );
  assert.equal(read, 1);
  for (const [path, body] of [
    [
      "/operating-expenses",
      { expenseType: "Fuel", amount: 10, expenseDate: "2026-10-01" },
    ],
    ["/financial-records", { recordType: "Income" }],
    ["/financial-records/1/post", {}],
    ["/financial-records/1/void", {}],
  ] as const)
    assert.equal(
      (
        await request(app)
          .post("/api" + path)
          .set("Cookie", "trackcoop_session=fixture")
          .send(body)
      ).status,
      403,
    );
  assert.equal(created, 0);
  role = "bookkeeper";
  assert.equal(
    (
      await request(app)
        .post("/api/operating-expenses")
        .set("Cookie", "trackcoop_session=fixture")
        .send({ expenseType: "Fuel", amount: 10, expenseDate: "2026-10-01" })
    ).status,
    201,
  );
  assert.equal(created, 1);
});
