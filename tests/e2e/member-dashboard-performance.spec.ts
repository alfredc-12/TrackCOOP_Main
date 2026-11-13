import { expect, test, type Page } from "@playwright/test";

async function fixture(page: Page, options: { livelihoodsUnavailable?: boolean; failDashboard?: boolean } = {}) {
  const requests: URL[] = [];
  let hold: Promise<void> | undefined;
  let holdFor: (url: URL) => boolean = () => true;
  let release: (() => void) | undefined;
  await page.setExtraHTTPHeaders({ "x-trackcoop-internal-rewrite": "1" });
  await page.route("https://raw.githubusercontent.com/**", route => route.fulfill({ json: { RECORDS: [] } }));
  await page.route("**/api/**", async route => {
    const url = new URL(route.request().url());
    requests.push(url);
    if (route.request().method() !== "GET") throw new Error("Performance checks must not mutate application data");
    const envelope = (data: unknown) => ({ success: true, data });
    if (url.pathname === "/api/auth/me") return route.fulfill({ json: envelope({ id: "7", displayName: "Performance Member", email: "member@example.invalid", role: "member" }) });
    if (url.pathname === "/api/members/me/dashboard") {
      if (options.failDashboard) return route.fulfill({ status: 400, json: { error: "Synthetic dashboard validation failed" } });
      if (hold && holdFor(url)) await hold;
      return route.fulfill({ json: {
        isLinked: true, membershipType: "True Member", canAccessFinancials: true,
        member: { code: "PERF-7", livelihoods: [], livelihoodsUnavailable: options.livelihoodsUnavailable ?? false, occupation: "Farmer", memberSince: "2026-01-01" },
        shareCapital: { total: 3000 }, recentActivity: [], recentCapitalContributions: [], unreadUpdates: {},
        stats: { announcements: 0, purchases: 1, deposits: 1, rentals: 0 }, referrals: { code: "REF-PERF-7", items: [] },
        memberFinancialSummary: url.searchParams.get("includeFinancialSummary") === "true" ? {
          totalEarnings: url.searchParams.get("period") === "month" ? 222.22 : 125.5, annualInterestEarnings: 0, totalExpenses: 50, netResult: 75.5, shareCapitalContributions: 1500,
          incomeByCategory: [], expenseByCategory: [], transactions: [],
        } : null,
      } });
    }
    if (url.pathname === "/api/members/me/membership-progress") return route.fulfill({ json: envelope({ membershipType: "True Member", sectors: [], capital: null, validatedCapital: 3000 }) });
    if (url.pathname === "/api/members/me/patronage") return route.fulfill({ json: envelope({ member: { code: "PERF-7", name: "Performance Member", membershipType: "True Member" }, currentYear: {}, refunds: { allocatedTotal: 0, paidTotal: 0, pendingTotal: 0 }, history: [] }) });
    return route.fulfill({ json: envelope([]) });
  });
  return {
    requests,
    count: (path: string) => requests.filter(request => request.pathname === path).length,
    pause: (predicate: (url: URL) => boolean = () => true) => { holdFor = predicate; hold = new Promise<void>(resolve => { release = resolve; }); },
    resume: () => { hold = undefined; release?.(); },
  };
}

async function selectTab(page: Page, tab: string) {
  const button = page.getByRole("button", { name: tab, exact: true });
  if (!await button.isVisible()) await page.getByRole("button", { name: "Open member menu", exact: true }).click();
  await button.click();
}

