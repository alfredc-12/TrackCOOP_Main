import { expect, test, type Page } from "@playwright/test";
import { categories, definitions } from "../../server/src/modules/system-settings/settings.registry";

const envelope = (data: unknown) => ({ success: true, data, message: "Patronage UI fixture", meta: {} });
const settings = () => ({ categories, settings: definitions.map((definition) => ({ ...definition, id: null, value: definition.fallback, source: "default", revision: "a".repeat(64), updatedAt: null })), technical: [], participationStatuses: ["Participated"] });

async function fixture(page: Page, handle: (path: string, method: string, body: unknown) => unknown, role = "chairman") {
  await page.setExtraHTTPHeaders({ "x-trackcoop-internal-rewrite": "1" });
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === "/api/auth/me") return route.fulfill({ json: envelope({ id: "ui-fixture", displayName: "Policy review", username: "review", email: "review@example.invalid", role }) });
    const result = handle(path, request.method(), request.postDataJSON());
    if (result !== undefined) return route.fulfill({ json: envelope(result) });
    // No unhandled request, including a write, reaches the real API.
    return route.fulfill({ status: 503, json: { success: false, message: "Unavailable UI fixture", errors: [] } });
  });
}

for (const width of [1440, 768, 390]) {
  test(`patronage policy follows share capital and fits at ${width}px`, async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await fixture(page, (path) => path === "/api/system-settings/catalog" ? settings() : undefined);
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/chairman/settings");
    const tabs = page.getByRole("tab");
    await expect(tabs.nth(1)).toHaveText("Share Capital Policy");
    await expect(tabs.nth(2)).toHaveText("Patronage Refund Policy");
    await tabs.nth(2).click();
    await expect(page.getByRole("heading", { name: "Patronage Refund Policy", exact: true })).toBeVisible();
    await expect(page.getByRole("spinbutton", { name: "Patronage allocation (%)" })).toHaveValue("30");
    await expect(page.getByRole("spinbutton", { name: "Member rental refund rate (%)" })).toHaveValue("3");
    await expect(page.getByRole("tabpanel").getByRole("spinbutton")).toHaveCount(2);
    await expect(page.getByRole("tabpanel").getByRole("table")).toHaveCount(0);
    await expect(page.getByText("How the refund is calculated", { exact: true })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const panel = await page.getByRole("tabpanel").boundingBox();
    expect(panel).not.toBeNull();
    expect(panel!.x + panel!.width).toBeLessThanOrEqual(width);
    expect(panel!.height).toBeLessThan(800);
    await page.screenshot({ path: testInfo.outputPath(`policy-${width}.png`), fullPage: true });
    expect(errors).toEqual([]);
  });
}

test("patronage allocation validates, reviews and saves through the existing settings flow", async ({ page }) => {
  let catalog = settings();
  const writes: unknown[] = [];
  await fixture(page, (path, method, body) => {
    if (path === "/api/system-settings/catalog") return catalog;
    if (path === "/api/system-settings/batch" && method === "PUT") {
      writes.push(body);
      const changes = (body as { changes: Array<{ key: string; value: number }> }).changes;
      catalog = { ...catalog, settings: catalog.settings.map((entry) => changes.some((change) => change.key === entry.key) ? { ...entry, value: changes.find((change) => change.key === entry.key)!.value, source: "saved" } : entry) };
      return catalog;
    }
    return undefined;
  });
  await page.goto("/chairman/settings");
  await page.getByRole("tab", { name: "Patronage Refund Policy", exact: true }).click();
  const field = page.getByRole("spinbutton", { name: "Patronage allocation (%)" });
  await field.fill("29");
  await page.getByRole("button", { name: "Review & save" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "from 30 to 100" })).toBeVisible();
  expect(writes).toHaveLength(0);
  await field.fill("40");
  const memberRate = page.getByRole("spinbutton", { name: "Member rental refund rate (%)" });
  await memberRate.fill("0");
  await page.getByRole("button", { name: "Review & save" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "greater than 0" })).toBeVisible();
  expect(writes).toHaveLength(0);
  await memberRate.fill("4.25");
  await page.getByRole("button", { name: "Review & save" }).click();
  const dialog = page.getByRole("dialog", { name: "Confirm settings changes" });
  await expect(dialog).toContainText("Patronage allocation");
  await dialog.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Settings saved" })).toBeVisible();
  expect(writes).toEqual([{ changes: [{ key: "patronage.allocation_rate", value: 40, expectedRevision: "a".repeat(64) }, { key: "patronage.member_refund_rate", value: 4.25, expectedRevision: "a".repeat(64) }] }]);
});

