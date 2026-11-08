import { expect, test } from "@playwright/test";

const accounts = {
  chairman: { identifier: "chairman.test@trackcoop.local", password: "ChairmanTest123!" },
  bookkeeper: { identifier: "bookkeeper.test@trackcoop.local", password: "BookkeeperTest123!" },
  member: { identifier: "maria.member@trackcoop.local", password: "MemberTest123!" },
} as const;
const routes = {
  chairman: [["member-analytics", "/portal/chairman/dashboard"], ["membership-applications", "/portal/chairman/members/applications"], ["financial-analytics", "/portal/chairman/financial-dashboard"], ["announcements", "/portal/chairman/announcements"], ["rentals", "/portal/chairman/rentals/bookings"]],
  bookkeeper: [["financial-dashboard", "/portal/bookkeeper/financial-dashboard"], ["financial-ledger", "/portal/bookkeeper/financial-ledger"], ["payment-validation", "/portal/bookkeeper/payment-validation"], ["documents", "/portal/bookkeeper/documents"], ["products", "/portal/bookkeeper/products-inventory"]],
  member: [["dashboard", "/portal/member/dashboard"], ["share-capital", "/portal/member/share-capital"]],
} as const;

for (const role of ["chairman", "bookkeeper", "member"] as const) {
  test(`capture ${role} system views with synthetic data`, async ({ context, page }) => {
    const response = await context.request.post("http://127.0.0.1:3218/api/auth/login", { data: accounts[role] });
    expect(response.status()).toBe(200);
    await page.setViewportSize({ width: 1440, height: 900 });
    for (const [label, route] of routes[role]) {
      await page.goto(route);
      await expect(page).toHaveURL(new RegExp(route.replaceAll("/", "\\/")));
      await expect(page.locator("main")).toBeVisible();
      await expect(page.getByText("Loading TrackCOOP...", { exact: true })).toHaveCount(0);
      await expect(page.getByRole("heading", { name: "Page not found" })).toHaveCount(0);
      if (role === "member" && label === "dashboard") await expect(page.getByRole("heading", { name: /Welcome back, Maria/i })).toBeVisible();
      await page.screenshot({ path: `evidence/playwright/${process.env.PLAYWRIGHT_EVIDENCE_RUN ?? "database-run"}/screenshots/${role}-${label}.png`, fullPage: true });
    }
  });
}
