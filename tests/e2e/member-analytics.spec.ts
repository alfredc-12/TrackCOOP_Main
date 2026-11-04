import {createFinancialAnalyticsEngine} from "../../server/src/modules/financial-analytics/financial-analytics.engine";
import {closeAllTime,parseFinancialAnalyticsFilters} from "../../server/src/modules/financial-analytics/financial-analytics.filters";
import {fixtureSources} from "../../server/src/modules/financial-analytics/financial-analytics.test-fixture";
import { expect, test, type Page } from "@playwright/test";
import { analyticsFixture, fixtureFilters } from "../../server/src/modules/member-analytics/member-analytics.test-fixture";
import { createAnalyticsEngine } from "../../server/src/modules/member-analytics/member-analytics.engine";
import { parseAnalyticsFilters } from "../../server/src/modules/member-analytics/member-analytics.filters";

const envelope = (data: unknown, meta = {}) => ({ success: true, data, message: "Analytics test fixture", meta });
async function setup(page: Page, options: { fail?: boolean; empty?: boolean } = {}) {
  const requests: URL[] = [];
  await page.setExtraHTTPHeaders({ "x-trackcoop-internal-rewrite": "1" });
  // This suite supplies auth at the browser boundary; retain canonical links while
  // requesting the corresponding internal Next route without a real server session.
  await page.route("**/portal/chairman/**", route => route.continue({ url: route.request().url().replace("/portal/chairman/", "/chairman/") }));
  await page.route("**/api/**", route => {
    const url = new URL(route.request().url());
    if (route.request().method() !== "GET") throw new Error("Analytics browser tests must not mutate application data");
    if (url.pathname === "/api/maps/nasugbu") return route.continue();
    if (url.pathname === "/api/auth/me") return route.fulfill({ json: envelope({ id: "analytics-review", displayName: "Analytics Review", email: "review@example.invalid", username: "review", role: "chairman" }) });
    if (url.pathname === "/api/chairman/member-analytics") {
      requests.push(url);
      if (options.fail && requests.length === 1) return route.fulfill({ status: 503, json: { success: false, message: "Analytics fixture temporarily unavailable", errors: [] } });
      const filters = parseAnalyticsFilters(Object.fromEntries(url.searchParams));
      const source = analyticsFixture(); if (options.empty) source.members = [];
      return route.fulfill({ json: envelope(createAnalyticsEngine(source, filters, "2026-11-02T06:00:00Z").result) });
    }
    if (url.pathname === "/api/chairman/member-analytics/export") return route.fulfill({ contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", headers: { "content-disposition": 'attachment; filename="analytics-test.xlsx"' }, body: "Browser fixture download; actual OOXML validated in API tests" });
    if (url.pathname === "/api/chairman/member-analytics/matching-members") return route.fulfill({ json: envelope([], { total: 0, page: 1, pageSize: 10 }) });
    if (url.pathname === "/api/members/summary") return route.fulfill({ json: envelope({ total: 5, pendingApproval: 0, approved: 5, associate: 2, trueMember: 3, active: 5, inactive: 0, suspended: 0 }) });
    return route.fulfill({ json: envelope([], { total: 0, page: 1, pageSize: 10 }) });
  });
  await page.route("https://*.tile.openstreetmap.org/**", route => route.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#eef2ec"/></svg>' }));
  return { requests };
}
const path = `/chairman/dashboard?start=${fixtureFilters.start}&end=${fixtureFilters.end}&asOf=${fixtureFilters.asOf}`;
for (const width of [1440, 1024, 768, 390]) test(`analytics layout, detail drawer, left matrix and map work at ${width}px`, async ({ page }, info) => {
  const errors: string[] = []; page.on("pageerror", e => errors.push(e.message));
  await setup(page); await page.setViewportSize({ width, height: 1000 }); await page.goto(path);
  const kpis = page.getByRole("region", { name: "Membership performance KPIs" });
  await expect(kpis.getByRole("button")).toHaveCount(6);
  await expect(kpis.getByRole("button", { name: /^Approved members/ }).locator("strong")).toHaveText("5");
  await expect(kpis.getByRole("button", { name: /^Approved members/ })).toHaveAttribute("data-tone", "good");
  await expect(kpis.getByRole("button", { name: /^First 90-day participation/ })).toHaveAttribute("data-tone", "warning");
  await expect(kpis.getByRole("button", { name: /^Members needing attention/ })).toHaveAttribute("data-tone", "danger");
  await expect(kpis.locator("svg[aria-hidden='true']")).toHaveCount(12);
  if (width >= 901) {
    for (const [first, second] of [
      ["Membership growth", "Member engagement"],
      ["Share-capital health", "Agricultural sectors"],
      ["Recruitment performance", "Member referrals"],
    ]) {
      const firstCard = page.locator("section").filter({ has: page.getByRole("heading", { name: first, exact: true }) });
      const secondCard = page.locator("section").filter({ has: page.getByRole("heading", { name: second, exact: true }) });
      const firstBox = await firstCard.boundingBox();
      const secondBox = await secondCard.boundingBox();
      expect(Math.abs(firstBox!.y + firstBox!.height - secondBox!.y - secondBox!.height)).toBeLessThan(2);
    }
    const sectors = page.locator("section").filter({ has: page.getByRole("heading", { name: "Agricultural sectors", exact: true }) });
    const sectorBottom = await sectors.boundingBox();
    const sectorLastLine = await sectors.getByText("0 without a listed primary sector", { exact: true }).boundingBox();
    expect(sectorBottom!.y + sectorBottom!.height - sectorLastLine!.y - sectorLastLine!.height).toBeLessThan(35);
    const engagement = page.locator("section").filter({ has: page.getByRole("heading", { name: "Member engagement", exact: true }) });
    const engagementBottom = await engagement.boundingBox();
    const cohortAction = await engagement.getByRole("button", { name: "View 30 / 60 / 90-day cohorts", exact: true }).boundingBox();
    expect(engagementBottom!.y + engagementBottom!.height - cohortAction!.y - cohortAction!.height).toBeLessThan(35);
    const donut = await engagement.getByRole("img", { name: /Active:/ }).boundingBox();
    const activeRow = await engagement.getByRole("button", { name: /^Active/ }).boundingBox();
    expect(activeRow!.x).toBeGreaterThanOrEqual(donut!.x + donut!.width - 1);
    const capital = page.locator("section").filter({ has: page.getByRole("heading", { name: "Share-capital health", exact: true }) });
    if (width === 1440) expect((await capital.boundingBox())!.height).toBeLessThan(520);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath(`analytics-${width}.png`), fullPage: true });
  const attention = kpis.getByRole("button", { name: /^Members needing attention/ }); await attention.click();
  const drawer = page.getByRole("dialog", { name: "Members needing attention", exact: true });
  await expect(drawer).toBeVisible(); await expect(drawer.getByRole("link", { name: "View all members needing attention" })).toHaveAttribute("href", /selection=attention/);
  await page.keyboard.press("Escape"); await expect(drawer).toHaveCount(0); await expect(attention).toBeFocused();
  await page.getByRole("button", { name: "View 30 / 60 / 90-day cohorts", exact: true }).click();
  await expect(page.getByRole("region", { name: "Mature participation cohorts", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Close analytics details", exact: true }).click();
  const map = page.getByRole("region", { name: "Nasugbu member distribution map", exact: true });
  await expect(map.locator('path[role="button"]')).toHaveCount(42);
  const compare = page.getByRole("button", { name: "Compare Barangays & Sectors", exact: true });
  await compare.click();
  const matrix = page.getByRole("dialog", { name: "Compare Barangays & Sectors", exact: true });
  await expect(matrix).toBeVisible();
  await expect.poll(async () => Math.round((await matrix.boundingBox())!.x)).toBe(0);
  await matrix.getByRole("textbox", { name: "Search barangays", exact: true }).fill("Aga");
  await matrix.getByRole("button", { name: /^Aga, Rice:/ }).click();
  await expect(matrix.getByRole("link", { name: "View Aga / Rice members", exact: true })).toHaveAttribute("href", /selection=barangay.*value=Aga.*cellSector=Rice/);
  await matrix.getByRole("combobox", { name: "Matrix metric", exact: true }).click();
  await page.getByRole("option", { name: "% barangay members", exact: true }).click();
  await expect(matrix.getByRole("button", { name: /^Aga, Rice:/ })).toContainText("50%");
  await matrix.screenshot({ path: info.outputPath(`matrix-${width}.png`) });
  await page.keyboard.press("Escape"); await expect(compare).toBeFocused();
  await expect(map.getByRole("button", { name: "Aga, 2 members", exact: true })).toHaveAttribute("stroke", "#123d2a");
  await page.getByRole("combobox", { name: "Find a barangay", exact: true }).click();
    await page.getByRole("option", { name: "Aga", exact: true }).click();
  await expect(page.getByRole("region", { name: "Aga member details", exact: true })).toContainText("True Members");
  expect(errors).toEqual([]);
});
test("filters wait for Apply, persist in URL, remove chips and restore on browser Back", async ({ page }) => {
  const { requests } = await setup(page); await page.goto(path);
  await expect(page.getByText("5 matching approved members", { exact: true })).toBeVisible();
  const before = requests.length;
  await page.getByRole("checkbox", { name: "Corn", exact: true }).check();
  await page.getByRole("combobox", { name: "Barangays", exact: true }).fill("A");
  expect(requests.length).toBe(before);
  await page.getByRole("button", { name: "Apply filters", exact: true }).click();
  await expect(page).toHaveURL(/sectors=Corn/);
  await expect(page.getByText("1 matching approved members", { exact: true })).toBeVisible();
  await page.reload(); await expect(page.getByRole("checkbox", { name: "Corn", exact: true })).toBeChecked();
  await page.getByRole("button", { name: "Remove Corn filter", exact: true }).click();
  await expect(page.getByText("5 matching approved members", { exact: true })).toBeVisible();
  await page.goBack(); await expect(page.getByText("1 matching approved members", { exact: true })).toBeVisible();
});
test("failed report retries, empty results are honest, export downloads and details stay read-only", async ({ page }) => {
  await setup(page, { fail: true, empty: true }); await page.goto(path);
  await expect(page.getByRole("alert").filter({ hasText: "temporarily unavailable" })).toBeVisible();
  await page.getByRole("button", { name: "Retry analytics", exact: true }).click();
  await expect(page.getByText(/No members match these filters/)).toBeVisible();
  await expect(page.getByRole("button", { name: /^Membership growth/ }).locator("strong")).toHaveText("N/A");
  await expect(page.getByRole("button", { name: /^Membership growth/ })).toHaveAttribute("data-tone", "neutral");
  await expect(page.getByRole("button", { name: /^True Member capital complete/ })).toHaveAttribute("data-tone", "neutral");
  const download = page.waitForEvent("download"); await page.getByRole("button", { name: "Export Excel", exact: true }).click();
  expect((await download).suggestedFilename()).toBe("member-analytics-2026-11-02.xlsx");
});
test("management drill-down opens the existing directory with analytics context", async ({ page }) => {
  await setup(page); await page.goto(path);
  await page.getByRole("button", { name: /^Members needing attention/ }).click();
  await page.getByRole("link", { name: "View all members needing attention", exact: true }).click();
  await expect(page).toHaveURL(/chairman\/members\?.*analytics=1/);
  await expect(page.getByText(/Member analytics selection applied/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Create Manual Member", exact: true })).toBeVisible();
});

test("financial analytics uses its own endpoint and does not use member analytics", async ({ page }) => {
  const { requests } = await setup(page);
  let financialRequests = 0;
  await page.route("**/api/chairman/financial-analytics?*", route => {
    financialRequests++;
    const now=new Date("2026-11-02T01:00:00Z");const data=fixtureSources();
    const filters=closeAllTime(parseFinancialAnalyticsFilters(Object.fromEntries(new URL(route.request().url()).searchParams),now),data.firstRecordDate);
    return route.fulfill({json:envelope(createFinancialAnalyticsEngine(data,filters,now).result)});
  });
  await page.goto("/chairman/financial-dashboard");
  await expect(page.getByRole("heading", { name: "Financial analytics", exact: true })).toBeVisible();
  expect(financialRequests).toBeGreaterThan(0); expect(requests.length).toBe(0);
});

test("expanded map works without native fullscreen and returns keyboard focus on Escape", async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(Element.prototype, "requestFullscreen", { value: undefined, configurable: true }));
  await setup(page); await page.goto(path);
  const map = page.getByRole("region", { name: "Nasugbu member distribution map", exact: true });
  await expect(map.locator('path[role="button"]')).toHaveCount(42);
  await page.getByRole("button", { name: "Expand map to fullscreen", exact: true }).click();
  const expanded = page.getByRole("dialog", { name: "Expanded barangay map", exact: true });
  await expect(expanded).toBeVisible();
  await expect(expanded.locator('path[role="button"]')).toHaveCount(42);
  await page.keyboard.press("Escape");
  await expect(expanded).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Expand map to fullscreen", exact: true })).toBeFocused();
});

test("chart selections open the corresponding period, sector, capital and RFM details", async ({ page }) => {
  await setup(page); await page.goto(path);
  await expect(page.getByRole("region", { name: "Membership performance KPIs" })).toBeVisible();
  const sector = page.locator("section").filter({ has: page.getByRole("heading", { name: "Agricultural sectors", exact: true }) });
  await sector.locator(".recharts-bar-rectangle").first().click();
  let drawer = page.getByRole("dialog", { name: "Sector composition", exact: true });
  await expect(drawer.getByText(/Selected: Rice/)).toBeVisible();
  await expect(drawer.getByRole("region", { name: "Sector growth and capital", exact: true }).getByRole("row")).toHaveCount(2);
  await page.keyboard.press("Escape");
  const growth = page.locator("section").filter({ has: page.getByRole("heading", { name: "Membership growth", exact: true }) });
  await growth.locator(".recharts-bar-rectangle").first().click();
  drawer = page.getByRole("dialog", { name: "Membership growth", exact: true });
  await expect(drawer.getByText(/Selected: 2026-01/)).toBeVisible();
  await expect(drawer.getByRole("region", { name: "Monthly membership growth", exact: true }).getByRole("row")).toHaveCount(2);
  await page.keyboard.press("Escape");
  const capital = page.locator("section").filter({ has: page.getByRole("heading", { name: "Share-capital health", exact: true }) });
  await capital.locator(".recharts-bar-rectangle").first().click();
  await expect(page.getByRole("dialog", { name: "Share-capital health", exact: true }).getByText(/Selected: Zero balance/)).toBeVisible();
  await page.keyboard.press("Escape");
  const engagement = page.locator("section").filter({ has: page.getByRole("heading", { name: "Member engagement", exact: true }) });
  await engagement.locator(".recharts-pie-sector").first().click();
  await expect(page.getByRole("dialog", { name: "Engagement and participation", exact: true }).getByText(/Selected: Active/)).toBeVisible();
});

test("custom analytics comboboxes preserve empty filter values and searchable barangay selection", async ({ page }, info) => {
  const { requests } = await setup(page); await page.goto(path);
  await expect(page.getByText("5 matching approved members", { exact: true })).toBeVisible();
  // Radix may retain an invisible native select for form autofill; no native menu is visible.
  await expect(page.locator("main select:not([aria-hidden='true']), main datalist")).toHaveCount(0);
  const engagement = page.getByRole("combobox", { name: "RFM engagement", exact: true });
  const initialRequests = requests.length;
  await engagement.click();
  await page.getByRole("listbox").screenshot({ path: info.outputPath("custom-combobox.png") });
  await page.getByRole("option", { name: "Inactive", exact: true }).click();
  await expect(engagement).toBeFocused();
  expect(requests.length).toBe(initialRequests);
  await page.getByRole("button", { name: "Apply filters", exact: true }).click();
  await expect(page).toHaveURL(/engagement=Inactive/);
  await expect(page.getByText("1 matching approved members", { exact: true })).toBeVisible();
  await engagement.click(); await page.getByRole("option", { name: "All engagement labels", exact: true }).click();
  await page.getByRole("button", { name: "Apply filters", exact: true }).click();
  await expect(page.getByText("5 matching approved members", { exact: true })).toBeVisible();
  expect(new URL(page.url()).searchParams.has("engagement")).toBe(false);
  const barangay = page.getByRole("combobox", { name: "Barangays", exact: true });
  await barangay.fill("not-a-real-option");
  await expect(page.getByText("No matching options.", { exact: true })).toBeVisible();
  await barangay.press("Escape"); await expect(barangay).toBeFocused();
  await expect(page.getByRole("listbox")).toHaveCount(0);
  await barangay.fill("Waw"); await barangay.press("ArrowDown"); await barangay.press("Enter");
  await expect(barangay).toHaveValue("Wawa");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByRole("button", { name: "Apply filters", exact: true }).click();
  await expect(page).toHaveURL(/barangays=Wawa/);
  await expect(page.getByText("1 matching approved members", { exact: true })).toBeVisible();
});

test.describe("touch combobox", () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });
  test("search results can be scrolled and selected with touch", async ({ page }) => {
    await setup(page); await page.goto(path);
    await expect(page.getByText("5 matching approved members", { exact: true })).toBeVisible();
    const barangay = page.getByRole("combobox", { name: "Barangays", exact: true });
    await barangay.tap();
    const list = page.getByRole("listbox", { name: "Barangays", exact: true });
    await expect(list).toBeVisible();
    await list.evaluate(element => { element.scrollTop = element.scrollHeight; });
    await page.getByRole("option", { name: "Wawa", exact: true }).tap();
    await expect(barangay).toHaveValue("Wawa");
    await expect(list).toHaveCount(0);
  });
});
