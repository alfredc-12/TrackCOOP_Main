import { createServer, type Server } from "node:http";
import { expect, test, type Page } from "@playwright/test";

/**
 * People Management KPI cards and filters against a mocked API. The mock records every request so the
 * tests can assert on what the page asks the server for, and it answers with summaries that are
 * consistent with the list totals (as the real API's shared predicates guarantee).
 */

const apiPort = Number(process.env.PLAYWRIGHT_API_PORT ?? 5055);
const apiUrl = `http://localhost:${apiPort}`;
const origin = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

type Seen = URL[];

const chairman = { id: "1", username: "chair", email: "chair@example.test", displayName: "Chair", role: "chairman", accountStatus: "Active" };

// The Next proxy checks the session server-side before the page loads; browser calls are mocked per page below.
let sessionServer: Server | null = null;

test.beforeAll(async () => {
  sessionServer = createServer((request, response) => {
    response.setHeader("Content-Type", "application/json");
    response.writeHead(200);
    response.end(request.url === "/api/auth/me" ? JSON.stringify({ success: true, message: "ok", data: chairman, meta: {} }) : JSON.stringify({ success: true, message: "ok", data: [], meta: {} }));
  });
  await new Promise<void>((resolve, reject) => {
    sessionServer?.once("error", reject);
    sessionServer?.listen(apiPort, resolve);
  });
});

test.afterAll(async () => {
  await new Promise<void>((resolve) => sessionServer?.close(() => resolve()));
});

const envelope = (data: unknown, meta: Record<string, unknown> = {}) => JSON.stringify({ success: true, message: "ok", data, meta });

const user = (id: string, name: string, role: string, accountStatus: string) => ({
  id, username: name.toLowerCase().replace(/\s+/g, ""), email: `${name.toLowerCase().replace(/\s+/g, ".")}@example.test`, displayName: name, role, accountStatus,
  lastLoginAt: null, createdAt: "2026-07-24T00:00:00.000Z", linkedMemberId: null, linkedMemberCode: null, linkedMemberName: null, activeSessionCount: 0, activationTokenExpiresAt: null,
});

const application = (id: string, status: string) => ({
  id, applicationCode: `MEM-APP-${id}`, applicationSource: "Public Website", requestedMembershipType: "Associate", fullName: `Applicant ${id}`,
  email: null, contactNumber: "0917", barangay: "Wawa", applicationStatus: status, submittedAt: "2026-04-01T02:00:00.000Z", reviewedAt: null,
});

const applicationDetail = (id: string, status: string) => ({
  ...application(id, status), firstName: "App", middleName: null, lastName: id, suffix: null, civilStatus: null, dateOfBirth: null, currentAddress: "Somewhere",
  municipality: "Nasugbu", province: "Batangas", sector: null, beneficiaries: [], documents: [], requirements: [], history: [],
});

const member = (id: string, name: string) => ({
  id, userId: null, memberCode: `NFFAC-${id}`, fullName: name, contactNumber: null, email: null, barangay: "Wawa", municipality: "Nasugbu", province: "Batangas",
  sector: "Rice", membershipType: "True Member", approvalStatus: "Approved", officialMemberStatus: "Active", applicationDate: null, trueMemberSince: null,
  createdAt: "2026-07-02T00:00:00.000Z",
});

const historyEntry = (id: string, source: string) => ({
  id, sourceModule: source, subjectId: "1", subjectCode: "NFFAC-1", subjectName: "Ana Reyes", oldStatus: "Pending", newStatus: "Active", reason: "Checked",
  actor: "Chair Person", actorId: "1", changeType: "member-status", changedAt: "2026-07-24T02:00:00.000Z",
});

