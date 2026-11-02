import assert from "node:assert/strict";
import test from "node:test";
import cookieParser from "cookie-parser";
import express from "express";
import request from "supertest";
import { errorHandler } from "../middleware/error-handler";
import type { AuthService } from "./auth/auth.service";
import type { AuthContext, RoleSlug } from "./auth/auth.types";
import { createMemberRouter } from "./members/member.routes";
import type { MemberService } from "./members/member.service";
import { createMembershipApplicationRouter } from "./membership-applications/membership-application.routes";
import type { MembershipApplicationService } from "./membership-applications/membership-application.service";
import { applicationSummaryFixture, historySummaryFixture, memberSummaryFixture, userSummaryFixture } from "./people-test-fixtures";
import { createUserRouter } from "./users/user.routes";
import type { UserService } from "./users/user.service";

const cookie = "trackcoop_session=opaque-cookie-value";

function authService(role: RoleSlug): AuthService {
  const auth: AuthContext = {
    sessionId: "1",
    tokenHash: "hash",
    user: { id: "1", displayName: "Chair", email: "chair@example.test", username: "chair", role },
  };
  return {
    async login() { throw new Error("not used"); },
    async authenticate(rawToken) { if (!rawToken) throw new Error("missing token"); return auth; },
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

test("user summary and list receive the same validated filters", async () => {
  const seen: { summary?: unknown; list?: unknown } = {};
  const service = {
    async getSummary(filters: unknown) { seen.summary = filters; return userSummaryFixture(); },
    async listUsers(query: unknown) { seen.list = query; return { users: [], total: 0, page: 1, pageSize: 20 }; },
  } as unknown as UserService;
  const app = appWith((a) => a.use("/api", createUserRouter(authService("chairman"), service)));
  const query = "statuses=Suspended%7CInactive&memberLink=unlinked&lastLogin=inactive&lastLoginDays=45&createdFrom=2026-01-01&createdTo=2026-01-31&includeHidden=true";

  assert.equal((await request(app).get(`/api/users/summary?${query}`).set("Cookie", cookie)).status, 200);
  assert.equal((await request(app).get(`/api/users?${query}&page=2&pageSize=5`).set("Cookie", cookie)).status, 200);

  const expected = { statuses: ["Suspended", "Inactive"], memberLink: "unlinked", lastLogin: "inactive", lastLoginDays: 45, createdFrom: "2026-01-01", createdTo: "2026-01-31", includeHidden: true };
  assert.deepEqual(seen.summary, { ...expected });
  assert.deepEqual(seen.list, { ...expected, page: 2, pageSize: 5, sortBy: "createdAt", sortDirection: "desc" });
});

test("user filters reject malformed input with a validation error", async () => {
  const service = { async getSummary() { return userSummaryFixture(); } } as unknown as UserService;
  const app = appWith((a) => a.use("/api", createUserRouter(authService("chairman"), service)));
  for (const bad of ["createdFrom=2026-02-01&createdTo=2026-01-01", "statuses=Bogus", "lastLogin=sometimes", "memberLink=maybe"]) {
    const response = await request(app).get(`/api/users/summary?${bad}`).set("Cookie", cookie);
    assert.equal(response.status, 400, bad);
  }
  assert.equal((await request(appWith((a) => a.use("/api", createUserRouter(authService("bookkeeper"), service)))).get("/api/users/summary").set("Cookie", cookie)).status, 403);
});

test("application summary, list and barangay options are available to staff and filtered identically", async () => {
  const seen: { summary?: unknown; list?: unknown } = {};
  const service = {
    async summary(filters: unknown) { seen.summary = filters; return applicationSummaryFixture({ total: 4 }); },
    async list(query: unknown) { seen.list = query; return { applications: [], total: 4, page: 1, pageSize: 20 }; },
    async barangayOptions() { return { barangays: [{ barangay: "Wawa", total: 2 }], unspecified: 1 }; },
  } as unknown as MembershipApplicationService;
  const app = appWith((a) => a.use("/api", createMembershipApplicationRouter(authService("bookkeeper"), service)));
  const query = "statuses=Submitted%7CUnder%20Review&requirementCompletion=complete&submittedFrom=2026-04-01&submittedTo=2026-04-30&barangay=Wawa";

  const summary = await request(app).get(`/api/membership-applications/summary?${query}`).set("Cookie", cookie);
  assert.equal(summary.status, 200);
  assert.equal(summary.body.data.total, 4);
  const list = await request(app).get(`/api/membership-applications?${query}`).set("Cookie", cookie);
  assert.equal(list.status, 200);
  assert.equal(list.body.meta.total, 4);
  const expected = { search: null, statuses: ["Submitted", "Under Review"], requirementCompletion: "complete", submittedFrom: "2026-04-01", submittedTo: "2026-04-30", barangay: "Wawa" };
  assert.deepEqual(seen.summary, expected);
  assert.deepEqual(seen.list, { ...expected, page: 1, pageSize: 20, sortBy: "submittedAt", sortDirection: "desc" });

  const barangays = await request(app).get("/api/membership-applications/barangays").set("Cookie", cookie);
  assert.equal(barangays.status, 200);
  assert.equal(barangays.body.data.unspecified, 1);

  const invalid = await request(app).get("/api/membership-applications/summary?requirementCompletion=sort-of").set("Cookie", cookie);
  assert.equal(invalid.status, 400);
  assert.equal((await request(appWith((a) => a.use("/api", createMembershipApplicationRouter(authService("member"), service)))).get("/api/membership-applications/summary").set("Cookie", cookie)).status, 403);
});

test("member directory and history summaries are chairman-only and filtered like their lists", async () => {
  const seen: { summary?: unknown; history?: unknown; historySummary?: unknown; actors?: unknown } = {};
  const service = {
    async summary(filters: unknown) { seen.summary = filters; return memberSummaryFixture({ total: 3 }); },
    async unifiedStatusHistory(query: unknown) { seen.history = query; return { entries: [], total: 0, page: 1, pageSize: 20 }; },
    async unifiedStatusHistorySummary(filters: unknown) { seen.historySummary = filters; return historySummaryFixture({ total: 5, application: 2, member: 2, account: 1 }); },
    async unifiedStatusHistoryActors(filters: unknown) { seen.actors = filters; return { actors: [{ id: "1", name: "Chair", total: 4 }], withoutActor: 1 }; },
  } as unknown as MemberService;
  const app = appWith((a) => a.use("/api", createMemberRouter(authService("chairman"), service)));

  const members = await request(app).get("/api/members/summary?accountLink=unlinked&sector=Rice&approvedFrom=2026-04-01").set("Cookie", cookie);
  assert.equal(members.status, 200);
  assert.deepEqual(seen.summary, { accountLink: "unlinked", sector: "Rice", approvedFrom: "2026-04-01" });

  const history = "from=2026-04-01&to=2026-04-30&actorId=none&changeType=membership-type&search=ana";
  const table = await request(app).get(`/api/members/status-history?${history}&sourceModule=Member`).set("Cookie", cookie);
  assert.equal(table.status, 200);
  assert.deepEqual(seen.history, { from: "2026-04-01", to: "2026-04-30", actorId: "none", changeType: "membership-type", search: "ana", sourceModule: "Member", page: 1, pageSize: 20 });

  const summary = await request(app).get(`/api/members/status-history/summary?${history}`).set("Cookie", cookie);
  assert.equal(summary.body.data.total, 5);
  assert.deepEqual(seen.historySummary, { from: "2026-04-01", to: "2026-04-30", actorId: "none", changeType: "membership-type", search: "ana", sourceModule: "All" });

  const actors = await request(app).get("/api/members/status-history/actors").set("Cookie", cookie);
  assert.equal(actors.body.data.withoutActor, 1);
  assert.equal((await request(app).get("/api/members/status-history/summary?from=2026-05-01&to=2026-04-01").set("Cookie", cookie)).status, 400);
  assert.equal((await request(app).get("/api/members/summary?accountLink=other").set("Cookie", cookie)).status, 400);

  const staff = appWith((a) => a.use("/api", createMemberRouter(authService("bookkeeper"), service)));
  assert.equal((await request(staff).get("/api/members/status-history/summary").set("Cookie", cookie)).status, 403);
});
