import { expect, test } from "@playwright/test";

test("public landing page is available without authentication", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("TrackCOOP").first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Portal", exact: true })).toBeVisible();
});

test("protected chairman routes redirect anonymous visitors to login", async ({ page }) => {
  await page.goto("/chairman/dashboard");

  await expect(page).toHaveURL(/\/login\?next=%2Fchairman%2Fdashboard/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});

test("protected bookkeeper routes preserve the intended destination on login", async ({ page }) => {
  await page.goto("/bookkeeper/payment-validation");

  await expect(page).toHaveURL(/\/login\?next=%2Fbookkeeper%2Fpayment-validation/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});
