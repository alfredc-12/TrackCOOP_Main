import { expect, test } from "@playwright/test";

const apiPort = process.env.PLAYWRIGHT_API_PORT ?? "5055";
const apiUrl = `http://localhost:${apiPort}`;
const draftKey = "trackcoop.membershipApplicationDraft.v1";

test.beforeEach(async ({ page }) => {
  await page.addInitScript((key) => window.localStorage.removeItem(key), draftKey);
});

test("public visitor submits a membership application and receives tracking details", async ({
  page,
}) => {
  await page.route(`${apiUrl}/api/membership-applications/public`, async (route) => {
    expect(route.request().method()).toBe("POST");
    const payload = route.request().postDataJSON();

    expect(payload.fullName).toBe("Maria Santos");
    expect(payload.applicantSignatureName).toBe("Maria Santos");
    expect(payload.orientationCommitmentAccepted).toBe(true);

    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        message: "Application submitted.",
        data: {
          applicationCode: "MEM-APP-2026-000001",
          trackingToken: "track-secret-123",
          duplicateWarning: false,
          warnings: [],
          submittedAt: "2026-07-24T08:00:00.000Z",
          nextStep: "Chairman review",
        },
        meta: {},
      }),
    });
  });

  await page.goto("/membership/apply");

  await expect(page.getByRole("heading", { name: "Become a Member" })).toBeVisible();
  await page.waitForFunction((key) => window.localStorage.getItem(key) !== null, draftKey);

  await page.getByLabel("Full name").fill("Maria Santos");
  await page.getByLabel("Contact number").fill("09171234567");
  await page.getByLabel("Current address").fill("Barangay 1, Nasugbu");
  await expect(page.getByLabel("Full name")).toHaveValue("Maria Santos");
  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByLabel(/orientation/i).check();
  await page.getByLabel(/PHP 200 associate membership fee/i).check();
  await page.getByLabel(/membership and share-subscription agreement/i).check();
  await page.getByLabel(/PHP 1,500 initial share-capital/i).check();
  await page.getByLabel(/PHP 3,000 True Member requirement/i).check();
  await page.getByLabel(/Articles of Cooperation/i).check();
  await page.getByLabel(/patronage-refund/i).check();
  await page.getByLabel(/collection and processing/i).check();
  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByLabel("Typed signature name").fill("Maria Santos");
  await page.getByLabel(/I confirm that the information/i).check();
  await page.getByRole("button", { name: "Submit Application" }).click();

  await expect(page.getByText("MEM-APP-2026-000001")).toBeVisible();
  await expect(page.getByText("track-secret-123")).toBeVisible();
  await expect(page.getByRole("link", { name: "Check Status" })).toBeVisible();
});

test("public visitor checks a submitted membership application status", async ({ page }) => {
  await page.route(
    `${apiUrl}/api/membership-applications/public/MEM-APP-2026-000001/status`,
    async (route) => {
      expect(route.request().headers()["x-application-tracking-token"]).toBe(
        "track-secret-123",
      );

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          message: "Application status loaded.",
          data: {
            applicationCode: "MEM-APP-2026-000001",
            fullName: "Maria Santos",
            submittedAt: "2026-07-24T08:00:00.000Z",
            applicationStatus: "Submitted",
            latestApplicantMessage: null,
            missingOrRejectedRequirements: [
              {
                requirementType: "Valid ID",
                requirementStatus: "Missing",
                remarks: null,
              },
            ],
          },
          meta: {},
        }),
      });
    },
  );

  await page.goto("/membership/application-status?code=MEM-APP-2026-000001");
  await page.waitForLoadState("networkidle");

  await page.getByLabel("Application code").fill("MEM-APP-2026-000001");
  await page.getByLabel("Tracking secret").fill("track-secret-123");
  await page.getByRole("button", { name: "Check Status" }).click();

  await expect(page.getByText("Submitted").first()).toBeVisible();
  await expect(page.getByText("Maria Santos")).toBeVisible();
  await expect(page.getByText("Valid ID")).toBeVisible();
  await expect(page.getByText("Missing")).toBeVisible();
});
