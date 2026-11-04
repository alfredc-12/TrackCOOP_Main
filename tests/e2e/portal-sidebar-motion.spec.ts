import { createServer, type Server } from "node:http";
import { mkdirSync, readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

const origin = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3144";
const api = `http://localhost:${process.env.PLAYWRIGHT_API_PORT ?? "5365"}`;
const fixture = JSON.parse(
  readFileSync("tests/fixtures/financial-overview.json", "utf8"),
);
const stage = process.env.SIDEBAR_VISUAL_STAGE ?? "after";
const directory = `.taste-skill/sidebar/${stage}`;
const actor = (role = "chairman") => ({
  id: "sidebar-review",
  username: "sidebar-review",
  displayName: "Navigation Review",
  email: "review@example.invalid",
  role,
  accountStatus: "Active",
});
const envelope = (data: unknown) => ({
  success: true,
  data,
  message: "Navigation test fixture",
  meta: {},
});
let server: Server;
test.beforeAll(async () => {
  mkdirSync(directory, { recursive: true });
  server = createServer((request, response) => {
    response.setHeader("content-type", "application/json");
    response.end(
      JSON.stringify(
        envelope(
          request.url === "/api/auth/me"
            ? actor(
                request.headers.cookie?.includes("bookkeeper")
                  ? "bookkeeper"
                  : "chairman",
              )
            : [],
        ),
      ),
    );
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(Number(process.env.PLAYWRIGHT_API_PORT ?? 5365), resolve);
  });
});
test.afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});
async function setup(page: Page, role = "chairman") {
  await page
    .context()
    .addCookies([
      { name: "trackcoop_session", value: `sidebar-${role}`, url: origin },
    ]);
  await page.route(`${api}/api/**`, (route) => {
    if (route.request().method() !== "GET")
      throw new Error("Navigation review must not mutate application data");
    const path = new URL(route.request().url()).pathname;
    let data: unknown = [];
    if (path === "/api/auth/me") data = actor(role);
    else if (path === "/api/financial-overview/summary") data = fixture.report;
    else if (path === "/api/financial-overview/options") data = fixture.options;
    else if (path === "/api/financial-overview/transactions")
      data = fixture.activity;
    else if (path === "/api/financial-records/summary")
      data = {
        incomeTotal: 0,
        expenseTotal: 0,
        adjustmentTotal: 0,
        netTotal: 0,
        activeRecords: 0,
        voidedRecords: 0,
      };
    else if (path === "/api/operating-expenses")
      data = { items: [], byType: [], total: 0, count: 0 };
    if (path === "/api/documents")
      return route.fulfill({
        json: {
          documents: [],
          summary: {
            total: 0,
            recentlyUploaded: 0,
            expiringSoon: 0,
            archived: 0,
            restricted: 0,
          },
          total: 0,
          page: 1,
          pageSize: 5,
          filterOptions: { uploaders: [] },
        },
      });
    return route.fulfill({ json: envelope(data) });
  });
  await page.goto(
    role === "bookkeeper"
      ? "/portal/bookkeeper/operating-expenses"
      : "/portal/chairman/finance",
  );
  await expect(page.getByRole("main")).toBeVisible();
}
async function navigation(page: Page, width = 1440) {
  await page.setViewportSize({ width, height: 900 });
  await setup(page);
  if (width < 1024) {
    await page
      .getByRole("button", { name: "Open navigation", exact: true })
      .click();
    return page.getByRole("dialog", { name: "Portal navigation" });
  }
  return page.locator("aside").filter({ visible: true });
}
for (const width of [1440, 768, 390])
  test(`navigation presentation at ${width}px`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const rail = await navigation(page, width);
    await expect(
      rail.getByRole("link", { name: "Financial Overview", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    await expect(
      rail.getByRole("button", { name: "Finance", exact: true }),
    ).toHaveAttribute("aria-expanded", "true");
    await rail.evaluate(async (element) => {
      await Promise.all(
        element
          .getAnimations({ subtree: true })
          .map((animation) => animation.finished.catch(() => undefined)),
      );
    });
    await page.screenshot({ path: `${directory}/sidebar-${width}.png` });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
    expect(errors).toEqual([]);
  });
test("accordion animates both directions, excludes closed links from focus and survives interrupted toggles", async ({
  page,
}) => {
  const rail = await navigation(page);
  const finance = rail.getByRole("button", { name: "Finance", exact: true });
  const id = await finance.getAttribute("aria-controls");
  expect(id).toBeTruthy();
  const panel = rail.locator(`[id="${id}"]`);
  await finance.focus();
  await finance.press("Space");
  await expect(finance).toHaveAttribute("aria-expanded", "false");
  await expect(panel).toHaveAttribute("inert", "");
  await expect(
    rail.getByRole("link", { name: "Payments", exact: true }),
  ).toHaveCount(0);
  await page.keyboard.press("Tab");
  await expect(
    rail.getByRole("button", { name: "Operations", exact: true }),
  ).toBeFocused();
  await finance.click();
  await expect(panel).not.toHaveAttribute("inert", "");
  await finance.click();
  await finance.click();
  await finance.click();
  await expect(finance).toHaveAttribute("aria-expanded", "false");
  await finance.press("Enter");
  await expect(
    rail.getByRole("link", { name: "Payments", exact: true }),
  ).toBeVisible();
});
test("hover and focus give feedback; route selection expands the correct group and follows browser back", async ({
  page,
}) => {
  const rail = await navigation(page);
  const link = rail.getByRole("link", { name: "Payments", exact: true });
  const before = await link.evaluate(
    (el) => getComputedStyle(el, "::before").opacity,
  );
  await link.hover();
  await expect
    .poll(() => link.evaluate((el) => getComputedStyle(el, "::before").opacity))
    .not.toBe(before);
  await link.focus();
  expect(
    await link.evaluate((el) => getComputedStyle(el).outlineStyle),
  ).not.toBe("none");
  await rail.getByRole("button", { name: "Records", exact: true }).click();
  await rail.getByRole("link", { name: "Documents", exact: true }).click();
  await expect(page).toHaveURL(/documents/);
  await expect(
    rail.getByRole("link", { name: "Documents", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await expect(rail.locator('a[aria-current="page"]')).toHaveCount(1);
  await page.goBack();
  await expect(page).toHaveURL(/chairman\/finance$/);
  // Preserve the existing per-path manual accordion choice when returning with Back.
  await expect(
    rail.getByRole("button", { name: "Records", exact: true }),
  ).toHaveAttribute("aria-expanded", "true");
  await rail.getByRole("button", { name: "Finance", exact: true }).click();
  await expect(
    rail.getByRole("link", { name: "Financial Overview", exact: true }),
  ).toHaveAttribute("aria-current", "page");
});
test("mobile drawer enters/exits, traps focus, closes by Escape/backdrop and returns focus", async ({
  page,
}) => {
  const drawer = await navigation(page, 390);
  await expect(drawer).toHaveAttribute("data-state", "open");
  const close = drawer.getByRole("button", {
    name: "Close navigation",
    exact: true,
  });
  await close.focus();
  await close.press("Tab");
  expect(
    await drawer.evaluate((el) => el.contains(document.activeElement)),
  ).toBeTruthy();
  await page.keyboard.press("Escape");
  await expect(drawer).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Open navigation", exact: true }),
  ).toBeFocused();
  await page
    .getByRole("button", { name: "Open navigation", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.mouse.click(383, 350);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Open navigation", exact: true })
    .click();
  await close.click();
  const leaving = page.locator('[role="dialog"][data-state="closed"]');
  await expect(leaving).toBeAttached();
  await expect(leaving).toHaveCount(0);
});
test("mobile link navigation closes the drawer and desktop resize releases the modal", async ({
  page,
}) => {
  let drawer = await navigation(page, 768);
  await drawer.getByRole("button", { name: "Records", exact: true }).click();
  await drawer.getByRole("link", { name: "Documents", exact: true }).click();
  await expect(page).toHaveURL(/documents/);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Open navigation", exact: true })
    .click();
  drawer = page.getByRole("dialog", { name: "Portal navigation" });
  await expect(drawer).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(drawer).toHaveCount(0);
  await expect(page.locator('aside a[aria-current="page"]')).toHaveText(
    "Documents",
  );
});
test("short screens keep navigation scrollable with a themed scrollbar and reachable final groups", async ({
  page,
}) => {
  const rail = await navigation(page);
  await page.setViewportSize({ width: 1440, height: 480 });
  const nav = rail.getByRole("navigation");
  expect(await nav.evaluate((el) => getComputedStyle(el).scrollbarWidth)).toBe(
    "thin",
  );
  expect(
    await nav.evaluate((el) => getComputedStyle(el).scrollbarColor),
  ).not.toBe("auto");
  const system = rail.getByRole("button", { name: "System", exact: true });
  await system.scrollIntoViewIfNeeded();
  await expect(system).toBeInViewport();
  expect(await nav.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
});
test("reduced motion removes sliding while retaining selection and disclosure", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const rail = await navigation(page);
  const finance = rail.getByRole("button", { name: "Finance", exact: true });
  const id = await finance.getAttribute("aria-controls");
  const panel = rail.locator(`[id="${id}"]`);
  expect(
    await panel.evaluate((el) => getComputedStyle(el).transitionDuration),
  ).toBe("0s");
  await finance.click();
  await finance.click();
  await expect(
    rail.getByRole("link", { name: "Financial Overview", exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 900 });
  await page
    .getByRole("button", { name: "Open navigation", exact: true })
    .click();
  const drawer = page.getByRole("dialog");
  expect(
    await drawer.evaluate((el) => getComputedStyle(el).animationName),
  ).toBe("none");
  await page.keyboard.press("Escape");
  await expect(drawer).toHaveCount(0);
});
test("Bookkeeper uses the same interactions with its original destinations", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await setup(page, "bookkeeper");
  const rail = page.locator("aside").filter({ visible: true });
  await expect(
    rail.getByText("Bookkeeper Portal", { exact: true }),
  ).toBeVisible();
  await expect(rail.locator('a[aria-current="page"]')).toHaveText(
    "Operating Expenses",
  );
  for (const href of await rail
    .getByRole("link")
    .evaluateAll((links) =>
      links.map((link) => (link as HTMLAnchorElement).getAttribute("href")),
    ))
    expect(href).toMatch(/^\/portal\/bookkeeper/);
});
