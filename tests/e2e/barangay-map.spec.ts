import { expect, test, type Page } from "@playwright/test";

const envelope = (data: unknown) => ({ success: true, data, message: "UI fixture", meta: {} });
const rows = [
  { barangay: "Aga", totalMembers: 30, sectorCounts: [{ sector: "Farmer", count: 20 }, { sector: "Fisherfolk", count: 5 }, { sector: "Livestock", count: 5 }] },
  { barangay: "1", totalMembers: 2, sectorCounts: [{ sector: "Farmer", count: 2 }] },
  { barangay: "Brgy. 1", totalMembers: 3, sectorCounts: [{ sector: "Fisherfolk", count: 3 }] },
  { barangay: "Munting Indang", totalMembers: 7, sectorCounts: [{ sector: "Farmer", count: 7 }] },
  { barangay: "Wawa", totalMembers: 15, sectorCounts: [{ sector: "Fisherfolk", count: 15 }] },
  { barangay: "Papaya", totalMembers: 9, sectorCounts: [{ sector: "Farmer", count: 9 }] },
  { barangay: "Poblacion", totalMembers: 4, sectorCounts: [] },
];

function dashboard(empty = false) {
  const demographics = (empty ? [] : rows).map((row) => ({ ...row, activeMembers: row.totalMembers, needsMonitoring: 0, inactiveMembers: 0 }));
  const totalMembers = demographics.reduce((total, row) => total + row.totalMembers, 0);
  return {
    generatedAt: "2026-11-02T00:00:00.000Z", filters: { period: "year", barangay: null, memberStatus: null, memberType: null },
    metrics: { totalMembers, newMembersThisPeriod: 0, totalMembersGrowth: 0, totalShareCapital: 0, shareCapitalThisPeriod: 0, totalShareCapitalGrowth: 0, pendingApprovals: 0, pendingActionsCount: 0, totalPosSales: 0, totalPosSalesGrowth: 0, totalRentalIncome: 0, totalIncome: 0, totalExpenses: 0, netSurplus: 0, posTransactions: 0 },
    memberHealth: { active: totalMembers, needsMonitoring: 0, inactiveMembers: 0 },
    shareCapitalProgress: { total: 0, thisPeriod: 0, contributingMembers: 0, reachedMinimum: 0, reachedMaximum: 0, belowMinimum: totalMembers, totalMembers },
    demographics, revenueTrend: [], membershipTrend: [], incomeSources: [], inventoryAlerts: [], recentTransactions: [], actionItems: [], recentActivity: [],
    operationsSnapshot: { pos: { totalSales: 0, transactions: 0, productsSold: 0 }, rental: { totalIncome: 0, completed: 0, pending: 0, upcoming: 0 }, inventory: { lowStock: 0, outOfStock: 0, alerts: [] } },
    productShopAnalytics: { totalSales: 0, transactions: 0, unitsSold: 0, averageOrderValue: 0, topProducts: [], categorySales: [] },
    referralAnalytics: { total: 0, pending: 0, successful: 0, conversionRate: 0, rewardCredits: 0, rewardLabel: "Referral credits", rewardPolicyEnabled: false, rewardPerSuccessfulReferral: 0, topReferrers: [], byBarangay: [] },
  };
}

