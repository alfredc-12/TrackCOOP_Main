import { expect, test, type Page } from "@playwright/test";

async function openDashboard(page: Page) {
  const dashboard = page.getByRole("button", { name: "Dashboard", exact: true });
  if (!await dashboard.isVisible()) await page.getByRole("button", { name: "Open member menu", exact: true }).click();
  await dashboard.click();
  await expect(page.getByRole("button", { name: "View My Savings", exact: true })).toBeVisible();
}

async function fixture(page: Page, options: { truncated?: boolean; failSave?: boolean } = {}) {
  const writes: Record<string, unknown>[] = [];
  let needsReview = true;
  let livelihoods = [{ activity: "Rice" }, { activity: "Poultry" }];
  await page.setExtraHTTPHeaders({ "x-trackcoop-internal-rewrite": "1" });
  await page.route("https://raw.githubusercontent.com/**", route => route.fulfill({ json: { RECORDS: [] } }));
  await page.route("**/api/**", async route => {
    const request = route.request(), url = new URL(request.url());
    const envelope = (data: unknown) => ({ success: true, data });
    if (request.method() === "PUT" && url.pathname === "/api/members/me/profile") {
      const input = request.postDataJSON();
      writes.push(input);
      if (options.failSave) return route.fulfill({ status: 500, json: { error: "Synthetic save failed. Your original details are preserved." } });
      if (input.livelihoods) { livelihoods = input.livelihoods; needsReview = false; }
      return route.fulfill({ json: { success: true } });
    }
    if (request.method() !== "GET") throw new Error(`Unexpected mocked mutation: ${url.pathname}`);
    if (url.pathname === "/api/auth/me") return route.fulfill({ json: envelope({ id: "7", displayName: "Review Member", email: "member@example.invalid", role: "member" }) });
    if (url.pathname === "/api/members/me/profile") return route.fulfill({ json: {
      occupation: "Farmer", contact_number: "09000000000", email: "member@example.invalid", livelihoods,
      livelihoodsReview: needsReview ? { issues: ["Entry 1 (Rice) needs its sowing date corrected. No date has been assumed."], original: '[{"activity":"Rice","plantingDate":"2099-01-01"}, {"activity":"Poultry","note":"<script>unsafe</script>"}]', truncated: options.truncated ?? false } : undefined,
    } });
    if (url.pathname === "/api/members/me/dashboard") return route.fulfill({ json: {
      isLinked: true, membershipType: "True Member", canAccessFinancials: true,
      member: { code: "REVIEW-7", livelihoods, livelihoodsUnavailable: needsReview, occupation: "Farmer", memberSince: "2020-01-01" },
      shareCapital: { total: 3000 }, recentActivity: [], recentCapitalContributions: [], unreadUpdates: {},
      stats: { announcements: 0, purchases: 1, deposits: 1, rentals: 0 }, referrals: { code: "REF-7", items: [] }, memberFinancialSummary: null,
    } });
    if (url.pathname === "/api/members/me/membership-progress") return route.fulfill({ json: envelope({ membershipType: "True Member", sectors: [], capital: null, validatedCapital: 3000 }) });
    return route.fulfill({ json: envelope([]) });
  });
  await page.goto("/member_dashboard");
  await page.getByRole("button", { name: "Review livelihood details", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Review your saved livelihood details" })).toBeVisible();
  return writes;
}

for (const width of [1440, 768, 390]) {
  test(`member reviews and repairs saved livelihoods at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 1000 });
    const writes = await fixture(page);
    await expect(page.getByRole("checkbox", { name: "Poultry", exact: true })).toBeChecked();
    await expect(page.getByLabel("Rice sowing date", { exact: true })).toHaveValue("");
    await page.getByText("Original saved details", { exact: true }).focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("pre")).toContainText("2099-01-01");
    await expect(page.locator("pre script")).toHaveCount(0);
    await page.screenshot({ path: info.outputPath(`livelihood-review-${width}.png`), fullPage: true });
    await page.getByLabel("Rice sowing date", { exact: true }).fill("2020-01-01");
    await page.getByRole("button", { name: "Save Changes", exact: true }).click();
    await expect(page.getByRole("alert").filter({ hasText: "confirm the corrected list" })).toBeVisible();
    expect(writes).toHaveLength(0);
    await page.getByRole("checkbox", { name: "I reviewed the original details", exact: false }).check();
    await page.getByRole("button", { name: "Save Changes", exact: true }).click();
    await expect(page.getByText("Your profile changes have been saved.", { exact: true })).toBeVisible();
    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatchObject({ confirmLivelihoodsRepair: true, livelihoods: [{ activity: "Rice", plantingDate: "2020-01-01" }, { activity: "Poultry" }] });
    await expect(page.getByRole("heading", { name: "Review your saved livelihood details" })).toHaveCount(0);
    await expect(page.getByRole("status").filter({ hasText: "Some saved crop" })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath(`livelihood-repaired-${width}.png`), fullPage: true });
    await openDashboard(page);
    await expect(page.getByRole("status").filter({ hasText: "Some saved crop" })).toHaveCount(0);
  });
}

test("contact-only save leaves the original livelihood record unchanged", async ({ page }) => {
  const writes = await fixture(page);
  await page.getByLabel("Contact Number", { exact: true }).fill("09111111111");
  await page.getByRole("button", { name: "Save Changes", exact: true }).click();
  await expect(page.getByText("The original livelihood details are preserved and still need review.", { exact: false })).toBeVisible();
  expect(writes).toHaveLength(1);
  expect(writes[0]).not.toHaveProperty("livelihoods");
  expect(writes[0]).not.toHaveProperty("confirmLivelihoodsRepair");
  await expect(page.getByRole("heading", { name: "Review your saved livelihood details" })).toBeVisible();
  await openDashboard(page);
  await expect(page.getByRole("button", { name: "Review livelihood details", exact: true })).toBeVisible();
});

test("shortened original preview cannot authorize replacement", async ({ page }) => {
  const writes = await fixture(page, { truncated: true });
  await expect(page.getByRole("checkbox", { name: "I reviewed the original details", exact: false })).toBeDisabled();
  await page.getByLabel("Rice sowing date", { exact: true }).fill("2020-01-01");
  await page.getByRole("button", { name: "Save Changes", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "confirm the corrected list" })).toBeVisible();
  expect(writes).toHaveLength(0);
});

test("failed repair preserves the editable form and original details", async ({ page }) => {
  await fixture(page, { failSave: true });
  await page.getByLabel("Rice sowing date", { exact: true }).fill("2020-01-01");
  await page.getByRole("checkbox", { name: "I reviewed the original details", exact: false }).check();
  await page.getByRole("button", { name: "Save Changes", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Synthetic save failed" })).toBeVisible();
  await expect(page.getByLabel("Rice sowing date", { exact: true })).toHaveValue("2020-01-01");
  await expect(page.getByRole("heading", { name: "Review your saved livelihood details" })).toBeVisible();
});