async function mockApi(page: Page, seen: Seen, overrides: Partial<Record<string, (url: URL) => unknown>> = {}) {
  await page.context().addCookies([{ name: "trackcoop_session", value: "test-session", url: origin }]);
  await page.route(`${apiUrl}/api/**`, async (route) => {
    const url = new URL(route.request().url());
    seen.push(url);
    const path = url.pathname;
    const respond = (data: unknown, meta: Record<string, unknown> = {}) => route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Credentials": "true" },
      body: envelope(data, meta),
    });
    const override = overrides[path];
    if (override) return respond(override(url));

    if (path === "/api/auth/me") return respond(chairman);
    if (path === "/api/users/summary") {
      return respond({ total: 8, active: 4, pendingActivation: 2, suspendedInactive: 2, suspended: 1, inactive: 1, byRole: { chairman: 1, bookkeeper: 1, member: 6 }, memberAccounts: { eligible: 6, linked: 5 }, overallTotal: 20 });
    }
    if (path === "/api/users") {
      const restricted = url.searchParams.get("statuses") === "Suspended|Inactive";
      const rows = restricted ? [user("2", "Sam Suspended", "member", "Suspended"), user("3", "Ina Inactive", "member", "Inactive")] : [user("1", "Pat Active", "member", "Active")];
      return respond(rows, { total: restricted ? 2 : 8, page: 1, pageSize: Number(url.searchParams.get("pageSize") ?? 5) });
    }
    if (path === "/api/membership-applications/summary") {
      return respond({ total: 20, submitted: 3, underReview: 4, needsInformation: 2, paymentRequired: 3, paymentConfirmed: 2, approved: 4, rejected: 1, withdrawn: 1, forReview: 7, paymentStage: 5, overallTotal: 40 });
    }
    if (path === "/api/membership-applications/barangays") return respond({ barangays: [{ barangay: "Wawa", total: 5 }, { barangay: "Aga", total: 2 }], unspecified: 1 });
    if (path === "/api/membership-applications") {
      const complete = url.searchParams.get("requirementCompletion");
      const pageSize = Number(url.searchParams.get("pageSize") ?? 10);
      const total = complete === "complete" ? 4 : 20;
      const page = Number(url.searchParams.get("page") ?? 1);
      const rows = Array.from({ length: Math.min(pageSize, Math.max(0, total - (page - 1) * pageSize)) }, (_, index) => application(String((page - 1) * pageSize + index + 1), "Submitted"));
      return respond(rows, { total, page, pageSize });
    }
    const detail = path.match(/^\/api\/membership-applications\/(\d+)$/);
    if (detail) return respond(applicationDetail(detail[1], "Submitted"));
    if (path === "/api/members/summary") {
      return respond({
        total: 12, pendingApproval: 2, needsInformation: 0, rejected: 1, approved: 9, associate: 8, trueMember: 4, active: 7, inactive: 2, suspended: 1,
        approvedMembers: { total: 9, active: 6, inactive: 2, suspended: 1, terminated: 0, pendingOfficial: 0, associate: 5, trueMember: 4, unlinked: 3 }, overallTotal: 30,
      });
    }
    if (path === "/api/members/distribution/barangay") return respond([{ barangay: "Wawa", total: 6 }, { barangay: "wawa ", total: 1 }, { barangay: "Unspecified", total: 2 }]);
    if (path === "/api/members") return respond([member("1", "Ana Reyes")], { total: url.searchParams.get("membershipType") === "True Member" ? 4 : 12, page: 1, pageSize: 10 });
    if (path === "/api/members/status-history/summary") return respond({ total: 10, application: 5, member: 3, account: 2, distinctSubjects: 7, overallTotal: 50 });
    if (path === "/api/members/status-history/actors") return respond({ actors: [{ id: "1", name: "Chair Person", total: 8 }, { id: "2", name: "Book Keeper", total: 1 }], withoutActor: 1 });
    if (path === "/api/members/status-history") {
      const source = url.searchParams.get("sourceModule");
      return respond([historyEntry("member-1", source && source !== "All" ? source : "Member")], { total: source === "Account" ? 2 : 10, page: 1, pageSize: 10 });
    }
    if (path.startsWith("/api/realtime")) return route.abort();
    return respond([]);
  });
}

const last = (seen: Seen, path: string) => [...seen].reverse().find((url) => url.pathname === path);
const count = (seen: Seen, path: string) => seen.filter((url) => url.pathname === path).length;

