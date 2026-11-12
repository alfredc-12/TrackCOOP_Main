import { expect, test } from "@playwright/test";
import type { RentalService } from "../../src/app/rental/_types/rental";

const service: RentalService = {
  serviceId: "TRACTOR-TEST", name: "Farm Tractor", category: "Land Preparation",
  shortDescription: "Farm work", description: "Tractor for farm work",
  imageUrls: ["/images/rental/tractor-field.jpg", "/images/rental/tractor-field.jpg?second"],
  availability: "Available", operationalStatus: "Ready for Use", visibility: "Public",
  unitOfUsage: "Per hectare", suitableActivity: "Plowing", capacity: "5 hectares per day",
  serviceArea: "Nasugbu", operatorRequirement: "Cooperative operator required",
  operationalNotes: "Prepare access to the field.", safetyReminders: ["Keep a safe distance."],
  upcomingBookings: 0, standardRate: 500, updatedAt: "2026-11-09T00:00:00Z",
};

for (const width of [1440, 390]) {
  test(`equipment details open without leaving the catalog and support booking at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route("https://raw.githubusercontent.com/**", (route) => route.fulfill({ json: { RECORDS: [] } }));
    await page.route("**/api/auth/**", (route) => route.fulfill({ status: 401, json: {} }));
    await page.route("**/api/rental/services", (route) => route.fulfill({ json: [service] }));
    await page.route("**/api/rental/services/TRACTOR-TEST/booked-dates", (route) => route.fulfill({ json: [] }));
    await page.goto("/rental");
    const search = page.getByRole("searchbox", { name: "Search equipment", exact: true });
    await search.fill("farm");
    const card = page.locator("article").filter({ has: page.getByRole("heading", { name: "Farm Tractor", exact: true }) });
    const trigger = card.getByRole("button", { name: "View Details", exact: true });
    await trigger.click();
    const details = page.getByRole("dialog", { name: "Equipment details", exact: true });
    await expect(details.getByRole("heading", { name: "Farm Tractor", exact: true })).toBeVisible();
    await expect(details.getByText("5 hectares per day", { exact: true })).toBeVisible();
    await expect(details.getByText("Keep a safe distance.", { exact: true })).toHaveCount(1);
    await expect(page).toHaveURL(/\/rental$/);
    await expect(details.getByRole("link", { name: "All Rental Services", exact: true })).toHaveCount(0);
    expect(await details.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath("equipment-details.png") });
    await details.getByRole("button", { name: "Show Farm Tractor image 2", exact: true }).click();
    await details.getByRole("button", { name: "Preview Farm Tractor image 2", exact: true }).click();
    const preview = page.getByRole("dialog", { name: "Farm Tractor image preview", exact: true });
    await expect(preview.getByRole("img", { name: "Farm Tractor, enlarged image 2", exact: true })).toBeVisible();
    await preview.getByRole("button", { name: "Close modal", exact: true }).last().click();
    await details.getByRole("button", { name: "Book a Rental", exact: true }).click();
    const booking = page.getByRole("dialog", { name: "Modal Dialog", exact: true });
    await expect(booking.getByLabel("First name", { exact: false })).toBeVisible();
    await expect(page).toHaveURL(/\/rental$/);
    await booking.getByRole("button", { name: "Close modal", exact: true }).last().click();
    await expect(details).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(details).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await expect(search).toHaveValue("farm");
    await card.getByRole("button", { name: "View Farm Tractor", exact: true }).click();
    await expect(details).toBeVisible();
    await details.getByRole("button", { name: "Close modal", exact: true }).last().click();
    await expect(details).toHaveCount(0);
    // Existing shared URLs still display the full page for direct visits.
    await page.goto("/rental/services/TRACTOR-TEST");
    await expect(page.getByRole("heading", { name: "Farm Tractor", level: 1, exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "All Rental Services", exact: true })).toBeVisible();
  });
}

test("unavailable equipment details have no booking action", async ({ page }) => {
  await page.route("**/api/auth/**", (route) => route.fulfill({ status: 401, json: {} }));
  await page.route("**/api/rental/services", (route) => route.fulfill({ json: [{ ...service, availability: "Unavailable", operationalStatus: "Under Maintenance", imageUrls: [] }] }));
  await page.goto("/rental");
  await page.locator("article").getByRole("button", { name: "View Details", exact: true }).click();
  const details = page.getByRole("dialog", { name: "Equipment details", exact: true });
  await expect(details.getByRole("heading", { name: "Farm Tractor", exact: true })).toBeVisible();
  await expect(details.getByRole("button", { name: "Book a Rental", exact: true })).toHaveCount(0);
  await expect(details.getByText("This asset is temporarily unavailable for new bookings.", { exact: true })).toHaveCount(1);
});
