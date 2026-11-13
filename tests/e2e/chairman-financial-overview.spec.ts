import { createServer, type Server } from "node:http";
import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

// Arithmetic fixture was captured from overview.mysql.test.ts on disposable SQL.
// Browser requests are mocked; accounting truth is tested separately against SQL.
const fixture = JSON.parse(
  readFileSync("tests/fixtures/financial-overview.json", "utf8"),
);
const apiPort = Number(process.env.PLAYWRIGHT_API_PORT ?? 5359);
const api = `http://localhost:${apiPort}`;
const origin = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3140";
const path =
  "/portal/chairman/finance?period=custom&startDate=2026-10-01&endDate=2026-10-31";
const chairman = {
  id: "2",
  username: "chairman",
  email: "chairman@example.test",
  displayName: "Chairman",
  role: "chairman",
  accountStatus: "Active",
};
let server: Server;
const envelope = (data: unknown) =>
  JSON.stringify({ success: true, message: "ok", data, meta: {} });
test.beforeAll(async () => {
  server = createServer((req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.end(
      envelope(
        req.url === "/api/auth/me"
          ? {
              ...chairman,
              role: req.headers.cookie?.includes("fixture-bookkeeper")
                ? "bookkeeper"
                : "chairman",
            }
          : [],
      ),
    );
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(apiPort, resolve);
  });
});
test.afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});
async function mock(
  page: Page,
  options: {
    empty?: boolean;
    fail?: boolean;
    delay?: boolean;
    role?: string;
  } = {},
) {
  const seen: URL[] = [];
  await page
    .context()
    .addCookies([
      {
        name: "trackcoop_session",
        value:
          options.role === "bookkeeper"
            ? "fixture-bookkeeper"
            : "fixture-chairman",
        url: origin,
      },
    ]);
  await page.route(`${api}/api/**`, async (route) => {
    const url = new URL(route.request().url());
    seen.push(url);
    const respond = (data: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        headers: {
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Credentials": "true",
        },
        body: envelope(data),
      });
    if (url.pathname === "/api/auth/me")
      return respond({ ...chairman, role: options.role ?? "chairman" });
    if (url.pathname === "/api/seasons") return respond([]);
    if (url.pathname === "/api/operating-expenses")
      return respond(
        route.request().method() === "POST"
          ? { id: "fixture-expense" }
          : { items: [], byType: [], total: 0, count: 0 },
      );
    if (url.pathname.endsWith("/options")) return respond(fixture.options);
    if (url.pathname.endsWith("/export"))
      return route.fulfill({
        status: 200,
        body: "test download",
        headers: { "content-type": "application/octet-stream" },
      });
    if (url.pathname.match(/financial-overview\/transactions\/\d+$/))
      return respond(fixture.detail);
    if (url.pathname.endsWith("/summary")) {
      if (options.fail)
        return route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({
            success: false,
            message: "Database temporarily unavailable",
            errors: [],
          }),
        });
      if (options.delay)
        await new Promise((resolve) => setTimeout(resolve, 200));
      if (options.empty) {
        const r = structuredClone(fixture.report);
        r.summary = {
          income: "0.00",
          expense: "0.00",
          net: "0.00",
          incomeRecords: 0,
          expenseRecords: 0,
        };
        r.categories = { income: [], expense: [] };
        r.sources = [];
        r.trend = [];
        return respond(r);
      }
      return respond(fixture.report);
    }
    if (url.pathname.endsWith("/transactions")) {
      let items = options.empty ? [] : fixture.activity.items;
      const view = url.searchParams.get("view");
      if (view === "income" || view === "expense")
        items = items.filter(
          (r: { type: string }) => r.type.toLowerCase() === view,
        );
      if (url.searchParams.get("focusCategoryId"))
        items = items.filter(
          (r: { categoryId: string }) =>
            r.categoryId === url.searchParams.get("focusCategoryId"),
        );
      if (url.searchParams.get("focusSource"))
        items = items.filter(
          (r: { source: string }) =>
            r.source === url.searchParams.get("focusSource"),
        );
      if (url.searchParams.get("search"))
        items = items.filter((r: { number: string }) =>
          r.number.includes(url.searchParams.get("search")!),
        );
      const size = Number(url.searchParams.get("pageSize") ?? 10),
        pageNumber = Number(url.searchParams.get("page") ?? 1);
      return respond({
        ...fixture.activity,
        items: items.slice((pageNumber - 1) * size, pageNumber * size),
        total: items.length,
        page: pageNumber,
        pageSize: size,
      });
    }
    return respond([]);
  });
  return seen;
}
async function choose(page: Page, label: string, option: string) {
  await page.getByRole("combobox", { name: label, exact: true }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}
for (const width of [1440, 768, 390])
  test(`responsive overview and record drawer at ${width}px`, async ({
    page,
  }, info) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.setViewportSize({ width, height: 960 });
    await mock(page);
    await page.goto(path);
    const main = page.getByRole("main");
    await expect(
      main.getByRole("heading", { name: "Financial Overview", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Money In: ₱1,881.10", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
    const expenses = page.getByRole("region", { name: "Where Money Goes" });
    await expect(expenses.getByRole("button", { name: /expense records$/ })).toHaveCount(3);
    await expect(expenses.getByRole("button", { name: "View all 4 categories" })).toBeVisible();
    await expenses.getByRole("button", { name: "View all 4 categories" }).click();
    await expect(page.getByRole("dialog").getByRole("button", { name: "View Office supplies expense records" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.screenshot({
      path: info.outputPath(`overview-${width}.png`),
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Inspect FIN-12", exact: true })
      .filter({ visible: true })
      .click();
    const drawer = page.getByRole("dialog");
    await expect(drawer).toBeVisible();
    await expect(
      drawer.getByText("Approved correction receipt", { exact: true }),
    ).toBeVisible();
    await expect(drawer.getByText("Restricted private receipt")).toHaveCount(0);
    await expect(
      drawer.getByRole("heading", { name: "Recorded audit history" }),
    ).toBeVisible();
    await page.screenshot({
      path: info.outputPath(`record-${width}.png`),
      fullPage: true,
    });
    await page.keyboard.press("Escape");
    await expect(drawer).toHaveCount(0);
    await expect(
      page
        .getByRole("button", { name: "Inspect FIN-12", exact: true })
        .filter({ visible: true }),
    ).toBeFocused();
    expect(errors).toEqual([]);
  });
test("KPI, category, source and accessible trend selection preserve posted headline scope", async ({
  page,
}) => {
  const seen = await mock(page);
  await page.goto(path);
  await page
    .getByRole("button", { name: "Money In: ₱1,881.10", exact: true })
    .click();
  await expect(page).toHaveURL(/view=income/);
  await expect(
    page.getByRole("button", { name: "Money Out: ₱450.30", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "View Donations and grants income records",
      exact: true,
    })
    .click();
  await expect(page).toHaveURL(/focusCategoryId=3/);
  expect(
    seen
      .filter((u) => u.pathname.endsWith("/summary"))
      .every(
        (u) =>
          !u.searchParams.has("focusCategoryId") && !u.searchParams.has("view"),
      ),
  ).toBeTruthy();
  await page
    .getByRole("button", { name: "Remove Activity category filter" })
    .click();
  await page
    .getByRole("button", { name: /View Manual financial activity/ })
    .click();
  await expect(page).toHaveURL(/focusSource=Manual/);
  await page
    .getByText("View trend figures and period records", { exact: true })
    .click();
  await page
    .getByRole("button", { name: /View activity for/ })
    .first()
    .press("Enter");
  await expect(page).toHaveURL(/focusStart=/);
});
test("advanced custom controls, URL restoration, debounce, sorting and complete export requests", async ({
  page,
}) => {
  const seen = await mock(page);
  await page.goto(path);
  await page.getByRole("button", { name: "More Overview filters" }).click();
  await choose(page, "Rows per page", "5");
  await choose(page, "Sort by", "Amount");
  await choose(page, "Sort direction", "Ascending");
  await choose(page, "Compare with", "No comparison");
  await page
    .getByRole("button", { name: "Apply filters", exact: true })
    .click();
  await expect(page).toHaveURL(/sortBy=amount/);
  await expect(page).toHaveURL(/pageSize=5/);
  await page.getByRole("button", { name: "Next finance page" }).click();
  await expect(page).toHaveURL(/page=2/);
  await page.reload();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.getByText("6–10 of 10", { exact: true })).toBeVisible();
  await page
    .getByRole("searchbox", { name: "Search records, category or reference" })
    .fill("FIN-12");
  await expect(page).toHaveURL(/search=FIN-12/);
  await page.getByRole("button", { name: "Remove Search filter" }).click();
  await expect(page).not.toHaveURL(/search=FIN/);
  for (const format of ["Excel", "PDF"]) {
    const download = page.waitForEvent("download");
    await page
      .getByRole("button", { name: `Export ${format}`, exact: true })
      .click();
    expect((await download).suggestedFilename()).toBe(
      `trackcoop-financial-overview.${format === "PDF" ? "pdf" : "xlsx"}`,
    );
  }
  expect(seen.filter((u) => u.pathname.endsWith("/export")).length).toBe(2);
  await page.getByRole("button", { name: "Clear all", exact: true }).click();
  await expect(page).toHaveURL(/period=this_month/);
  await page.goBack();
  await expect(page).toHaveURL(/period=custom/);
  await expect(
    page.getByRole("button", {
      name: /record expense|post record|void record|edit financial/i,
    }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("main").getByText(/Approved Budget|Budget Context/),
  ).toHaveCount(0);
});
test("empty results, errors and retry retain honest states", async ({
  page,
}) => {
  const state = { empty: true, fail: false };
  await mock(page, state);
  await page.goto(path);
  await expect(
    page.getByText(
      "No financial records match this activity view. Change the filters or return to posted activity.",
    ),
  ).toBeVisible();
  state.empty = false;
  state.fail = true;
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Database temporarily unavailable",
  );
  state.fail = false;
  await page.getByRole("button", { name: "Retry Overview" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Money In: ₱1,881.10", exact: true }),
  ).toBeVisible();
});

test("custom calendar selection commits a date only when applied", async ({
  page,
}) => {
  await mock(page);
  await page.goto(path);
  await page
    .getByRole("button", { name: "Reporting start", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "2", exact: true }).first()
    .click();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(page).toHaveURL(/startDate=2026-10-01/);
  await page
    .getByRole("button", { name: "Apply filters", exact: true })
    .click();
  await expect(page).toHaveURL(/startDate=2026-10-02/);
});
test("Bookkeeper still has an operational expense recording form", async ({
  page,
}) => {
  await mock(page, { role: "bookkeeper" });
  await page.goto("/portal/bookkeeper/operating-expenses");
  await expect(
    page
      .getByRole("main")
      .getByRole("heading", { name: "Operating Expenses", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("spinbutton", { name: "Amount", exact: true })
    .fill("12.50");
  const posted = page.waitForRequest(
    (request) =>
      request.url().includes("/api/operating-expenses") &&
      request.method() === "POST",
  );
  await page.getByRole("button", { name: "Add", exact: true }).click();
  expect((await posted).postDataJSON().amount).toBe(12.5);
  await expect(
    page.getByText("Operating expense recorded and posted.", { exact: true }),
  ).toBeVisible();
});
