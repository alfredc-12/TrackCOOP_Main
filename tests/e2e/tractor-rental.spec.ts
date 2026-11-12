import { expect, test } from "@playwright/test";
import type { BookingDraft, RentalService } from "../../src/app/rental/_types/rental";

const service: RentalService = {
  serviceId: "TRACTOR-TEST", name: "Farm Tractor", category: "Land Preparation",
  shortDescription: "Farm work", description: "Tractor for farm work", imageUrls: [],
  availability: "Available", operationalStatus: "Ready for Use", visibility: "Public",
  unitOfUsage: "Per hectare", suitableActivity: "Plowing", capacity: "5 hectares per day",
  serviceArea: "Nasugbu", operatorRequirement: "Cooperative operator required",
  operationalNotes: "", safetyReminders: [], upcomingBookings: 0, standardRate: 500, updatedAt: "2026-11-09T00:00:00Z",
};
const dates = [14, 15, 16].map((offset) => {
  const date = new Date(); date.setDate(date.getDate() + offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
});

for (const width of [1440, 390]) {
  test(`tractor booking shows remaining area, skips maintenance and sends per-date hectares at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route("https://raw.githubusercontent.com/**", (route) => route.fulfill({ json: { RECORDS: [] } }));
    await page.route("**/api/auth/**", (route) => route.fulfill({ status: 401, json: {} }));
    await page.route("**/api/rental/services", (route) => route.fulfill({ json: [service] }));
    await page.route("**/api/rental/services/TRACTOR-TEST/booked-dates", (route) => route.fulfill({ json: [
      { date: dates[0], startDate: dates[0], endDate: dates[0], status: "Approved", remainingHectares: 2, reason: "2 hectares remaining" },
      { date: dates[1], startDate: dates[1], endDate: dates[1], status: "Maintenance", remainingHectares: 0, reason: "Maintenance" },
    ] }));
    let submitted: BookingDraft | undefined;
    await page.route("**/api/rental/inquiries/public", async (route) => {
      const body = route.request().postDataBuffer()!.toString();
      const draft = /name="draft"\r\n\r\n([^\r]+)/.exec(body);
      submitted = JSON.parse(draft![1]) as BookingDraft;
      await route.fulfill({ json: {
        inquiryId: "RNT-TEST-0001", rentalId: "RNT-TEST-0001", serviceId: service.serviceId, equipmentName: service.name,
        requester: { fullName: submitted.fullName, requesterType: submitted.requesterType },
        preferredDate: dates[0], preferredEndDate: dates[2], dailyWork: submitted.dailyWork,
        status: "New Inquiry", submittedAt: new Date().toISOString(),
      } });
    });
    await page.addInitScript(({ dates }) => {
      sessionStorage.setItem("trackcoop-rental-inquiry-draft", JSON.stringify({
        firstName: "Juan", lastName: "Santos", fullName: "Juan Santos", requesterType: "Public or Non-member",
        contactNumber: "09171234567", completeAddress: "Wawa, Nasugbu", barangay: "Wawa", municipality: "Nasugbu",
        serviceId: "TRACTOR-TEST", intendedUse: "Plowing", requestDescription: "Plowing",
        preferredDate: dates[0], preferredEndDate: dates[2], preferredStartTime: "08:00", preferredEndTime: "17:00", validIdType: "Philippine National ID",
      }));
    }, { dates });
    await page.goto("/rental");
    await page.locator("article").filter({ has: page.getByRole("heading", { name: "Farm Tractor", exact: true }) }).getByRole("button", { name: "Book a Rental", exact: true }).click();
    await expect(page.getByLabel("First name", { exact: false })).toHaveValue("Juan");
    await page.locator('input[type="file"]').setInputFiles({ name: "test-id.png", mimeType: "image/png", buffer: Buffer.from("89504e470d0a1a0a", "hex") });
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.getByRole("combobox", { name: "Select farm work", exact: true }).click();
    await page.getByRole("option", { name: "Plowing", exact: true }).click();
    await page.getByRole("button", { name: "Start date", exact: true }).click();
    const startPicker = page.getByRole("dialog", { name: "Start date", exact: true });
    await expect(startPicker.locator(`[data-date="${dates[1]}"]`)).toBeDisabled();
    await expect(startPicker.locator(`[data-date="${dates[0]}"]`)).toBeEnabled();
    await startPicker.locator(`[data-date="${dates[2]}"]`).click();
    await startPicker.getByRole("button", { name: "Confirm", exact: true }).click();
    await expect(page.getByRole("combobox", { name: /^Preferred shift on / })).toHaveCount(1);
    await page.getByRole("button", { name: "Start date", exact: true }).click();
    await startPicker.locator(`[data-date="${dates[0]}"]`).click();
    await startPicker.getByRole("button", { name: "Confirm", exact: true }).click();
    await page.getByRole("button", { name: "End date", exact: true }).click();
    const endPicker = page.getByRole("dialog", { name: "End date", exact: true });
    const beforeStart = new Date(`${dates[0]}T00:00:00`);
    beforeStart.setDate(beforeStart.getDate() - 1);
    const beforeStartKey = `${beforeStart.getFullYear()}-${String(beforeStart.getMonth() + 1).padStart(2, "0")}-${String(beforeStart.getDate()).padStart(2, "0")}`;
    await expect(endPicker.locator(`[data-date="${beforeStartKey}"]`)).toBeDisabled();
    await expect(endPicker.locator(`[data-date="${dates[1]}"]`)).toBeDisabled();
    await endPicker.locator(`[data-date="${dates[0]}"]`).click();
    await endPicker.getByRole("button", { name: "Confirm", exact: true }).click();
    await expect(page.getByRole("combobox", { name: /^Preferred shift on / })).toHaveCount(1);
    await page.getByRole("button", { name: "End date", exact: true }).click();
    await endPicker.locator(`[data-date="${dates[2]}"]`).click();
    await endPicker.getByRole("button", { name: "Confirm", exact: true }).click();
    await expect(page.getByRole("combobox", { name: /^Shift on / })).toHaveCount(0);
    await expect(page.getByRole("combobox", { name: /^Preferred shift on / })).toHaveCount(3);
    const availability = page.locator("details").filter({ has: page.getByText("View availability calendar", { exact: true }) });
    await expect(availability).not.toHaveAttribute("open", "");
    await availability.locator("summary").click();
    await expect(page.getByText("Availability calendar", { exact: true })).toBeVisible();
    await expect(availability.locator(`[data-date="${dates[1]}"]`)).toBeDisabled();
    await availability.locator(`[data-date="${dates[2]}"]`).click();
    await expect(page.getByRole("combobox", { name: /^Preferred shift on / })).toHaveCount(1);
    await expect(availability.getByText("Choose an end date. Choose the same date for one day.", { exact: true })).toBeVisible();
    // An earlier second click starts a fresh range; the next click finishes it.
    await availability.locator(`[data-date="${dates[0]}"]`).click();
    await availability.locator(`[data-date="${dates[2]}"]`).click();
    await expect(page.getByRole("combobox", { name: /^Preferred shift on / })).toHaveCount(3);
    await expect(availability.locator(`[data-date="${dates[2]}"]`)).toHaveAttribute("aria-pressed", "true");
    await availability.locator("summary").click();
    const first = page.getByRole("spinbutton", { name: `Hectares on ${dates[0]}` });
    await expect(first).toHaveAttribute("max", "2");
    await expect(page.getByRole("spinbutton", { name: `Hectares on ${dates[1]}` })).toBeDisabled();
    await expect(first).toHaveValue("");
    await first.pressSequentially("0.5");
    await expect(first).toHaveValue("0.5");
    await first.fill("");
    await expect(first).toHaveValue("");
    await first.pressSequentially("2");
    await expect(first).toHaveValue("2");
    await first.fill("2.5");
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.locator("p[role=alert]")).toContainText("only 2 hectares remaining");
    await first.fill("");
    await expect(first).toHaveValue("");
    await first.pressSequentially("2");
    await expect(first).toHaveValue("2");
    await page.getByRole("spinbutton", { name: `Hectares on ${dates[2]}` }).fill("3.5");
    await expect(page.getByText("5.5 hectares x", { exact: false })).toBeVisible();
    await expect(page.getByText("₱2,750.00", { exact: true })).toBeVisible();
    await page.getByRole("combobox", { name: `Preferred shift on ${dates[0]}`, exact: true }).click();
    await page.getByRole("option", { name: "AM", exact: true }).click();
    await page.getByRole("combobox", { name: `Preferred shift on ${dates[2]}`, exact: true }).click();
    await page.getByRole("option", { name: "PM", exact: true }).click();
    await expect(page.getByRole("combobox", { name: `Preferred shift on ${dates[1]}`, exact: true })).toBeDisabled();
    await expect(page.getByText("₱2,750.00", { exact: true })).toBeVisible();
    expect(await page.locator("body").evaluate((body) => body.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath("tractor-work-plan.png"), fullPage: true });
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Tractor work: 5.5 hectares" })).toBeVisible();
    await expect(page.getByText("2 ha · Prefers AM", { exact: true })).toBeVisible();
    await expect(page.getByText("3.5 ha · Prefers PM", { exact: true })).toBeVisible();
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Send Rental Request" }).click();
    await expect.poll(() => submitted?.dailyWork).toEqual([{ date: dates[0], hectares: 2, preferredShift: "AM" }, { date: dates[2], hectares: 3.5, preferredShift: "PM" }]);
    expect(submitted?.dailyWork?.some((day) => day.date === dates[1])).toBe(false);
  });
}
