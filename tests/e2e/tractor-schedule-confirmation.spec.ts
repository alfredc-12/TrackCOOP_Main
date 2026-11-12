import { expect, test, type Page } from "@playwright/test";
import type { RentalInquiry, RentalSchedule, RentalService } from "../../src/app/rental/_types/rental";

async function mockBooking(page: Page, tractor = true, legacy = false, unpaid = false) {
  const service = {
    serviceId: tractor ? "TRACTOR-TEST" : "PUMP-TEST", name: tractor ? "Farm Tractor" : "Water Pump",
    category: "Farm Equipment", standardRate: 500, availability: "Available", operationalStatus: "Ready for Use",
    operatorRequirement: "Cooperative operator required", unitOfUsage: tractor ? "Per Hectare" : "Per Day",
  } as RentalService;
  let inquiry = {
    inquiryId: "RNT-2099-0001", rentalId: "RNT-2099-0001", serviceId: service.serviceId, equipmentName: service.name,
    requester: { requesterId: "REQ-TEST", fullName: "Juan Santos", requesterType: "Public or Non-member", contactNumber: "09171234567", completeAddress: "Sitio Uno", barangay: "Wawa", municipality: "Nasugbu" },
    preferredDate: "2099-11-09", preferredEndDate: "2099-11-10", preferredStartTime: "09:15", preferredEndTime: "16:30",
    dailyWork: tractor && !legacy ? [{ date: "2099-11-09", hectares: 3, preferredShift: "AM" }, { date: "2099-11-10", hectares: 2 }] : undefined,
    estimatedDuration: "2 days", estimatedUsage: tractor && !legacy ? "5" : "To be confirmed", unitOfMeasurement: tractor ? "hectares" : "days",
    intendedUse: "Farm work", requestDescription: "Farm work", attachmentNames: [], serviceLocation: "Sitio Uno farm", serviceBarangay: "Wawa",
    status: "Awaiting Confirmation", scheduleStatus: "Awaiting Confirmation", paymentStatus: unpaid ? "Pending" : "Paid", paymentDeadline: unpaid ? "2000-01-01" : undefined, publicNote: "Ready for confirmation.",
    submittedAt: "2026-11-09T00:00:00Z", updatedAt: "2026-11-09T00:00:00Z",
  } as RentalInquiry;
  let schedule = {
    scheduleId: "SCH-TEST", inquiryId: inquiry.inquiryId, rentalId: inquiry.rentalId, serviceId: service.serviceId, equipmentName: service.name,
    requesterName: inquiry.requester.fullName, requesterType: inquiry.requester.requesterType,
    date: inquiry.preferredDate, endDate: inquiry.preferredEndDate, startTime: "09:15", endTime: "16:30", dailyWork: inquiry.dailyWork,
    assignedOperator: "", serviceLocation: "Sitio Uno farm", barangay: "Wawa", preparationMinutes: 0, travelMinutes: 0, bufferMinutes: 0,
    status: "Awaiting Confirmation", paymentStatus: unpaid ? "Pending" : "Paid",
  } as RentalSchedule;
  const saved: Partial<RentalSchedule>[] = [];
  const checks: unknown[] = [];
  await page.setExtraHTTPHeaders({ "x-trackcoop-internal-rewrite": "1" });
  await page.route("**/portal/chairman/**", (route) => route.continue({ url: route.request().url().replace("/portal/chairman/", "/chairman/") }));
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/auth/me") return route.fulfill({ json: { success: true, data: { id: "schedule-test", displayName: "Schedule Review", email: "test@example.invalid", role: "chairman" } } });
    if (path === "/api/rental/schedules/SCH-TEST" && route.request().method() === "PATCH") {
      const payload = route.request().postDataJSON() as Partial<RentalSchedule>; saved.push(payload);
      schedule = { ...schedule, ...payload };
      inquiry = { ...inquiry, status: "Scheduled", scheduleStatus: "Confirmed" };
      return route.fulfill({ json: schedule });
    }
    if (path === "/api/rental/schedules/conflicts") { checks.push(route.request().postDataJSON()); return route.fulfill({ json: { hasConflict: false, reasons: [], conflictingSchedules: [], suggestedSlots: [] } }); }
    if (path === "/api/rental/inquiries") return route.fulfill({ json: [inquiry] });
    if (path === `/api/rental/inquiries/${inquiry.inquiryId}`) return route.fulfill({ json: inquiry });
    if (path === `/api/rental/inquiries/${inquiry.inquiryId}/history`) return route.fulfill({ json: [] });
    if (path === "/api/rental/schedules") return route.fulfill({ json: [schedule] });
    if (path === "/api/rental/assets") return route.fulfill({ json: [service] });
    if (path === "/api/rental/availability") return route.fulfill({ json: [{ serviceId: service.serviceId, equipmentName: service.name, status: "Available" }] });
    if (route.request().method() !== "GET") throw new Error(`Unexpected test mutation: ${path}`);
    return route.fulfill({ json: { success: true, data: [] } });
  });
  await page.goto("/chairman/rentals/bookings");
  await page.getByRole("button", { name: "View Details", exact: true }).first().click();
  await page.getByRole("button", { name: "Actions", exact: true }).click();
  await page.getByRole("button", { name: /^Confirm Schedule/ }).click();
  return { saved, checks, dialog: page.getByRole("dialog", { name: "Confirm Schedule", exact: true }) };
}