test("annual form keeps the configured member rate when the funding pool changes", async ({ page }, testInfo) => {
  let created: Record<string, unknown> | null = null;
  const period = { id: "fixture-period", name: "Fixture annual refund", startDate: "2025-01-01", endDate: "2025-12-31", policyVersion: "RentalConfiguredAnnual", netSurplus: 150000, statutoryReserves: 50000, allocationRate: 30, refundPool: 30000, refundRate: 3, status: "Draft", totalPatronage: 0, memberCount: 0, paidCount: 0 };
  await fixture(page, (path, method, body) => {
    if (path === "/api/patronage") return { periods: created ? [period] : [], selectedPeriod: created ? period : null, allocations: [] };
    if (path === "/api/patronage/capital-transfers") return [];
    if (path === "/api/patronage/financial-basis") return { allocationRate: 30, memberRefundRate: 3, estimatedRefund: 30000, eligibleMemberPatronage: 1000000, eligibleMemberCount: 3 };
    if (path === "/api/patronage/periods" && method === "POST") { created = body as Record<string, unknown>; return period; }
    return undefined;
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/chairman/patronage");
  await page.getByRole("button", { name: "New yearly period", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "New yearly patronage period" });
  const submit = dialog.getByRole("button", { name: "Create yearly period", exact: true });
  await expect(submit).toBeDisabled();
  await dialog.getByRole("spinbutton", { name: "Reviewed rental business net surplus (PHP)" }).fill("150000");
  await dialog.getByRole("spinbutton", { name: "Applicable statutory funds / reserves (PHP)" }).fill("50000");
  await expect(dialog).toContainText("₱30,000.00");
  await expect(dialog).toContainText("Member refund rate: 3.00%");
  await dialog.getByRole("spinbutton", { name: "Reviewed rental business net surplus (PHP)" }).fill("250000");
  await expect(dialog).toContainText("₱60,000.00");
  await expect(dialog).toContainText("Member refund rate: 3.00%");
  await dialog.getByRole("spinbutton", { name: "Reviewed rental business net surplus (PHP)" }).fill("150000");
  expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("annual-form-mobile.png"), fullPage: true });
  await submit.click();
  await expect(dialog).not.toBeVisible();
  expect(created).toMatchObject({ netSurplus: 150000, statutoryReserves: 50000, refundPool: 30000 });
});

test("member screen does not promise a fixed refund before an annual financial basis exists", async ({ page }) => {
  await fixture(page, (path) => path === "/api/members/me/patronage" ? {
    member: { code: "M-FIXTURE", name: "Vince", membershipType: "True Member", eligible: true, trueMemberSince: "2025-01-01" },
    currentYear: { startDate: "2026-01-01", endDate: "2026-12-31", totalPatronage: 1000, estimateAvailable: false },
    refunds: { allocatedTotal: 0, paidTotal: 0, pendingTotal: 0 }, history: [],
  } : undefined, "member");
  await page.route("**/api/members/me/dashboard**", (route) => route.fulfill({ json: { canAccessFinancials: true, membershipType: "True Member", isLinked: true, member: { fullName: "Vince", memberSince: "2025-01-01" }, shareCapital: { total: 15000 }, stats: {}, recentCapitalContributions: [] } }));
  await page.goto("/member_dashboard");
  await page.getByRole("button", { name: "Member & Share", exact: true }).click();
  await page.getByRole("button", { name: "View refund details", exact: true }).click();
  await expect(page.getByText("Awaiting financial basis", { exact: true })).toBeVisible();
  await expect(page.getByText("Your yearly 3% refund", { exact: false })).toHaveCount(0);
});
