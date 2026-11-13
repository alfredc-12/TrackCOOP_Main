import { expect, test, type Page } from "@playwright/test";
import { applicationSummaryFixture, historySummaryFixture, memberSummaryFixture } from "../../server/src/modules/people-test-fixtures";

const applications = Array.from({ length: 35 }, (_, index) => ({
  id: String(index + 1), applicationCode: `TEST-APP-${String(index + 1).padStart(3, "0")}`,
  applicationSource: "Public Website", requestedMembershipType: "Associate", firstName: "Applicant", lastName: String(index + 1),
  fullName: `Applicant ${String(index + 1).padStart(3, "0")}`, contactNumber: "09000000000", email: "fixture@example.invalid",
  applicationStatus: "Payment Required", submittedAt: "2026-11-01", requirements: [], documents: [], beneficiaries: [], history: [],
}));
const payments = Array.from({ length: 12 }, (_, index) => ({
  id: String(1000 + index), payerName: `Recorded payer ${index + 1}`, payerContact: "09000000000",
  applicationCode: `OLD-APP-${index + 1}`, relatedEntityId: String(900 + index), paymentPurpose: "Associate Membership Fee",
  paymentChannel: "Cash", provider: "Cash", amount: 200, referenceNumber: `REF-${index + 1}`, validationStatus: "Validated", submittedAt: "2026-11-01",
}));
const upgrades = Array.from({ length: 71 }, (_, index) => ({
  id: String(index + 1), memberId: String(index + 100), fullName: `Upgrade Member ${String(index + 1).padStart(3, "0")}`,
  memberCode: `TEST-MEMBER-${String(index + 1).padStart(3, "0")}`, message: "Please review this synthetic application.\n".repeat(20), createdAt: "2026-11-01",
  requirements: { validatedTotal: 3000, fullRequirement: 3000 },
}));

async function setup(page: Page, role: "chairman" | "bookkeeper", options: { fail?: boolean; empty?: boolean } = {}) {
  let queue = options.empty ? [] : [...upgrades];
  let applicantQueue = [...applications];
  const decisions: unknown[] = [];
  const envelope = (data: unknown, meta: object = { total: 0, page: 1, pageSize: 10 }) => ({ success: true, data, message: "Synthetic layout fixture", meta });
  await page.setExtraHTTPHeaders({ "x-trackcoop-internal-rewrite": "1" });
  await page.route("**/api/**", async route => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/auth/me") return route.fulfill({ json: envelope({ id: "9", displayName: "Layout Review", email: "review@example.invalid", role }) });
    if (url.pathname === "/api/membership-upgrades") {
      if (options.fail) return route.fulfill({ status: 503, json: { message: "Synthetic queue unavailable" } });
      return route.fulfill({ json: queue });
    }
    if (/^\/api\/membership-upgrades\/\d+\/decision$/.test(url.pathname)) {
      decisions.push(route.request().postDataJSON());
      const id = url.pathname.split("/")[3];
      queue = queue.filter(item => item.id !== id);
      return route.fulfill({ json: { success: true } });
    }
    if (route.request().method() !== "GET") throw new Error("Unexpected mutation in layout test");
    if (url.pathname === "/api/membership-applications") return route.fulfill({ json: envelope(role === "bookkeeper" ? applicantQueue : [], { total: role === "bookkeeper" ? applicantQueue.length : 0 }) });
    if (/^\/api\/membership-applications\/\d+$/.test(url.pathname)) return route.fulfill({ json: envelope(applications.find(item => item.id === url.pathname.split("/").pop())) });
    if (url.pathname === "/api/payment-references") {
      const items = url.searchParams.get("paymentPurpose") === "Associate Membership Fee" ? payments : [];
      return route.fulfill({ json: envelope({ items, total: items.length, page: 1, pageSize: 100 }) });
    }
    if (url.pathname === "/api/members/summary") return route.fulfill({ json: envelope(memberSummaryFixture()) });
    if (url.pathname === "/api/membership-applications/summary") return route.fulfill({ json: envelope(applicationSummaryFixture()) });
    if (url.pathname === "/api/members/status-history/summary") return route.fulfill({ json: envelope(historySummaryFixture()) });
    return route.fulfill({ json: envelope([]) });
  });
  return { decisions, limitApplicants: (count: number) => { applicantQueue = applications.slice(0, count); } };
}

