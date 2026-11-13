import assert from "node:assert/strict";
import test from "node:test";
import cookieParser from "cookie-parser";
import express from "express";
import request from "supertest";
import { errorHandler } from "../../middleware/error-handler";
import { AppError } from "../../utils/app-error";
import type { AuthService } from "../auth/auth.service";
import type { AuthContext, RoleSlug } from "../auth/auth.types";
import { createFinanceRouter } from "../finance/finance.routes";
import type { FinanceService } from "../finance/finance.service";
import { createExpenseOverviewRouter } from "./expense-overview.routes";
import type { ExpenseOverviewService } from "./expense-overview.service";

const cookie = "trackcoop_session=opaque-cookie-value";

function authService(role: RoleSlug): AuthService {
  const auth: AuthContext = { sessionId: "1", tokenHash: "hash", user: { id: "1", displayName: "User", email: "user@example.test", username: "user", role } };
  return {
    async login() { throw new Error("not used"); },
    async authenticate(rawToken) { if (!rawToken) throw new AppError("Authentication is required", 401, "UNAUTHENTICATED"); return auth; },
    async logout() {},
    async listSessions() { return []; },
    async revokeSession() {},
  };
}

function appWith(mount: (app: express.Express) => void) {
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use((req, _res, next) => { req.requestId = "test-request"; next(); });
  mount(app);
  app.use(errorHandler);
  return app;
}

function overviewStub(seen: { filters?: unknown; query?: unknown } = {}) {
  const echo = (key: "filters" | "query") => async (value: unknown) => { seen[key] = value; return { ok: true }; };
  return {
    plan: () => ({}),
    summary: echo("filters"), trends: echo("filters"), categories: echo("filters"), sources: echo("filters"), drivers: echo("filters"),
    matrix: echo("filters"), integrity: echo("filters"), insights: async (value: unknown) => { seen.filters = value; return []; },
    options: async () => ({ ok: true }),
    records: echo("query"),
    recordDetail: async (id: string) => (id === "7" ? { id } : null),
    repository: {},
  } as unknown as ExpenseOverviewService;
}

const overviewPaths = ["summary", "trends", "categories", "sources", "drivers", "matrix", "integrity", "insights", "options", "records", "records/7"];

test("the Chairman can read every Financial Overview endpoint", async () => {
  const app = appWith((a) => a.use("/api", createExpenseOverviewRouter(authService("chairman"), overviewStub())));
  for (const path of overviewPaths) {
    const response = await request(app).get(`/api/financial-overview/expenses/${path}`).set("Cookie", cookie);
    assert.equal(response.status, 200, path);
  }
});

test("only the Chairman may use them: the Bookkeeper, members and anonymous callers are refused", async () => {
  for (const role of ["bookkeeper", "member"] as const) {
    const app = appWith((a) => a.use("/api", createExpenseOverviewRouter(authService(role), overviewStub())));
    for (const path of overviewPaths) {
      assert.equal((await request(app).get(`/api/financial-overview/expenses/${path}`).set("Cookie", cookie)).status, 403, `${role} ${path}`);
    }
  }
  const app = appWith((a) => a.use("/api", createExpenseOverviewRouter(authService("chairman"), overviewStub())));
  assert.equal((await request(app).get("/api/financial-overview/expenses/summary")).status, 401);
});

test("the Financial Overview has no write endpoints at all", async () => {
  const app = appWith((a) => a.use("/api", createExpenseOverviewRouter(authService("chairman"), overviewStub())));
  for (const method of ["post", "put", "patch", "delete"] as const) {
    for (const path of ["summary", "records", "records/7"]) {
      const response = await request(app)[method](`/api/financial-overview/expenses/${path}`).set("Cookie", cookie).send({ amount: 1 });
      assert.ok([404, 405].includes(response.status), `${method} ${path} -> ${response.status}`);
    }
  }
});

