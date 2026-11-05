import { expect, test, type Page } from "@playwright/test";
const envelope = (data: unknown) => ({
  success: true,
  data,
  message: "Membership test fixture",
  meta: {},
});
const progress = {
  caseId: "1",
  applicationDate: "2026-01-31",
  deadline: "2026-07-31",
  validated: 1500,
  pending: 200,
  target: 3000,
  remaining: 1500,
  percentage: 50,
  status: "Overdue",
  eligibleForTrueMembershipReview: false,
};
async function memberSetup(page: Page) {
  await page.setExtraHTTPHeaders({ "x-trackcoop-internal-rewrite": "1" });
  const benefitCalls: string[] = [];
  const referralPages: string[] = [];
  await page.route("**/api/**", (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    if (path === "/api/auth/me")
      return route.fulfill({
        json: envelope({
          id: "7",
          displayName: "Test Associate",
          email: "member@example.test",
          username: null,
          role: "member",
        }),
      });
    if (path === "/api/members/me/dashboard")
      return route.fulfill({
        json: {
          isLinked: true,
          membershipType: "Associate",
          canAccessFinancials: false,
          member: {
            code: "MEM-7",
            occupation: "Farmer",
            livelihoods: [],
            memberSince: "2026-01-31",
          },
          shareCapital: { total: 1500 },
          stats: { deposits: 1, purchases: 0, rentals: 0, announcements: 0 },
          recentActivity: [],
          recentCapitalContributions: [],
          financialTransparency: null,
          memberFinancialSummary: null,
          referrals: {
            code: "REF-MEM7",
            total: 21,
            pending: 21,
            successful: 0,
            items: [],
          },
        },
      });
    if (path === "/api/members/me/membership-progress")
      return route.fulfill({
        json: envelope({
          membershipType: "Associate",
          sectors: ["Rice", "Coffee"],
          capital: progress,
          validatedCapital: 1500,
          legacyReviewRequired: false,
          legacyDeadline: null,
        }),
      });
    if (path === "/api/members/me/true-membership")
      return route.fulfill({
        json: {
          membershipType: "Associate",
          application: null,
          requirements: {
            fullRequirement: 3000,
            validatedTotal: 1500,
            remainingToFull: 1500,
            fullRequirementMet: false,
            maximumAllowed: 15000,
          },
        },
      });
    if (path === "/api/members/me/referrals") {
      referralPages.push(url.searchParams.get("page") ?? "1");
      return route.fulfill({
        json: envelope({
          items: [
            {
              id: "r" + url.searchParams.get("page"),
              applicantName: "M. Santos",
              applicationCode: "MEM-APP-TEST",
              status: "Pending",
              createdAt: "2026-11-01T00:00:00Z",
            },
          ],
          total: 21,
        }),
      });
    }
    if (path === "/api/members/me/membership-payments")
      return route.fulfill({
        json: envelope({
          items: [
            {
              reference: "FEE-12",
              purpose: "Membership fee",
              status: "Validated",
              amount: 200,
              submittedAt: "2026-01-31T00:00:00Z",
            },
          ],
          total: 1,
        }),
      });
    if (path.includes("/patronage") || path.includes("/dividends"))
      benefitCalls.push(path);
    return route.fulfill({ json: envelope([]) });
  });
  return { benefitCalls, referralPages };
}
for (const width of [1440, 768, 390]) {
  test(`personal capital, sectors and payment history at ${width}px`, async ({
    page,
  }, info) => {
    const { benefitCalls } = await memberSetup(page);
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/member_dashboard");
    const card = page.getByRole("region", { name: "Capital completion" });
    await expect(card).toBeVisible();
    await expect(card).toContainText("Overdue");
    await expect(card).toContainText("2026-07-31");
    await expect(card.getByRole("progressbar")).toHaveAttribute("value", "50");
    await expect(
      page.getByRole("button", { name: "Financial", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByText("Cooperative money", { exact: true }),
    ).toHaveCount(0);
    await page.getByText("Personal payment history", { exact: true }).click();
    await expect(page.getByRole("cell", { name: "FEE-12" })).toBeVisible();
    await page
      .locator("summary")
      .filter({ hasText: "Agricultural sectors" })
      .click();
    await expect(
      page.getByRole("checkbox", { name: "Coffee", exact: true }),
    ).toBeChecked();
    expect(benefitCalls).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBeTruthy();
    await page.screenshot({
      path: info.outputPath(`membership-${width}.png`),
      fullPage: true,
    });
  });
  test(`dependent Batangas location and multiple sectors at ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.addInitScript(() =>
      localStorage.setItem(
        "trackcoop.membershipApplicationDraft.v1",
        JSON.stringify({
          requestedMembershipType: "True Member",
          firstName: "Maria",
          lastName: "Santos",
          email: "maria@example.test",
          contactNumber: "9123456789",
          civilStatus: "Single",
          placeOfBirth: "Nasugbu, Batangas",
          dateOfBirth: "1990-01-18",
          occupation: "Farmer",
          currentAddress: "Test Sitio",
          municipality: "Nasugbu",
          barangay: "Aga",
          province: "Batangas",
          fatherName: "Father Santos",
          motherName: "Mother Santos",
          sector: "Rice",
          sectors: ["Rice"],
        }),
      ),
    );
    await page.route("**/api/**", (route) =>
      route.fulfill({ json: envelope([]) }),
    );
    await page.goto("/membership/apply");
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    const city = page.getByRole("combobox", {
      name: "Municipality / City",
      exact: true,
    });
    await expect(city).toBeVisible();
    await city.click();
    await page.getByRole("option", { name: "Balayan", exact: true }).click();
    const barangay = page.getByRole("combobox", {
      name: "Barangay",
      exact: true,
    });
    await expect(barangay).not.toHaveValue("Aga");
    await barangay.click();
    await page.getByRole("option", { name: "Calan", exact: true }).click();
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.getByRole("checkbox", { name: "Coffee", exact: true }).check();
    await expect(
      page.getByRole("checkbox", { name: "Rice", exact: true }),
    ).toBeChecked();
    await page
      .getByRole("button", {
        name: "About High-value crops (gulayan)",
        exact: true,
      })
      .click();
    await expect(page.getByText(/temporary market prices/)).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBeTruthy();
    await page.screenshot({
      path: info.outputPath(`application-sectors-${width}.png`),
      fullPage: true,
    });
  });
}

test("referral history opens with masked identities and reaches every page", async ({
  page,
}) => {
  const { referralPages } = await memberSetup(page);
  await page.goto("/member_dashboard");
  await page
    .getByRole("button", { name: "Refer a Friend", exact: true })
    .first()
    .click();
  const dialog = page.getByRole("dialog", { name: "Member referral program" });
  await expect(
    dialog.getByRole("cell", { name: "M. Santos", exact: true }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Next", exact: true }).click();
  await expect(dialog.getByText("Page 2 of 3")).toBeVisible();
  await dialog.getByRole("button", { name: "Next", exact: true }).click();
  await expect(dialog.getByText("Page 3 of 3")).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Next", exact: true }),
  ).toBeDisabled();
  expect(referralPages).toEqual(["1", "2", "3"]);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});