for (const width of [1440, 768, 390]) {
  test(`Bookkeeper applicant and payment lists have independent pages at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 1000 });
    await setup(page, "bookkeeper");
    await page.goto("/bookkeeper/members/payments");
    const applicants = page.getByRole("region", { name: "Applicants needing payment", exact: true });
    const recorded = page.getByRole("region", { name: "Recorded membership payments", exact: true });
    await expect(applicants.locator("tbody tr")).toHaveCount(5);
    await expect(recorded.locator("tbody tr")).toHaveCount(5);
    await expect(applicants.getByText("Showing 1-5 of 35 applicants", { exact: true })).toBeVisible();
    await applicants.getByRole("button", { name: "Next page", exact: true }).click();
    await expect(applicants.getByText("Applicant 006", { exact: true })).toBeVisible();
    await expect(recorded.getByText("Showing 1-5 of 12 payments", { exact: true })).toBeVisible();
    await applicants.getByRole("button", { name: "Record manual payment", exact: true }).first().click();
    const paymentForm = page.getByRole("dialog", { name: "Record membership payment", exact: true });
    await expect(paymentForm).toContainText("TEST-APP-006");
    await page.keyboard.press("Escape");
    await applicants.getByRole("combobox", { name: "Rows per page", exact: true }).click();
    await page.getByRole("option", { name: "10 per page", exact: true }).click();
    await expect(applicants.locator("tbody tr")).toHaveCount(10);
    await page.getByRole("searchbox", { name: "Search applicant or reference", exact: true }).fill("TEST-APP-035");
    await expect(applicants.locator("tbody tr")).toHaveCount(1);
    await expect(applicants.getByText("Showing 1-1 of 1 applicants", { exact: true })).toBeVisible();
    await page.getByRole("searchbox", { name: "Search applicant or reference", exact: true }).fill("");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath(`bookkeeper-payments-${width}.png`), fullPage: true });
  });

  test(`Chairman upgrade queue stays in a top-button drawer at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 1000 });
    const { decisions } = await setup(page, "chairman");
    await page.goto("/chairman/members");
    const trigger = page.getByRole("button", { name: "True Membership Applications (71)", exact: true });
    await expect(trigger).toBeVisible();
    await expect(page.getByRole("button", { name: "Member Directory", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Review application", exact: true })).toHaveCount(0);
    expect((await page.getByRole("heading", { name: "Members", exact: true }).boundingBox())!.y).toBeLessThan(350);
    await page.screenshot({ path: info.outputPath(`chairman-members-${width}.png`), fullPage: true });
    await trigger.click();
    const drawer = page.getByRole("dialog");
    await expect(drawer.getByRole("listitem")).toHaveCount(10);
    await drawer.getByRole("button", { name: "Last page", exact: true }).click();
    await expect(drawer.getByText("Upgrade Member 071", { exact: true })).toBeVisible();
    await drawer.getByRole("button", { name: "Review application", exact: true }).click();
    await expect(drawer.getByRole("heading", { name: "Upgrade Member 071", exact: true })).toBeFocused();
    await expect(drawer.getByRole("button", { name: "Approve True Membership", exact: true })).toBeDisabled();
    await expect(drawer.getByRole("button", { name: "Approve True Membership", exact: true })).toBeInViewport();
    await page.screenshot({ path: info.outputPath(`upgrade-review-${width}.png`) });
    await drawer.getByRole("button", { name: "Back to applications", exact: true }).click();
    await drawer.getByRole("searchbox", { name: "Search applications", exact: true }).fill("TEST-MEMBER-071");
    await expect(drawer.getByRole("listitem")).toHaveCount(1);
    await drawer.getByRole("button", { name: "Review application", exact: true }).click();
    await drawer.getByRole("textbox", { name: "Decision reason", exact: true }).fill("Requirements verified using synthetic test data.");
    await drawer.getByRole("button", { name: "Approve True Membership", exact: true }).click();
    await expect(drawer.getByText("No matching applications.", { exact: true })).toBeVisible();
    await drawer.getByRole("searchbox", { name: "Search applications", exact: true }).fill("");
    await expect(drawer.getByText("Showing 1-10 of 70 applications", { exact: true })).toBeVisible();
    expect(decisions).toEqual([{ decision: "Approved", reason: "Requirements verified using synthetic test data." }]);
    await page.screenshot({ path: info.outputPath(`upgrade-drawer-${width}.png`) });
    expect(await drawer.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    await page.keyboard.press("Escape");
    await expect(drawer).toHaveCount(0);
    await expect(page.getByRole("button", { name: "True Membership Applications (70)", exact: true })).toBeFocused();
  });
}

for (const state of ["empty", "failure"] as const) {
  test(`upgrade drawer shows the ${state} state without blocking Members`, async ({ page }) => {
    await setup(page, "chairman", { empty: state === "empty", fail: state === "failure" });
    await page.goto("/chairman/members");
    await page.getByRole("button", { name: /^True Membership Applications/ }).click();
    const drawer = page.getByRole("dialog");
    await expect(drawer.getByText(state === "empty" ? "No pending upgrade applications." : "Synthetic queue unavailable", { exact: true })).toBeVisible();
    await drawer.getByRole("button", { name: "Close membership applications", exact: true }).click();
    await expect(page.getByRole("button", { name: "Member Directory", exact: true })).toBeVisible();
  });
}

test("Bookkeeper refresh clamps an applicant page after the queue shrinks", async ({ page }) => {
  const fixture = await setup(page, "bookkeeper");
  await page.goto("/bookkeeper/members/payments");
  const applicants = page.getByRole("region", { name: "Applicants needing payment", exact: true });
  await applicants.getByRole("button", { name: "Last page", exact: true }).click();
  await expect(applicants.getByText("Showing 31-35 of 35 applicants", { exact: true })).toBeVisible();
  fixture.limitApplicants(2);
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(applicants.locator("tbody tr")).toHaveCount(2);
  await expect(applicants.getByText("Showing 1-2 of 2 applicants", { exact: true })).toBeVisible();
  await expect(applicants.getByRole("button", { name: "Previous page", exact: true })).toBeDisabled();
});

test("drawer rejection preserves the decision reason and returns to the queue", async ({ page }) => {
  const { decisions } = await setup(page, "chairman");
  await page.goto("/chairman/members");
  await page.getByRole("button", { name: "True Membership Applications (71)", exact: true }).click();
  const drawer = page.getByRole("dialog");
  await drawer.getByRole("button", { name: "Review application", exact: true }).first().click();
  await expect(drawer.getByRole("button", { name: "Reject", exact: true })).toBeDisabled();
  await drawer.getByRole("textbox", { name: "Decision reason", exact: true }).fill("Additional membership requirements are needed.");
  await drawer.getByRole("button", { name: "Reject", exact: true }).click();
  await expect(drawer.getByText("70 pending applications", { exact: true })).toBeVisible();
  expect(decisions).toEqual([{ decision: "Rejected", reason: "Additional membership requirements are needed." }]);
});