test("filters are validated once and every panel receives the same parsed filters", async () => {
  const seen: { filters?: unknown; query?: unknown } = {};
  const app = appWith((a) => a.use("/api", createExpenseOverviewRouter(authService("chairman"), overviewStub(seen))));
  const query = "period=last_month&compare=last_year&categoryIds=3,4&sourceModules=Rental&classes=operating,capital&amountMin=100&search=fuel";
  assert.equal((await request(app).get(`/api/financial-overview/expenses/summary?${query}`).set("Cookie", cookie)).status, 200);
  const expected = {
    period: "last_month", startDate: undefined, endDate: undefined, compare: "last_year", categoryIds: ["3", "4"], sourceModules: ["Rental"],
    classes: ["operating", "capital"], amountMin: 100, amountMax: undefined, recordedBy: undefined, postedBy: undefined, seasonId: undefined,
    search: "fuel", granularity: undefined,
  };
  assert.deepEqual(seen.filters, expected);
  assert.equal((await request(app).get(`/api/financial-overview/expenses/records?${query}&page=3&pageSize=50&sortBy=amount&sortDirection=asc&view=unposted`).set("Cookie", cookie)).status, 200);
  assert.deepEqual(seen.query, { ...expected, view: "unposted", page: 3, pageSize: 50, sortBy: "amount", sortDirection: "asc" });
});

test("bad input is a 400 with field messages, never a server error", async () => {
  const app = appWith((a) => a.use("/api", createExpenseOverviewRouter(authService("chairman"), overviewStub())));
  for (const bad of ["period=forever", "period=custom&startDate=2026-02-30&endDate=2026-03-01", "sourceModules=Bank", "categoryIds=1;DROP", "amountMin=5&amountMax=1"]) {
    const response = await request(app).get(`/api/financial-overview/expenses/summary?${bad}`).set("Cookie", cookie);
    assert.equal(response.status, 400, bad);
    assert.equal(response.body.errors?.[0]?.code, "VALIDATION_ERROR", bad);
    assert.ok(response.body.errors?.[0]?.field, `${bad} names the offending field`);
  }
  assert.equal((await request(app).get("/api/financial-overview/expenses/records?sortBy=password").set("Cookie", cookie)).status, 400);
  assert.equal((await request(app).get("/api/financial-overview/expenses/records/abc").set("Cookie", cookie)).status, 400);
  assert.equal((await request(app).get("/api/financial-overview/expenses/records/999").set("Cookie", cookie)).status, 404);
});

function financeStub(calls: string[]) {
  const record = async () => ({ id: "1" });
  return {
    listCategories: async () => [], createCategory: record, updateCategory: record, listRecords: async () => ({ records: [], total: 0, page: 1, pageSize: 20 }),
    getRecord: record, createRecord: record, updateRecord: record, postRecord: record, voidRecord: record,
    createOperatingExpense: async () => { calls.push("create"); return { id: "1" }; },
    operatingExpenses: async () => ({ items: [], byType: [], total: 0, count: 0, startDate: null, endDate: null }),
    operatingExpenseReport: async () => Buffer.from("%PDF"), summary: async () => ({}), trends: async () => [],
  } as unknown as FinanceService;
}

const expenseBody = { expenseType: "Fuel", amount: 100, expenseDate: "2026-11-01" };

test("recording an operating expense is the Bookkeeper's alone; the Chairman is refused by the API", async () => {
  const calls: string[] = [];
  const chairman = appWith((a) => a.use("/api", createFinanceRouter(authService("chairman"), financeStub(calls))));
  const refused = await request(chairman).post("/api/operating-expenses").set("Cookie", cookie).send(expenseBody);
  assert.equal(refused.status, 403);
  assert.deepEqual(calls, []);

  const bookkeeper = appWith((a) => a.use("/api", createFinanceRouter(authService("bookkeeper"), financeStub(calls))));
  const created = await request(bookkeeper).post("/api/operating-expenses").set("Cookie", cookie).send(expenseBody);
  assert.equal(created.status, 201);
  assert.deepEqual(calls, ["create"]);
});

test("the Bookkeeper's operating-expense list and report stay available to both staff roles", async () => {
  for (const role of ["chairman", "bookkeeper"] as const) {
    const app = appWith((a) => a.use("/api", createFinanceRouter(authService(role), financeStub([]))));
    assert.equal((await request(app).get("/api/operating-expenses").set("Cookie", cookie)).status, 200, role);
    assert.equal((await request(app).get("/api/operating-expenses/report").set("Cookie", cookie)).status, 200, role);
  }
});