for (const width of [1440, 390]) {
  test(`tractor confirmation focuses on hectares and operator at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 1000 });
    const { saved, checks, dialog } = await mockBooking(page);
    await expect(dialog.locator('input[type="time"]')).toHaveCount(0);
    await expect(dialog.getByRole("combobox")).toHaveCount(3);
    await expect(dialog.getByText("Confirmed", { exact: true })).toBeVisible();
    await expect(dialog.getByText("Total: 5 hectares", { exact: true })).toBeVisible();
    await expect(dialog.getByText("Customer prefers AM", { exact: true })).toBeVisible();
    await expect(dialog.getByRole("combobox", { name: "Shift on 2099-11-09", exact: true })).toContainText("Not assigned");
    await expect(dialog.getByLabel("Service location", { exact: false })).toHaveValue("Sitio Uno farm");
    const notes = dialog.locator("details");
    await expect(notes).not.toHaveAttribute("open", "");
    await dialog.getByRole("button", { name: "Check Availability", exact: true }).click();
    await expect(dialog.getByText("Assign an operator before confirming the schedule.", { exact: true })).toBeVisible();
    expect(checks).toHaveLength(0);
    await dialog.getByRole("combobox", { name: "Choose operator", exact: true }).click();
    await expect(page.getByRole("option", { name: "Chairman to assign", exact: true })).toHaveCount(0);
    await page.getByRole("option", { name: "Cooperative operator", exact: true }).click();
    await dialog.getByRole("combobox", { name: "Shift on 2099-11-09", exact: true }).click();
    await page.getByRole("option", { name: "AM", exact: true }).click();
    // Editing area must not silently clear the staff assignment.
    await dialog.getByRole("spinbutton", { name: "Hectares on 2099-11-09", exact: true }).fill("3");
    await expect(dialog.getByRole("combobox", { name: "Shift on 2099-11-09", exact: true })).toContainText("AM");
    await dialog.getByRole("combobox", { name: "Shift on 2099-11-10", exact: true }).click();
    await page.getByRole("option", { name: "PM", exact: true }).click();
    await dialog.getByRole("button", { name: "Check Availability", exact: true }).click();
    await expect(dialog.getByText("Schedule is available", { exact: true })).toBeVisible();
    await dialog.screenshot({ path: info.outputPath("tractor-confirmation.png") });
    expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    await dialog.getByRole("button", { name: "Confirm Schedule", exact: true }).click();
    await page.getByRole("dialog", { name: "Confirm Schedule?", exact: true }).getByRole("button", { name: "Confirm", exact: true }).click();
    await expect.poll(() => saved.length).toBe(1);
    expect(saved[0]).toMatchObject({ status: "Confirmed", assignedOperator: "Cooperative operator", startTime: "00:00", endTime: "23:59", dailyWork: [{ date: "2099-11-09", hectares: 3, shift: "AM" }, { date: "2099-11-10", hectares: 2, shift: "PM" }] });
    expect(saved[0].serviceLocation).toBe("Sitio Uno farm");
  });
}

test("other equipment keeps time inputs and the schedule status control", async ({ page }) => {
  const { dialog } = await mockBooking(page, false);
  await expect(dialog.locator('input[type="time"]')).toHaveCount(2);
  await expect(dialog.locator('input[type="time"]').first()).toHaveValue("09:15");
  await expect(dialog.locator('input[type="time"]').last()).toHaveValue("16:30");
  await expect(dialog.getByRole("combobox")).toHaveCount(3);
  await expect(dialog.getByText("Tractor work per date", { exact: true })).toHaveCount(0);
});

test("legacy tractor booking has no invented hectares or clock inputs", async ({ page }) => {
  const { dialog } = await mockBooking(page, true, true);
  await expect(dialog.locator('input[type="time"]')).toHaveCount(0);
  await expect(dialog.getByText(/existing booking has no hectare breakdown recorded/)).toBeVisible();
  await expect(dialog.getByRole("spinbutton")).toHaveCount(0);
});

test("staff may leave shifts unassigned or clear an assignment before confirming", async ({ page }) => {
  const { dialog, saved } = await mockBooking(page);
  const shift = dialog.getByRole("combobox", { name: "Shift on 2099-11-09", exact: true });
  await shift.click();
  await page.getByRole("option", { name: "AM", exact: true }).click();
  await shift.click();
  await page.getByRole("option", { name: "Not assigned", exact: true }).click();
  await dialog.getByRole("combobox", { name: "Choose operator", exact: true }).click();
  await page.getByRole("option", { name: "Cooperative operator", exact: true }).click();
  await dialog.getByRole("button", { name: "Check Availability", exact: true }).click();
  await expect(dialog.getByText("Schedule is available", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Confirm Schedule", exact: true }).click();
  await page.getByRole("dialog", { name: "Confirm Schedule?", exact: true }).getByRole("button", { name: "Confirm", exact: true }).click();
  await expect.poll(() => saved.length).toBe(1);
  expect(saved[0].dailyWork?.every((day) => day.shift === undefined)).toBe(true);
});

for (const width of [1440, 390]) {
  test(`unpaid tractor can confirm a schedule without marking payment paid at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const { saved, dialog } = await mockBooking(page, true, false, true);
    await dialog.getByRole("combobox", { name: "Choose operator", exact: true }).click();
    await page.getByRole("option", { name: "Cooperative operator", exact: true }).click();
    await dialog.getByRole("button", { name: "Check Availability", exact: true }).click();
    await expect(dialog.getByText("Schedule is available", { exact: true })).toBeVisible();
    await dialog.getByRole("button", { name: "Confirm Schedule", exact: true }).click();
    await page.getByRole("dialog", { name: "Confirm Schedule?", exact: true }).getByRole("button", { name: "Confirm", exact: true }).click();
    await expect.poll(() => saved.length).toBe(1);
    expect(saved[0].paymentStatus).toBe("Pending");
    expect(saved[0].status).toBe("Confirmed");
    await expect(page.getByRole("button", { name: "Mark In Progress", exact: true })).toHaveCount(0);
  });
}
