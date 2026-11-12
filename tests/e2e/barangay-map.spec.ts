import { expect, test, type Page } from "@playwright/test";
import { analyticsFixture, fixtureFilters } from "../../server/src/modules/member-analytics/member-analytics.test-fixture";
import { createAnalyticsEngine } from "../../server/src/modules/member-analytics/member-analytics.engine";

const envelope = (data: unknown) => ({ success: true, data, message: "UI fixture", meta: {} });
const rows = [
  { barangay: "Aga", totalMembers: 30, sectorCounts: [{ sector: "Rice", count: 20 }, { sector: "Fishery", count: 5 }, { sector: "Livestock", count: 5 }] },
  { barangay: "1", totalMembers: 2, sectorCounts: [{ sector: "Rice", count: 2 }] },
  { barangay: "Brgy. 1", totalMembers: 3, sectorCounts: [{ sector: "Fishery", count: 3 }] },
  { barangay: "Munting Indang", totalMembers: 7, sectorCounts: [{ sector: "Rice", count: 7 }] },
  { barangay: "Wawa", totalMembers: 15, sectorCounts: [{ sector: "Fishery", count: 15 }] },
  { barangay: "Papaya", totalMembers: 9, sectorCounts: [{ sector: "Rice", count: 9 }] },
  { barangay: "Poblacion", totalMembers: 4, sectorCounts: [] },
];

function dashboard(empty = false) {
  const source = analyticsFixture();
  source.members = []; source.capital = []; source.capitalPayments = []; source.accounts = []; source.indicators = [];
  source.applications = []; source.applicationHistory = []; source.participation = []; source.referrals = [];
  for (const row of empty ? [] : rows) {
    const assigned = row.sectorCounts.flatMap(s => Array.from({ length: s.count }, () => s.sector));
    for (let i = 0; i < row.totalMembers; i++) source.members.push({ id: String(source.members.length + 1), barangay: row.barangay, municipality: "Nasugbu", province: "Batangas", sector: assigned[i] ?? null, membershipType: "Associate", officialStatus: "Active", approvalStatus: "Approved", approvedAt: "2025-01-01T01:00:00Z", deadline: null });
  }
  return createAnalyticsEngine(source, fixtureFilters, "2026-11-02T00:00:00Z").result;
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
    if (pathname === "/api/chairman/member-analytics") return route.fulfill({ json: envelope(dashboard(empty)) });
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
    const map = page.getByRole("region", { name: "Batangas member distribution map", exact: true });
    const polygons = map.locator('path[role="button"]');
    await expect(polygons).toHaveCount(1077);
    await map.scrollIntoViewIfNeeded();
    await expect(map.locator("circle, .leaflet-marker-icon")).toHaveCount(0);
    await expect(page.getByText("Top Barangays by Members", { exact: true })).toHaveCount(0);
    expect(await map.evaluate((element) => element.getBoundingClientRect().width / element.closest("section")!.getBoundingClientRect().width)).toBeGreaterThan(0.8);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.getByText("4 members in locations without a matching boundary", { exact: true })).toBeVisible();
    const area = map.getByRole("button", { name: "Aga, Nasugbu, 30 members", exact: true });
    await expect(area).toHaveAttribute("fill", "#123d2a");
    await expect(map.getByRole("button", { name: "Barangay 1, Nasugbu, 5 members", exact: true })).toHaveAttribute("fill", "#e3f7e7");
    await expect(map.getByRole("button", { name: "Calayo, Nasugbu, 0 members", exact: true })).toHaveAttribute("fill", "#eef2ec");
    await map.screenshot({ path: testInfo.outputPath(`map-${width}.png`) });
    await page.getByRole("combobox", { name: "Find a barangay", exact: true }).click();
    await page.getByRole("option", { name: "Aga, Nasugbu", exact: true }).click();
    const detail = page.getByRole("region", { name: "Aga, Nasugbu member details", exact: true });
    await expect(detail).toBeVisible();
    await expect(detail.locator("dl > div").filter({ hasText: "Rice" })).toContainText("20");
    await expect(detail.locator("dl > div").filter({ hasText: "Fishery" })).toContainText("5");
    await expect(detail.locator("dl > div").filter({ hasText: "Livestock" })).toContainText("5");
    await map.locator(".leaflet-popup-close-button").click();
    await map.scrollIntoViewIfNeeded();
    await page.mouse.move(0, 0);
    let previousBounds = "";
    await expect.poll(async () => {
      const current = JSON.stringify(await area.boundingBox());
      const stable = current === previousBounds; previousBounds = current; return stable;
    }).toBe(true);
    const interior = await area.evaluate((element) => {
      const path = element as SVGPathElement;
      const bounds = path.getBoundingClientRect();
      const matrix = path.getScreenCTM();
      if (!matrix) return null;
      const canvas = path.closest(".leaflet-container")!.getBoundingClientRect();
      for (let y = Math.max(bounds.top, canvas.top, 0) + 4; y < Math.min(bounds.bottom, canvas.bottom, innerHeight); y += 8) {
        for (let x = Math.max(bounds.left, canvas.left, 0) + 4; x < Math.min(bounds.right, canvas.right, innerWidth); x += 8) {
          const screen = new DOMPoint(x, y);
          if (path.isPointInFill(screen.matrixTransform(matrix.inverse())) && document.elementFromPoint(x, y) === path) return { x, y };
        }
      }
      return null;
    });
    expect(interior).not.toBeNull();
    await page.mouse.move(interior!.x, interior!.y);
    await expect(map.locator(".leaflet-tooltip").filter({ hasText: /^Aga/ })).toContainText("Aga");
    await expect(map.locator(".leaflet-tooltip").filter({ hasText: /^Aga/ })).toContainText("Rice");
    await area.focus();
    await expect(map.locator(".leaflet-tooltip").filter({ hasText: /^Aga/ })).toContainText("Aga");
    await area.press("Enter");
    await expect(detail).toBeVisible();
    await map.locator(".leaflet-popup-close-button").click();
    await page.getByRole("button", { name: "Show all barangays", exact: true }).click();
    await expect(page.getByRole("combobox", { name: "Find a barangay", exact: true })).toHaveValue("Find a barangay");
    expect(externalBoundaryRequests).toEqual([]);
    expect(errors).toEqual([]);
  });
}