test.describe("user accounts", () => {
  test("KPI cards filter the table, show their calculation, and clear again", async ({ page }) => {
    const seen: Seen = [];
    await mockApi(page, seen);
    await page.goto("/portal/chairman/users");

    await expect(page.getByRole("button", { name: /^Total accounts: 8/ })).toBeVisible();
    await expect(page.getByText("50% of 8 accounts")).toBeVisible();
    await expect(page.getByText("25% of 8 accounts")).toBeVisible();
    await expect(page.getByText("1 Suspended · 1 Inactive")).toBeVisible();
    await expect(page.getByText("5 of 6 member accounts linked to a member profile (83.3%)")).toBeVisible();

    await page.getByRole("button", { name: /^Restricted accounts: 2/ }).click();
    await expect(page.getByText("Sam Suspended")).toBeVisible();
    await expect.poll(() => last(seen, "/api/users")?.searchParams.get("statuses")).toBe("Suspended|Inactive");
    await expect(page.getByRole("button", { name: /^Restricted accounts: 2.*Filtering/ })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("2 of 20 user accounts match the selected filters.")).toBeVisible();
    expect(last(seen, "/api/users/summary")?.searchParams.has("statuses")).toBe(false);

    await page.getByRole("button", { name: "Clear card selection" }).click();
    await expect.poll(() => last(seen, "/api/users")?.searchParams.has("statuses")).toBe(false);
    await expect(page.getByText("Pat Active")).toBeVisible();
  });

  test("KPI tooltips work by keyboard and touch, not only hover", async ({ page }) => {
    await mockApi(page, []);
    await page.goto("/portal/chairman/users");
    const info = page.getByRole("button", { name: "How Pending activation is calculated" });
    await info.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("note")).toContainText("not the membership-application status");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("note")).toHaveCount(0);
  });

  test("filters appear as removable chips, persist in the URL and survive a reload", async ({ page }) => {
    const seen: Seen = [];
    await mockApi(page, seen);
    await page.goto("/portal/chairman/users");

    await page.getByRole("button", { name: /More filters/ }).click();
    await page.getByRole("combobox", { name: /Member link/ }).click();
    await page.getByRole("option", { name: "Member account, not linked" }).click();
    await page.getByRole("combobox", { name: /Last login/ }).click();
    await page.getByRole("option", { name: "Not seen in the period" }).click();

    await expect(page.getByRole("list", { name: "Active filters" })).toContainText("Member account, not linked");
    await expect(page.getByRole("list", { name: "Active filters" })).toContainText("Last login more than 30 days ago");
    await expect.poll(() => last(seen, "/api/users")?.searchParams.get("memberLink")).toBe("unlinked");
    await expect.poll(() => last(seen, "/api/users")?.searchParams.get("lastLogin")).toBe("inactive");
    await expect(page).toHaveURL(/link=unlinked/);
    await expect(page).toHaveURL(/login=inactive/);

    await page.reload();
    await expect(page.getByRole("list", { name: "Active filters" })).toContainText("Member account, not linked");
    await expect.poll(() => last(seen, "/api/users")?.searchParams.get("memberLink")).toBe("unlinked");

    await page.getByRole("button", { name: "Remove filter: Member account, not linked" }).click();
    await expect.poll(() => last(seen, "/api/users")?.searchParams.has("memberLink")).toBe(false);
    await page.getByRole("button", { name: "Clear all" }).click();
    await expect(page.getByRole("list", { name: "Active filters" })).toHaveCount(0);
    await expect(page).not.toHaveURL(/login=/);
  });

  test("typing in search waits for a pause instead of calling the server on every key", async ({ page }) => {
    const seen: Seen = [];
    await mockApi(page, seen);
    await page.goto("/portal/chairman/users");
    await expect(page.getByText("Pat Active")).toBeVisible();
    const before = count(seen, "/api/users");

    await page.getByRole("searchbox", { name: "Search user accounts" }).pressSequentially("ana", { delay: 40 });
    await expect.poll(() => last(seen, "/api/users")?.searchParams.get("search")).toBe("ana");
    expect(count(seen, "/api/users") - before).toBeLessThanOrEqual(1);
  });

  test("a reversed date range in the address bar is ignored instead of emptying the list", async ({ page }) => {
    await mockApi(page, []);
    await page.goto("/portal/chairman/users?from=2026-02-01&to=2026-01-01");
    await expect(page.getByRole("list", { name: "Active filters" })).toHaveCount(0);
  });
});