async function setup(page: Page, { empty = false, failBoundary = false, failTiles = false } = {}) {
  let boundaryRequests = 0;
  const externalBoundaryRequests: string[] = [];
  await page.setExtraHTTPHeaders({ "x-trackcoop-internal-rewrite": "1" });
  page.on("request", (request) => { if (request.url().includes("portal.georisk.gov.ph")) externalBoundaryRequests.push(request.url()); });
  await page.route("**/api/**", (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (!["GET", "OPTIONS"].includes(route.request().method())) throw new Error("Map review must not mutate application data");
    if (pathname === "/api/maps/nasugbu") {
      boundaryRequests++;
      return failBoundary && boundaryRequests === 1 ? route.fulfill({ status: 503, body: "UI fixture unavailable" }) : route.continue();
    }
    if (pathname === "/api/auth/me") return route.fulfill({ json: envelope({ id: "ui-map", displayName: "Map UI Review", email: "map-review@example.invalid", username: "review", role: "chairman" }) });
    if (pathname === "/api/chairman/dashboard") return route.fulfill({ json: envelope(dashboard(empty)) });
    return route.fulfill({ status: 503, json: { success: false, message: "UI fixture: unavailable", errors: [] } });
  });
  await page.route("https://*.tile.openstreetmap.org/**", (route) => failTiles ? route.abort() : route.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#e8eeeb"/></svg>' }));
  return { externalBoundaryRequests };
}

for (const width of [1440, 768, 390]) {
  test(`full-width polygon map and barangay details at ${width}px`, async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const { externalBoundaryRequests } = await setup(page);
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/chairman/dashboard");
    const map = page.getByRole("region", { name: "Nasugbu member distribution map", exact: true });
    const polygons = map.locator('path[role="button"]');
    await expect(polygons).toHaveCount(42);
    await map.scrollIntoViewIfNeeded();
    await expect(map.locator("circle, .leaflet-marker-icon")).toHaveCount(0);
    await expect(page.getByText("Top Barangays by Members", { exact: true })).toHaveCount(0);
    expect(await map.evaluate((element) => element.getBoundingClientRect().width / element.closest("section")!.getBoundingClientRect().width)).toBeGreaterThan(0.8);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.getByText("4 members in locations without a matching boundary", { exact: true })).toBeVisible();
    const area = map.getByRole("button", { name: "Aga, 30 members", exact: true });
    await expect(area).toHaveAttribute("fill", "#123d2a");
    await expect(map.getByRole("button", { name: "Barangay 1, 5 members", exact: true })).toHaveAttribute("fill", "#e3f7e7");
    await expect(map.getByRole("button", { name: "Calayo, 0 members", exact: true })).toHaveAttribute("fill", "#eef2ec");
    await map.screenshot({ path: testInfo.outputPath(`map-${width}.png`) });
    await page.getByLabel("Find a barangay", { exact: true }).selectOption({ label: "Aga" });
    const detail = page.getByRole("region", { name: "Aga member details", exact: true });
    await expect(detail).toBeVisible();
    await expect(detail.locator("dl > div").filter({ hasText: "Farmer" })).toContainText("20");
    await expect(detail.locator("dl > div").filter({ hasText: "Fisherfolk" })).toContainText("5");
    await expect(detail.locator("dl > div").filter({ hasText: "Livestock" })).toContainText("5");
    await map.locator(".leaflet-popup-close-button").click();
    const interior = await area.evaluate((element) => {
      const path = element as SVGPathElement;
      const bounds = path.getBoundingClientRect();
      const matrix = path.getScreenCTM();
      if (!matrix) return null;
      for (const y of [0.5, 0.4, 0.6, 0.3, 0.7]) {
        for (const x of [0.5, 0.4, 0.6, 0.3, 0.7]) {
          const screen = new DOMPoint(bounds.x + bounds.width * x, bounds.y + bounds.height * y);
          if (path.isPointInFill(screen.matrixTransform(matrix.inverse()))) return { x: screen.x, y: screen.y };
        }
      }
      return null;
    });
    expect(interior).not.toBeNull();
    await page.mouse.move(interior!.x, interior!.y);
    await expect(map.locator(".leaflet-tooltip")).toContainText("Aga");
    await expect(map.locator(".leaflet-tooltip")).toContainText("Farmer");
    await area.focus();
    await expect(map.locator(".leaflet-tooltip")).toContainText("Aga");
    await area.press("Enter");
    await expect(detail).toBeVisible();
    await map.locator(".leaflet-popup-close-button").click();
    await page.getByRole("button", { name: "Show all barangays", exact: true }).click();
    await expect(page.getByLabel("Find a barangay", { exact: true })).toHaveValue("");
    expect(externalBoundaryRequests).toEqual([]);
    expect(errors).toEqual([]);
  });
}

test("boundary failure can retry the local geometry asset", async ({ page }) => {
  await setup(page, { failBoundary: true });
  await page.goto("/chairman/dashboard");
  await expect(page.getByText("Barangay boundaries could not be loaded. Please try again.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.locator('path[role="button"]')).toHaveCount(42);
});

test("zero data and failed basemap tiles still show real boundaries and honest details", async ({ page }) => {
  await setup(page, { empty: true, failTiles: true });
  await page.goto("/chairman/dashboard");
  const map = page.getByRole("region", { name: "Nasugbu member distribution map", exact: true });
  await expect(map.locator('path[role="button"]')).toHaveCount(42);
  const fills = await map.locator('path[role="button"]').evaluateAll((paths) => [...new Set(paths.map((path) => path.getAttribute("fill")))]);
  expect(fills).toEqual(["#eef2ec"]);
  await page.getByLabel("Find a barangay", { exact: true }).selectOption({ label: "Aga" });
  await expect(page.getByRole("region", { name: "Aga member details", exact: true })).toContainText("No member records in the current results.");
});
