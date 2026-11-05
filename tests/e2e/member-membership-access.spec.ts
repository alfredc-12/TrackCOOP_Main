import { expect, test, type Page } from "@playwright/test";
import { applicationSummaryFixture, historySummaryFixture, memberSummaryFixture } from "../../server/src/modules/people-test-fixtures";
async function setup(page: Page, trueMember = false, validatedCapital = 0) {
  // Exercise the dashboard itself; canonical-route authentication is checked separately against the running API.
  await page.setExtraHTTPHeaders({ "x-trackcoop-internal-rewrite": "1" });
  let pending = false;
  const financialCalls: string[] = [];
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const envelope = (data: unknown) => ({ success: true, data, message: "ok", meta: {} });
    if (path === "/api/auth/me") return route.fulfill({ json: envelope({ id: "7", displayName: "Test Member", email: "member@example.test", username: null, role: "member" }) });
    if (path === "/api/members/me/dashboard") return route.fulfill({ json: {
      isLinked: true, membershipType: trueMember ? "True Member" : "Associate", canAccessFinancials: trueMember,
      member: { code: "TEST-7", occupation: "Farmer", livelihoods: [], memberSince: "2026-01-01" },
      shareCapital: trueMember ? { total: 3000 } : null, stats: { deposits: 1, purchases: 0, rentals: 0, announcements: 0 },
      recentActivity: [], recentCapitalContributions: [], financialTransparency: trueMember ? { incomeByCategory: [], expenseByCategory: [] } : null,
      memberFinancialSummary: trueMember ? { incomeByCategory: [], expenseByCategory: [], transactions: [] } : null,
    } });
    if (path === "/api/members/me/true-membership") {
      if (route.request().method() === "POST") { pending = true; return route.fulfill({ status: 201, json: { success: true } }); }
      return route.fulfill({ json: { membershipType: trueMember ? "True Member" : "Associate", application: pending ? { status: "Pending" } : null, requirements: { fullRequirement: 3000, validatedTotal: validatedCapital, remainingToFull: Math.max(0, 3000 - validatedCapital), fullRequirementMet: validatedCapital >= 3000, maximumAllowed: 15000 } } });
    }
    if (path.includes("/dividends") || path.includes("/patronage")) financialCalls.push(path);
    if (path === "/api/members/me/patronage") return route.fulfill({ json: envelope({ refunds: { allocatedTotal: 0, paidTotal: 0, pendingTotal: 0 } }) });
    return route.fulfill({ json: envelope([]) });
  });
  return { financialCalls };
}

for (const width of [1440, 390]) {
  test(`associate hides financial tabs and submits one pending application at ${width}px`, async ({ page }) => {
    const { financialCalls } = await setup(page);
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/member_dashboard");
    await expect(page.getByText("Associate Member", { exact: true }).last()).toBeVisible();
    await expect(page.getByRole("heading", { name: "My Share Capital Progress" })).toBeVisible();
    await expect(page.getByRole("progressbar")).toHaveAttribute("value", "0");
    await expect(page.getByRole("button", { name: "Financial", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Member & Share", exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Apply for True Membership", exact: true }).first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Apply for True Membership" })).toBeVisible();
    await dialog.getByLabel("Application message").fill("I would like to apply for True Membership.");
    await dialog.getByRole("button", { name: "Submit Application" }).click();
    await expect(dialog.getByRole("status")).toContainText("Application Pending");
    await expect(dialog.getByRole("button", { name: "Submit Application" })).toHaveCount(0);
    await page.getByRole("button", { name: "Close modal", exact: true }).last().click();
    await expect(page.getByRole("button", { name: "Application Pending", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "View My Savings" })).toHaveCount(0);
    expect(financialCalls).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

for (const capital of [2250, 3000, 3500]) {
  test(`associate sees validated capital and review readiness at ${capital}`, async ({ page }) => {
    await setup(page, false, capital);
    await page.goto("/member_dashboard");
    const progressCard = page.getByRole("region", { name: "My Share Capital Progress" });
    await expect(progressCard.getByRole("progressbar")).toHaveAttribute("value", String(Math.min(capital, 3000)));
    await expect(progressCard).toContainText(capital.toLocaleString("en-PH", { style: "currency", currency: "PHP" }));
    if (capital < 3000) await expect(progressCard).toContainText("₱750.00 more to reach the capital requirement");
    else await expect(progressCard).toContainText("Capital requirement met — eligible for True Membership review");
    await expect(progressCard).toContainText("True Membership requires chairman approval.");
    await expect(page.getByRole("button", { name: "Financial", exact: true })).toHaveCount(0);
  });
}

test("True Members retain both financial tabs", async ({ page }) => {
  await setup(page, true);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/member_dashboard");
  await expect(page.getByText("True Member", { exact: true }).last()).toBeVisible();
  await expect(page.getByRole("button", { name: "Apply for True Membership", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Financial", exact: true }).filter({ visible: true }).click();
  await expect(page.getByRole("heading", { name: "Your money at a glance" })).toBeVisible();
  await page.getByRole("button", { name: "Member & Share", exact: true }).filter({ visible: true }).click();
  await expect(page.getByRole("heading", { name: "Your capital and member benefits" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("chairman reviews and approves an existing associate upgrade", async ({ page }) => {
  await page.setExtraHTTPHeaders({ "x-trackcoop-internal-rewrite": "1" });
  let pending = true;
  let decision: unknown;
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const envelope = (data: unknown) => ({ success: true, data, message: "ok", meta: { total: 0, page: 1, pageSize: 10 } });
    if (path === "/api/auth/me") return route.fulfill({ json: envelope({ id: "9", displayName: "Chairman", role: "chairman", email: "chairman@example.test" }) });
    if (path === "/api/membership-upgrades") return route.fulfill({ json: pending ? [{ id: "1", memberId: "7", fullName: "Associate Test", memberCode: "ASSOC-7", message: "Please review my True Membership application.", createdAt: "2026-11-05", requirements: { validatedTotal: 3000, fullRequirement: 3000 } }] : [] });
    if (path === "/api/membership-upgrades/1/decision") {
      decision = route.request().postDataJSON(); pending = false;
      return route.fulfill({ json: { success: true } });
    }
    if (path === "/api/members/summary") return route.fulfill({ json: envelope(memberSummaryFixture()) });
    if (path === "/api/membership-applications/summary") return route.fulfill({ json: envelope(applicationSummaryFixture()) });
    if (path === "/api/members/status-history/summary") return route.fulfill({ json: envelope(historySummaryFixture()) });
    return route.fulfill({ json: envelope([]) });
  });
  await page.goto("/chairman/members");
  await page.getByRole("button", { name: "Review application", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Validated Share Capital:", { exact: false })).toBeVisible();
  await dialog.getByLabel("Decision reason").fill("Capital and membership requirements verified.");
  await dialog.getByRole("button", { name: "Approve True Membership" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "True Membership Applications (0)" })).toBeVisible();
  expect(decision).toEqual({ decision: "Approved", reason: "Capital and membership requirements verified." });
});