for (const width of [1440, 768, 390]) {
  test(`member home avoids detailed financial requests until the section opens at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.clock.install();
    const data = await fixture(page);
    await page.goto("/member_dashboard");
    await expect(page.getByText("Welcome back, Performance", { exact: false })).toBeVisible();
    await expect(page.getByRole("button", { name: "View My Savings", exact: true })).toBeVisible();
    await page.clock.runFor(1000);
    expect(data.count("/api/members/me/dashboard")).toBe(1);
    expect(data.requests.find(url => url.pathname === "/api/members/me/dashboard")?.searchParams.get("includeFinancialSummary")).toBe("false");
    expect(data.count("/api/members/me/dividends")).toBe(0);
    expect(data.count("/api/members/me/patronage")).toBe(0);
    const authCount = data.count("/api/auth/me");
    await page.clock.runFor(20_000);
    expect(data.count("/api/members/me/dashboard")).toBe(1);
    await page.clock.runFor(40_000);
    await expect.poll(() => data.count("/api/members/me/dashboard")).toBe(2);
    await page.screenshot({ path: info.outputPath(`member-home-${width}.png`), fullPage: true });
    await selectTab(page, "Financial");
    await expect.poll(() => data.requests.filter(url => url.searchParams.get("includeFinancialSummary") === "true").length).toBe(1);
    await expect(page.getByText("₱125.50", { exact: true })).toBeVisible();
    expect(data.count("/api/auth/me")).toBe(authCount);
    await selectTab(page, "Member & Share");
    await expect.poll(() => data.count("/api/members/me/dividends")).toBe(1);
    await expect.poll(() => data.count("/api/members/me/patronage")).toBe(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test("focus and refresh events share one in-flight dashboard request", async ({ page }) => {
  const data = await fixture(page);
  await page.goto("/member_dashboard");
  await expect(page.getByRole("button", { name: "View My Savings", exact: true })).toBeVisible();
  data.pause();
  try {
    await page.evaluate(() => {
      window.dispatchEvent(new Event("focus"));
      window.dispatchEvent(new Event("focus"));
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await expect.poll(() => data.count("/api/members/me/dashboard")).toBe(2);
    expect(data.count("/api/members/me/dividends")).toBe(0);
    expect(data.count("/api/members/me/patronage")).toBe(0);
  } finally { data.resume(); }
});

test("a slow prior financial period cannot overwrite the latest selected period", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const data = await fixture(page);
  await page.goto("/member_dashboard");
  await expect(page.getByRole("button", { name: "View My Savings", exact: true })).toBeVisible();
  data.pause(url => url.searchParams.get("includeFinancialSummary") === "true" && url.searchParams.get("period") === "year");
  try {
    await selectTab(page, "Financial");
    await expect.poll(() => data.requests.some(url => url.searchParams.get("includeFinancialSummary") === "true")).toBe(true);
    await page.getByRole("combobox").filter({ hasText: "This Year" }).click();
    await page.getByRole("option", { name: "This Month", exact: true }).click();
    await expect(page.getByText("₱222.22", { exact: true })).toBeVisible();
    data.resume();
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    await expect(page.getByText("₱222.22", { exact: true })).toBeVisible();
    await expect(page.getByText("₱125.50", { exact: true })).toHaveCount(0);
  } finally { data.resume(); }
});

test("a financial update requests fresh data even while a background refresh is pending", async ({ page }) => {
  const data = await fixture(page);
  await page.goto("/member_dashboard");
  await expect(page.getByRole("button", { name: "View My Savings", exact: true })).toBeVisible();
  data.pause();
  try {
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect.poll(() => data.count("/api/members/me/dashboard")).toBe(2);
    await page.evaluate(() => window.dispatchEvent(new Event("trackcoop:patronage-updated")));
    await expect.poll(() => data.count("/api/members/me/dashboard")).toBe(3);
  } finally { data.resume(); }
});

test("unavailable saved livelihood metadata does not hide the member dashboard", async ({ page }) => {
  await fixture(page, { livelihoodsUnavailable: true });
  await page.goto("/member_dashboard");
  await expect(page.getByRole("button", { name: "View My Savings", exact: true })).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "Some saved crop and livelihood details could not be displayed." })).toBeVisible();
  await expect(page.getByText("₱3,000.00", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("alert").filter({ hasText: "We couldn" })).toHaveCount(0);
});

test("failed dashboard requests retain the HTTP status and API message for diagnosis", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  await fixture(page, { failDashboard: true });
  await page.goto("/member_dashboard");
  await expect(page.getByRole("alert").filter({ hasText: "We couldn" })).toBeVisible();
  await expect.poll(() => errors.some(error => error.includes("HTTP 400") && error.includes("Synthetic dashboard validation failed"))).toBe(true);
});
