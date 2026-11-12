import { expect, test, type Page } from "@playwright/test";
import type { RentalInquiry, RentalService } from "../../src/app/rental/_types/rental";

const assets: RentalService[] = [
  { serviceId: "TRACTOR-TEST", name: "Farm Tractor", category: "Land Preparation", shortDescription: "Farm work", description: "Tractor for farm work", imageUrls: [], availability: "Available", operationalStatus: "Ready for Use", visibility: "Public", unitOfUsage: "Per hectare", suitableActivity: "Plowing", capacity: "5 hectares per day", serviceArea: "Nasugbu", operatorRequirement: "Cooperative operator required", operationalNotes: "", safetyReminders: [], upcomingBookings: 0, standardRate: 500, updatedAt: "2026-11-09T00:00:00Z" },
];
assets.push({ ...assets[0], serviceId: "PUMP-TEST", name: "Water Pump", category: "Irrigation", visibility: "Hidden", unitOfUsage: "Per day", updatedAt: "2026-11-10T00:00:00Z" });
const bookings = Array.from({ length: 12 }, (_, index) => ({
  inquiryId: `RNT-2026-${String(index + 1).padStart(4, "0")}`, rentalId: `RNT-2026-${String(index + 1).padStart(4, "0")}`,
  requester: { requesterId: `REQ-${index}`, fullName: `Requester ${index + 1}`, requesterType: "Public or Non-member", contactNumber: "09171234567", barangay: "Wawa", municipality: "Nasugbu", completeAddress: "Wawa" },
  serviceId: "TRACTOR-TEST", equipmentName: "Farm Tractor", intendedUse: "Plowing",
  // Old requests deliberately have later preferred dates. The newest two share a submission time.
  preferredDate: `2099-12-${String(31 - index).padStart(2, "0")}`, preferredEndDate: `2099-12-${String(31 - index).padStart(2, "0")}`,
  estimatedDuration: "1 day", estimatedUsage: "2", unitOfMeasurement: "hectares", serviceLocation: "Wawa", serviceBarangay: "Wawa", requestDescription: "Plowing", attachmentNames: [],
  status: "Under Review", paymentStatus: index % 2 ? "Pending" : "Paid", scheduleStatus: "Not scheduled", publicNote: "Under review",
  submittedAt: `2026-11-${String(index >= 10 ? 12 : index + 1).padStart(2, "0")}T00:00:00Z`, updatedAt: "2026-11-15T00:00:00Z",
})) as RentalInquiry[];

async function setup(page: Page) {
  await page.setExtraHTTPHeaders({ "x-trackcoop-internal-rewrite": "1" });
  await page.route("**/portal/chairman/**", route => route.continue({ url: route.request().url().replace("/portal/chairman/", "/chairman/") }));
  await page.route("**/api/**", route => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() !== "GET") throw new Error("Rental list checks must not modify records");
    if (path === "/api/auth/me") return route.fulfill({ json: { success: true, data: { id: "rental-list-test", displayName: "Rental Review", email: "review@example.invalid", role: "chairman" } } });
    const data = path === "/api/rental/inquiries" ? bookings : path === "/api/rental/assets" ? assets : [];
    return route.fulfill({ json: data });
  });
}
const visibleReferences = (page: Page) => page.getByText(/^RNT-2026-\d{4}$/).evaluateAll(nodes => nodes.filter(node => node.getClientRects().length > 0).map(node => node.textContent?.trim()));
const references = (numbers: number[]) => numbers.map(value => `RNT-2026-${String(value).padStart(4, "0")}`);

for (const width of [1440, 768, 390]) {
  test(`bookings stay newest first across pages and collapsed filters at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 1000 }); await setup(page); await page.goto("/chairman/rentals/bookings");
    await expect.poll(() => visibleReferences(page)).toEqual(references([12,11,10,9,8,7,6,5,4,3]));
    const panel = page.getByRole("region", { name: "Rental booking filters", exact: true });
    const toggle = panel.getByRole("button", { name: "More filters", exact: true });
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(panel.getByRole("combobox", { name: "Request queue", exact: true })).toHaveCount(0);
    await page.screenshot({ path: info.outputPath("bookings-collapsed.png") });
    await page.getByRole("button", { name: "Next page", exact: true }).click();
    await expect.poll(() => visibleReferences(page)).toEqual(references([2,1]));
    await toggle.click();
    await panel.getByRole("combobox", { name: "Payment", exact: true }).click();
    await page.getByRole("option", { name: "Pending", exact: true }).click();
    await expect.poll(() => visibleReferences(page)).toEqual(references([12,10,8,6,4,2]));
    await page.screenshot({ path: info.outputPath("bookings-expanded.png") });
    await toggle.click();
    await expect(toggle).toContainText("1 active");
    await panel.getByRole("searchbox", { name: "Search", exact: true }).fill("Requester 10");
    await expect.poll(() => visibleReferences(page)).toEqual(references([10]));
    await toggle.click();
    await expect(panel.getByRole("combobox", { name: "Payment", exact: true })).toContainText("Pending");
    await panel.getByRole("combobox", { name: "Request queue", exact: true }).click();
    await page.getByRole("option", { name: "Payment review (6)", exact: true }).click();
    await expect(toggle).toContainText("2 active");
    await toggle.click();
    await panel.getByRole("button", { name: "Clear filters", exact: true }).click();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect.poll(() => visibleReferences(page)).toEqual(references([12,11,10,9,8,7,6,5,4,3]));
    expect(await panel.evaluate(node => {
      const box = node.getBoundingClientRect();
      return box.left >= 0 && box.right <= innerWidth && node.scrollWidth <= node.clientWidth;
    })).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });

  test(`asset filters preserve selections and clear while collapsed at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 1000 }); await setup(page); await page.goto("/chairman/rentals/assets");
    const panel = page.getByRole("region", { name: "Rental asset filters", exact: true });
    const toggle = panel.getByRole("button", { name: "More filters", exact: true });
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByText("Farm Tractor", { exact: true }).first()).toBeAttached();
    await page.screenshot({ path: info.outputPath("assets-collapsed.png") });
    await toggle.click();
    await panel.getByRole("combobox", { name: "Visibility", exact: true }).click();
    await page.getByRole("option", { name: "Hidden", exact: true }).click();
    await expect(page.getByText("Farm Tractor", { exact: true })).toHaveCount(0);
    await toggle.click();
    await expect(toggle).toContainText("1 active");
    await panel.getByRole("searchbox", { name: "Search", exact: true }).fill("pump");
    await toggle.click();
    await expect(panel.getByRole("combobox", { name: "Visibility", exact: true })).toContainText("Hidden");
    await page.screenshot({ path: info.outputPath("assets-expanded.png") });
    await toggle.click();
    await panel.getByRole("button", { name: "Clear filters", exact: true }).click();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(panel.getByRole("searchbox", { name: "Search", exact: true })).toHaveValue("");
    await expect(page.getByText("Farm Tractor", { exact: true }).first()).toBeAttached();
    expect(await panel.evaluate(node => {
      const box = node.getBoundingClientRect();
      return box.left >= 0 && box.right <= innerWidth && node.scrollWidth <= node.clientWidth;
    })).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