test.describe("membership applications", () => {
  test("cards apply status groups and payment sub-stages, and requirements filter on the server", async ({ page }) => {
    const seen: Seen = [];
    await mockApi(page, seen);
    await page.goto("/portal/chairman/members");

    await expect(page.getByRole("button", { name: /^For review: 7/ })).toBeVisible();
    await expect(page.getByText("3 Required · 2 Confirmed")).toBeVisible();
    await expect(page.getByText("Currently approved applications")).toBeVisible();

    await page.getByRole("button", { name: /^For review: 7/ }).click();
    await expect.poll(() => last(seen, "/api/membership-applications")?.searchParams.get("statuses")).toBe("Submitted|Under Review");
    expect(last(seen, "/api/membership-applications/summary")?.searchParams.has("statuses")).toBe(false);

    await page.getByRole("button", { name: "Payment OK 2" }).click();
    await expect.poll(() => last(seen, "/api/membership-applications")?.searchParams.get("statuses")).toBe("Payment Confirmed");

    await page.getByRole("button", { name: "Clear card selection" }).click();
    await page.getByRole("button", { name: /More filters/ }).click();
    await page.getByRole("combobox", { name: /Requirements/ }).click();
    await page.getByRole("option", { name: "Requirements complete" }).click();
    await expect.poll(() => last(seen, "/api/membership-applications")?.searchParams.get("requirementCompletion")).toBe("complete");
    await expect(page.getByText("4 of 40 applications match the selected filters.")).toBeVisible();
    expect(last(seen, "/api/membership-applications/summary")?.searchParams.get("requirementCompletion")).toBe("complete");
    await expect(page).toHaveURL(/a_req=complete/);
  });

  test("changing a filter returns to page one and keeps the sort", async ({ page }) => {
    const seen: Seen = [];
    await mockApi(page, seen);
    await page.goto("/portal/chairman/members?a_sort=fullName&a_dir=asc");
    await expect(page.getByText("MEM-APP-1", { exact: true }).first()).toBeVisible();
    await page.getByRole("button", { name: "Go to next page" }).or(page.getByRole("button", { name: /next/i }).first()).click().catch(() => undefined);
    await page.getByRole("button", { name: /^For review: 7/ }).click();
    await expect.poll(() => last(seen, "/api/membership-applications")?.searchParams.get("page")).toBe("1");
    expect(last(seen, "/api/membership-applications")?.searchParams.get("sortBy")).toBe("fullName");
    expect(last(seen, "/api/membership-applications")?.searchParams.get("sortDirection")).toBe("asc");
  });

  test("a barangay chosen from the searchable list is sent to the server", async ({ page }) => {
    const seen: Seen = [];
    await mockApi(page, seen);
    await page.goto("/portal/chairman/members");
    await page.getByRole("button", { name: /More filters/ }).click();
    const barangay = page.getByRole("combobox", { name: "Barangay" });
    await barangay.click();
    await barangay.fill("aga");
    await page.getByRole("option", { name: "Aga" }).click();
    await expect.poll(() => last(seen, "/api/membership-applications")?.searchParams.get("barangay")).toBe("Aga");
    await expect(page.getByRole("list", { name: "Active filters" })).toContainText("Barangay: Aga");
  });
});