test("boundary failure can retry the local geometry asset", async ({ page }) => {
  await setup(page, { failBoundary: true });
  await page.goto("/chairman/dashboard");
  await expect(page.getByText("Barangay boundaries could not be loaded. Please try again.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.locator('path[role="button"]')).toHaveCount(1077);
});

test("zero data and failed basemap tiles still show real boundaries and honest details", async ({ page }) => {
  await setup(page, { empty: true, failTiles: true });
  await page.goto("/chairman/dashboard");
  const map = page.getByRole("region", { name: "Batangas member distribution map", exact: true });
  await expect(map.locator('path[role="button"]')).toHaveCount(1077);
  const fills = await map.locator('path[role="button"]').evaluateAll((paths) => [...new Set(paths.map((path) => path.getAttribute("fill")))]);
  expect(fills).toEqual(["#eef2ec"]);
  await page.getByRole("combobox", { name: "Find a barangay", exact: true }).click();
    await page.getByRole("option", { name: "Aga, Nasugbu", exact: true }).click();
  await expect(page.getByRole("region", { name: "Aga, Nasugbu member details", exact: true })).toContainText("No member records in the current results.");
});

test("search distinguishes same-name barangays in different municipalities", async ({ page }) => {
  await setup(page, { empty: true });
  await page.goto("/chairman/dashboard");
  const map = page.getByRole("region", { name: "Batangas member distribution map", exact: true });
  await expect(map.locator('path[role="button"]')).toHaveCount(1077);
  const search = page.getByRole("combobox", { name: "Find a barangay", exact: true });
  for (const label of ["San Jose, Alitagtag", "San Jose, Tuy"]) {
    await search.fill("San Jose");
    await page.getByRole("option", { name: label, exact: true }).click();
    await expect(search).toHaveValue(label);
    const details = page.getByRole("region", { name: `${label} member details`, exact: true });
    await expect(details).toBeVisible();
    await expect(details.getByRole("link", { name: "View matching members" })).toHaveCount(0);
    await map.locator(".leaflet-popup-close-button").click();
  }
});
