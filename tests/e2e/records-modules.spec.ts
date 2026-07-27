import { expect, test, type Page } from "@playwright/test";

const apiUrl = process.env.PLAYWRIGHT_API_URL ?? "http://localhost:5000";

async function expectNoPageHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const root = document.documentElement;
    const body = document.body;
    return Math.max(root.scrollWidth, body.scrollWidth) > root.clientWidth;
  });
  expect(overflow).toBe(false);
}

test.beforeEach(async ({ page }) => {
  await page.goto("/login");
  await page
    .getByLabel("Email or username")
    .fill("chairman.test@trackcoop.local");
  await page
    .getByLabel("Password")
    .fill(process.env.PLAYWRIGHT_CHAIRMAN_PASSWORD ?? "ChairmanTest123!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/portal\/chairman\/dashboard/);
});

test.afterEach(async ({ page }) => {
  await page.evaluate(async (url) => {
    await fetch(`${url}/api/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
  }, apiUrl);
});

test("chairman Documents is database-backed and keeps the portal layout", async ({
  page,
}) => {
  await page.goto("/portal/chairman/documents");

  await expect(
    page
      .getByRole("main")
      .getByRole("heading", { name: "Documents", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Upload Document/ }),
  ).toBeVisible();
  await expect(
    page.getByText("Total Documents", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByPlaceholder(/Search title, file, reference/),
  ).toBeVisible();
  await expect(page.getByText("Next Phase")).toHaveCount(0);
  await expectNoPageHorizontalOverflow(page);

  await page.reload();
  await expect(
    page
      .getByRole("main")
      .getByRole("heading", { name: "Documents", exact: true }),
  ).toBeVisible();
});

test("chairman Reports generates a live financial preview", async ({
  page,
}) => {
  await page.goto("/portal/chairman/reports");

  await expect(
    page
      .getByRole("main")
      .getByRole("heading", { name: "Reports", exact: true }),
  ).toBeVisible();
  const financialCard = page.locator("article").filter({
    has: page.getByRole("heading", { name: "Financial Summary", exact: true }),
  });
  await financialCard.getByRole("button", { name: "Generate" }).click();
  const generator = page
    .getByText("Report Generator", { exact: true })
    .locator("xpath=ancestor::section[1]");
  await generator
    .getByRole("button", { name: "Generate", exact: true })
    .click();

  await expect(
    page.getByText("Confirmed income", { exact: true }),
  ).toBeVisible();
  await expect(
    page.locator("[data-records-print]").getByText(/RPT-\d{4}-\d{6}/),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Save to Documents/ }),
  ).toBeVisible();
});

test("records pages remain usable at a mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/portal/chairman/documents");

  await expect(
    page
      .getByRole("main")
      .getByRole("heading", { name: "Documents", exact: true }),
  ).toBeVisible();
  await expectNoPageHorizontalOverflow(page);
});
