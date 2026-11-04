import { expect, test, type Page } from "@playwright/test";

const savedAccounts = ["member.review@example.invalid", "bookkeeper.review@example.invalid", "long.account.name.for.layout@example.invalid"];

async function signedOut(page: Page) {
  await page.route("**/api/auth/me", (route) => route.fulfill({ status: 401, json: { success: false, message: "Signed-out UI fixture", errors: [] } }));
  await page.addInitScript((accounts) => {
    if (localStorage.getItem("trackcoop_saved_logins") === null) localStorage.setItem("trackcoop_saved_logins", JSON.stringify(accounts));
  }, savedAccounts);
}

for (const width of [1440, 768, 390]) {
  test(`sign-in layout and recent accounts remain usable at ${width}px`, async ({ page }) => {
    await signedOut(page);
    await page.setViewportSize({ width, height: width === 390 ? 500 : width === 1440 ? 720 : 900 });
    await page.goto("/login");
    const recent = page.locator("details");
    await expect(recent).toContainText("3 saved");
    await expect(recent).not.toHaveAttribute("open", "");
    if (width >= 1024) expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1)).toBe(true);
    await page.getByText("Recent accounts", { exact: true }).click();
    if (width >= 1024) expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1)).toBe(true);
    await page.getByRole("button", { name: savedAccounts[2], exact: true }).click();
    await expect(page.getByRole("textbox", { name: "Email or username", exact: true })).toHaveValue(savedAccounts[2]);
    await expect(page.getByLabel("Password", { exact: true })).toBeFocused();
    await page.getByText("Recent accounts", { exact: true }).click();
    await page.getByRole("button", { name: `Remove saved account ${savedAccounts[1]}`, exact: true }).click();
    await expect(recent).toContainText("2 saved");
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("trackcoop_saved_logins") || "[]"))).toEqual([savedAccounts[0], savedAccounts[2]]);
    await page.getByLabel("Password", { exact: true }).fill("UI-review-only-123!");
    await page.getByRole("button", { name: "Show password", exact: true }).click();
    await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute("type", "text");
    await page.getByRole("button", { name: "Hide password", exact: true }).click();
    await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute("type", "password");
    const contact = page.getByRole("link", { name: "cooperative contact page", exact: true });
    await contact.scrollIntoViewIfNeeded();
    await expect(contact).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.reload();
    await expect(page.locator("details")).toContainText("2 saved");
  });
}

test("validation, pending state, and server errors remain connected to the sign-in form", async ({ page }) => {
  await signedOut(page);
  await page.setViewportSize({ width: 1440, height: 720 });
  let payload: unknown;
  let release = () => {};
  await page.route("**/api/auth/login", async (route) => {
    payload = route.request().postDataJSON();
    await new Promise<void>((resolve) => { release = resolve; });
    await route.fulfill({ status: 429, json: { success: false, message: "UI review: please wait before trying again.", errors: [] } });
  });
  await page.goto("/login");
  await page.getByRole("button", { name: "Sign in to account", exact: true }).click();
  await expect(page.getByLabel("Email or username", { exact: true })).toHaveAttribute("aria-invalid", "true");
  expect(payload).toBeUndefined();
  await page.getByLabel("Email or username", { exact: true }).fill(savedAccounts[0]);
  await page.getByLabel("Password", { exact: true }).fill("UI-review-only-123!");
  await page.getByRole("button", { name: "Sign in to account", exact: true }).click();
  const pending = page.getByRole("button", { name: "Signing in to TrackCOOP...", exact: true });
  await expect(pending).toBeDisabled();
  await expect(pending).toHaveAttribute("aria-busy", "true");
  await expect.poll(() => payload).toEqual({ identifier: savedAccounts[0], password: "UI-review-only-123!" });
  release();
  await expect(page.getByRole("alert").filter({ hasText: "UI review:" })).toContainText("please wait before trying again");
  await expect(page.getByRole("button", { name: "Sign in to account", exact: true })).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1)).toBe(true);
});

test("desktop split fits a short viewport and recent accounts dismiss with keyboard or outside focus", async ({ page }) => {
  await signedOut(page);
  await page.setViewportSize({ width: 1024, height: 700 });
  await page.goto("/login");
  const photo = page.getByRole("region", { name: "Our cooperative", exact: true });
  await expect(photo).toBeVisible();
  const bounds = await photo.boundingBox();
  expect(bounds?.x).toBe(0);
  expect(bounds?.y).toBe(0);
  const recent = page.locator("details");
  await page.getByText("Recent accounts", { exact: true }).click();
  await expect(recent).toHaveAttribute("open", "");
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1)).toBe(true);
  await page.keyboard.press("Escape");
  await expect(recent).not.toHaveAttribute("open", "");
  await expect(recent.locator("summary")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(recent).toHaveAttribute("open", "");
  await page.getByRole("heading", { name: "Sign in to your account", exact: true }).click();
  await expect(recent).not.toHaveAttribute("open", "");
  const contact = page.getByRole("link", { name: "cooperative contact page", exact: true });
  await expect(contact).toBeInViewport();
});