test.describe("member directory", () => {
  test("approved-only cards scope the list, and supporting counts narrow it further", async ({ page }) => {
    const seen: Seen = [];
    await mockApi(page, seen);
    await page.goto("/portal/chairman/members?tab=directory");

    await expect(page.getByRole("button", { name: /^Approved members: 9/ })).toBeVisible();
    await expect(page.getByText("66.7% of 9 approved members")).toBeVisible();
    await expect(page.getByText("55.6% of 9 approved members")).toBeVisible();

    await page.getByRole("button", { name: /^True members: 4/ }).click();
    await expect.poll(() => last(seen, "/api/members")?.searchParams.get("membershipType")).toBe("True Member");
    expect(last(seen, "/api/members")?.searchParams.get("approvalStatus")).toBe("Approved");
    await expect(page.getByText("4 of 30 member profiles match the selected filters.")).toBeVisible();
    expect(last(seen, "/api/members/summary")?.searchParams.has("membershipType")).toBe(false);

    await page.getByRole("button", { name: "No user account 3" }).click();
    await expect.poll(() => last(seen, "/api/members")?.searchParams.get("accountLink")).toBe("unlinked");
    await expect(page).toHaveURL(/d_account=unlinked/);
  });

  test("barangay options are de-duplicated and include records with no barangay", async ({ page }) => {
    await mockApi(page, []);
    await page.goto("/portal/chairman/members?tab=directory");
    const barangay = page.getByRole("combobox", { name: "Barangay" });
    await barangay.click();
    await expect(page.getByRole("option", { name: "Wawa" })).toHaveCount(1);
    await expect(page.getByRole("option", { name: "No barangay recorded" })).toBeVisible();
  });
});

test.describe("status history", () => {
  test("cards count events, apply a source, and range and actor filters reach the server", async ({ page }) => {
    const seen: Seen = [];
    await mockApi(page, seen);
    await page.goto("/portal/chairman/members?tab=history");

    await expect(page.getByRole("button", { name: /^Total status changes: 10/ })).toBeVisible();
    await expect(page.getByText("10 events across 7 records")).toBeVisible();

    await page.getByRole("button", { name: /^Linked account changes: 2/ }).click();
    await expect.poll(() => last(seen, "/api/members/status-history")?.searchParams.get("sourceModule")).toBe("Account");

    await page.getByRole("combobox", { name: /Date/ }).click();
    await page.getByRole("option", { name: "Last 7 days" }).click();
    await expect.poll(() => last(seen, "/api/members/status-history")?.searchParams.has("from")).toBe(true);
    const range = last(seen, "/api/members/status-history")!.searchParams;
    expect(range.get("to")! >= range.get("from")!).toBe(true);
    expect(last(seen, "/api/members/status-history/summary")?.searchParams.has("sourceModule")).toBe(false);

    await page.getByRole("button", { name: /More filters/ }).click();
    const actor = page.getByRole("combobox", { name: "Changed by" });
    await actor.click();
    await page.getByRole("option", { name: /No recorded actor/ }).click();
    await expect.poll(() => last(seen, "/api/members/status-history")?.searchParams.get("actorId")).toBe("none");
    await expect(page.getByText("“No recorded actor” means the system did not store who made the change")).toBeVisible();
    await expect(page).toHaveURL(/h_actor=none/);
    await expect(page).toHaveURL(/h_range=7d/);
  });

  test("each tab keeps its own filters when switching tabs", async ({ page }) => {
    await mockApi(page, []);
    await page.goto("/portal/chairman/members?a_status=Approved&h_source=Member&tab=history");
    await expect(page.getByRole("list", { name: "Active filters" })).toContainText("Source: Member");
    await page.getByRole("button", { name: "Applications", exact: true }).click();
    await expect(page.getByRole("list", { name: "Active filters" })).toContainText("Status: Approved");
    await page.getByRole("button", { name: "Status History", exact: true }).click();
    await expect(page.getByRole("list", { name: "Active filters" })).toContainText("Source: Member");
    await expect(page).toHaveURL(/a_status=Approved/);
  });
});

test.describe("responsive layout", () => {
  for (const width of [1440, 768, 390]) {
    test(`no horizontal page overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await mockApi(page, []);
      for (const path of ["/portal/chairman/users", "/portal/chairman/members", "/portal/chairman/members?tab=directory", "/portal/chairman/members?tab=history"]) {
        await page.goto(path);
        await expect(page.getByRole("region", { name: "Key figures" })).toBeVisible();
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
        expect(overflow, `${path} at ${width}px`).toBe(false);
      }
    });
  }
});
