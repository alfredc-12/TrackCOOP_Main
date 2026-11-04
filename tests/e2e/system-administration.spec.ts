import { createServer, type Server } from "node:http";
import { mkdirSync } from "node:fs";
import assert from "node:assert/strict";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import mysql, { type Pool } from "mysql2/promise";
import { expect, test, type Page } from "@playwright/test";
import { createSettingsRouter } from "../../server/src/modules/system-settings/settings.routes";
import { createSettingsRepository } from "../../server/src/modules/system-settings/settings.repository";
import { createActivityRouter } from "../../server/src/modules/audit-logs/activity.routes";
import { createActivityRepository } from "../../server/src/modules/audit-logs/activity.repository";
import { seedAdministration } from "../../server/src/modules/system-settings/settings.test-fixture";
import { errorHandler } from "../../server/src/middleware/error-handler";
import type { AuthService } from "../../server/src/modules/auth/auth.service";
import type { AuthContext } from "../../server/src/modules/auth/auth.types";
import { AppError } from "../../server/src/utils/app-error";
test.skip(
  process.env.SYSTEM_ADMIN_LOCAL_SQL_TEST !== "1",
  "Opt-in: requires guarded disposable SQL on port 33327, never a shared database.",
);
const origin = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3146",
  api = `http://localhost:${process.env.PLAYWRIGHT_API_PORT ?? 5367}`,
  before = process.env.SYSTEM_ADMIN_VISUAL_STAGE === "before";
let server: Server, pool: Pool;
const actor = (role = "chairman") => ({
  id: role === "chairman" ? "1" : "2",
  username: "review",
  displayName: role === "chairman" ? "Chair Officer" : "Bookkeeping Officer",
  email: "review@example.invalid",
  role,
  accountStatus: "Active",
});
const envelope = (data: unknown) => ({
  success: true,
  data,
  message: "Disposable SQL test fixture",
  meta: {},
});
test.beforeAll(async () => {
  pool = mysql.createPool({
    host: "127.0.0.1",
    port: 33327,
    user: "root",
    database: "trackcoop_system_admin_fixture",
    timezone: "Z",
    dateStrings: true,
  });
  await seedAdministration(pool); // This function guards both @@datadir and DATABASE() before resetting synthetic data.
  const auth = {
    authenticate: async (token: string) => {
      if (!token) throw new AppError("Login required", 401, "UNAUTHENTICATED");
      return {
        sessionId: "fixture",
        tokenHash: "fixture",
        user: actor(token.includes("bookkeeper") ? "bookkeeper" : "chairman"),
      } as AuthContext;
    },
  } as unknown as AuthService;
  const app = express()
    .use(cors({ origin, credentials: true }))
    .use(cookieParser())
    .use(express.json());
  app.get("/api/auth/me", (req, res) => {
    if (!req.cookies.trackcoop_session)
      return res
        .status(401)
        .json({ success: false, message: "Login required", errors: [] });
    return res.json(
      envelope(
        actor(
          String(req.cookies.trackcoop_session).includes("bookkeeper")
            ? "bookkeeper"
            : "chairman",
        ),
      ),
    );
  });
  app.use("/api", createSettingsRouter(auth, createSettingsRepository(pool)));
  app.use("/api", createActivityRouter(auth, createActivityRepository(pool)));
  app.use("/api", (req, res) =>
    req.method === "GET"
      ? res.json(envelope([]))
      : res
          .status(404)
          .json({ success: false, message: "Not found", errors: [] }),
  );
  app.use(errorHandler);
  server = createServer(app);
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(Number(process.env.PLAYWRIGHT_API_PORT ?? 5367), resolve);
  });
  mkdirSync(
    `.taste-skill/system-administration/${before ? "before" : "after"}`,
    { recursive: true },
  );
});
test.afterAll(async () => {
  await new Promise<void>((resolve) => server?.close(() => resolve()));
  await pool?.end();
});
async function session(page: Page) {
  await page.context().addCookies([
    {
      name: "trackcoop_session",
      value: "system-admin-chairman",
      url: origin,
    },
  ]);
}
async function settings(page: Page) {
  await session(page);
  await page.goto("/portal/chairman/settings");
  await expect(
    page
      .getByRole("main")
      .getByRole("heading", { name: "System Settings", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("spinbutton", {
      name: "Associate membership fee (PHP)",
      exact: true,
    }),
  ).toHaveValue("240");
}
async function choose(page: Page, label: string, option: string) {
  await page.getByRole("combobox", { name: label, exact: true }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}
for (const width of [1440, 768, 390])
  test(`settings and history presentation at ${width}px`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await session(page);
    await page.setViewportSize({ width, height: 1000 });
    for (const [route, title] of [
      ["settings", "System Settings"],
      ["audit-logs", "Activity History"],
    ]) {
      await page.goto(`/portal/chairman/${route}`);
      await expect(
        page.getByRole("main").getByRole("heading", {
          name: before ? "Settings and Audit" : title,
          exact: true,
        }),
      ).toBeVisible();
      if (before)
        await expect(
          page.getByRole("cell", {
            name: "membership.associate_fee",
            exact: true,
          }),
        ).toBeVisible();
      else
        await expect(
          page.getByRole("button", {
            name: route === "settings" ? "Refresh" : "Next activity page",
            exact: true,
          }),
        ).toBeEnabled();
      await page.screenshot({
        path: `.taste-skill/system-administration/${before ? "before" : "after"}/${route}-${width}.png`,
        fullPage: true,
        animations: "disabled",
      });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBeTruthy();
      if (!before && route === "settings") {
        await page
          .getByRole("tab", { name: "Referral Rewards", exact: true })
          .click();
        await expect(
          page.getByRole("spinbutton", {
            name: "Credits per successful referral",
            exact: true,
          }),
        ).toHaveValue("7");
        await page.screenshot({
          path: `.taste-skill/system-administration/after/referrals-${width}.png`,
          fullPage: true,
          animations: "disabled",
        });
        await page
          .getByRole("spinbutton", {
            name: "Credits per successful referral",
            exact: true,
          })
          .fill("10");
        await page
          .getByRole("button", { name: "Review & save", exact: true })
          .click();
        await expect(page.getByRole("dialog")).toBeVisible();
        await page.screenshot({
          path: `.taste-skill/system-administration/after/review-${width}.png`,
        });
        await page
          .getByRole("dialog")
          .getByRole("button", { name: "Cancel", exact: true })
          .click();
        await page
          .getByRole("button", { name: "Discard changes", exact: true })
          .click();
        await page
          .getByRole("tab", { name: "Member Indicators", exact: true })
          .click();
        await page.screenshot({
          path: `.taste-skill/system-administration/after/indicators-${width}.png`,
          fullPage: true,
          animations: "disabled",
        });
      }
      if (!before && route === "audit-logs") {
        await page
          .getByRole("button", { name: /View activity/ })
          .filter({ visible: true })
          .first()
          .click();
        const detail = page.getByRole("dialog", { name: "Activity details" });
        await expect(
          detail.getByRole("heading", { name: "Previous values" }),
        ).toBeVisible();
        await detail.evaluate(async (el) => {
          await Promise.all(
            el
              .getAnimations()
              .map((animation) => animation.finished.catch(() => undefined)),
          );
        });
        await page.screenshot({
          path: `.taste-skill/system-administration/after/details-${width}.png`,
        });
        await page.keyboard.press("Escape");
      }
    }
    expect(errors).toEqual([]);
  });
test("settings review, cancellation and confirmed referral save update real SQL and safe Activity History", async ({
  page,
}) => {
  await settings(page);
  await page
    .getByRole("tab", { name: "Referral Rewards", exact: true })
    .click();
  await expect(
    page.getByRole("spinbutton", {
      name: "Credits per successful referral",
      exact: true,
    }),
  ).toHaveValue("7");
  await page
    .getByRole("spinbutton", {
      name: "Credits per successful referral",
      exact: true,
    })
    .fill("9");
  await page
    .getByRole("button", { name: "Review & save", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Confirm settings changes" });
  await expect(dialog).toContainText("Before:");
  await expect(dialog).toContainText("After:");
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  const still = (
    await (await page.request.get(api + "/api/system-settings/catalog")).json()
  ).data;
  assert.equal(
    still.settings.find(
      (s: { key: string }) => s.key === "referrals.reward_policy",
    ).value.creditsPerSuccessfulReferral,
    7,
  );
  await page
    .getByRole("button", { name: "Review & save", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Save changes", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Settings saved.");
  await page.goto("/portal/chairman/audit-logs?category=settings");
  await page
    .getByRole("button", { name: "Updated a system setting", exact: true })
    .filter({ visible: true })
    .first()
    .click();
  const detail = page.getByRole("dialog", { name: "Activity details" });
  await expect(
    detail.getByRole("heading", { name: "Previous values" }),
  ).toBeVisible();
  await expect(detail).toContainText("Credits per successful referral");
  await expect(detail).toContainText("9");
  await expect(detail).not.toContainText("settingValue");
  await page.keyboard.press("Escape");
  await expect(detail).toHaveCount(0);
});
test("unsupported policies are view-only and invalid inputs do not open confirmation or change values", async ({
  page,
}) => {
  await settings(page);
  await expect(
    page.getByRole("spinbutton", { name: /Initial capital payment/ }),
  ).toHaveCount(0);
  await expect(page.getByText(/fixed workflow value: 1500 PHP$/)).toBeVisible();
  await page
    .getByRole("tab", { name: "Inventory Controls", exact: true })
    .click();
  await expect(
    page.getByText("Stock deductions above availability are blocked", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByRole("switch")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Review & save", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("tab", { name: "Referral Rewards", exact: true })
    .click();
  await page
    .getByRole("spinbutton", {
      name: "Credits per successful referral",
      exact: true,
    })
    .fill("101");
  await page
    .getByRole("button", { name: "Review & save", exact: true })
    .click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "0 to 100",
  );
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Discard changes", exact: true })
    .click();
  await page
    .getByRole("tab", { name: "Member Indicators", exact: true })
    .click();
  await page
    .getByRole("spinbutton", {
      name: "Active minimum total score",
      exact: true,
    })
    .fill("4");
  await page
    .getByRole("button", { name: "Review & save", exact: true })
    .click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "higher minimum",
  );
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
test("drafts survive category navigation and refresh requires discard confirmation", async ({
  page,
}) => {
  await settings(page);
  await page
    .getByRole("spinbutton", {
      name: "Associate membership fee (PHP)",
      exact: true,
    })
    .fill("280");
  await page
    .getByRole("tab", { name: "Referral Rewards", exact: true })
    .click();
  await page
    .getByRole("tab", { name: "Membership Rules", exact: true })
    .click();
  await expect(
    page.getByRole("spinbutton", {
      name: "Associate membership fee (PHP)",
      exact: true,
    }),
  ).toHaveValue("280");
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  const dialog = page.getByRole("dialog", {
    name: "Discard changes and refresh?",
  });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(
    page.getByRole("spinbutton", {
      name: "Associate membership fee (PHP)",
      exact: true,
    }),
  ).toHaveValue("280");
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await dialog
    .getByRole("button", { name: "Discard & refresh", exact: true })
    .click();
  await expect(
    page.getByRole("spinbutton", {
      name: "Associate membership fee (PHP)",
      exact: true,
    }),
  ).toHaveValue("240");
});
test("concurrent setting updates are detected rather than silently overwritten", async ({
  page,
}) => {
  await settings(page);
  const catalog = (
      await (
        await page.request.get(api + "/api/system-settings/catalog")
      ).json()
    ).data,
    entry = catalog.settings.find(
      (s: { key: string }) => s.key === "membership.associate_fee",
    );
  await page
    .getByRole("spinbutton", {
      name: "Associate membership fee (PHP)",
      exact: true,
    })
    .fill("300");
  const external = await page.request.put(api + "/api/system-settings/batch", {
    data: {
      changes: [
        { key: entry.key, value: 245, expectedRevision: entry.revision },
      ],
    },
  });
  expect(external.ok()).toBeTruthy();
  await page
    .getByRole("button", { name: "Review & save", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Save changes", exact: true })
    .click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Someone changed",
  );
  const after = (
    await (await page.request.get(api + "/api/system-settings/catalog")).json()
  ).data;
  assert.equal(
    after.settings.find((s: { key: string }) => s.key === entry.key).value,
    245,
  );
});
test("activity pagination preserves all records and filters use actual users, labels, references and Philippine dates", async ({
  page,
}) => {
  await session(page);
  await page.goto("/portal/chairman/audit-logs?category=finance");
  await expect(
    page.getByText("35 records · newest first · Philippine time", {
      exact: true,
    }),
  ).toBeVisible();
  const first = await page
    .locator('table tbody button[aria-label^="View activity"]')
    .evaluateAll((items) => items.map((el) => el.getAttribute("aria-label")));
  await page
    .getByRole("button", { name: "Next activity page", exact: true })
    .click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.getByText("11–20 of 35", { exact: true })).toBeVisible();
  const second = await page
    .locator('table tbody button[aria-label^="View activity"]')
    .evaluateAll((items) => items.map((el) => el.getAttribute("aria-label")));
  expect(first.some((id) => second.includes(id))).toBeFalsy();
  await page.reload();
  await expect(page.getByText("11–20 of 35", { exact: true })).toBeVisible();
  await page.goto(
    "/portal/chairman/audit-logs?search=Created+a+gallery&userId=3&start=2026-11-02&end=2026-11-02",
  );
  await expect(
    page
      .getByRole("button", { name: "Created a gallery", exact: true })
      .filter({ visible: true }),
  ).toBeVisible();
  await expect(page.locator("table time")).toContainText("1:00");
  await expect(
    page.getByText("1 record · newest first · Philippine time", {
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Clear all", exact: true }).click();
  await page
    .getByRole("searchbox", {
      name: "Search activity, user or record",
      exact: true,
    })
    .fill("FIN-23");
  await expect(page).toHaveURL(/search=FIN-23/);
  await expect(
    page.getByText("1 record · newest first · Philippine time", {
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Remove Search filter" }).click();
  await page.getByRole("button", { name: "More activity filters" }).click();
  await choose(page, "Responsible user", "Maria Officer (#3)");
  await choose(page, "Activity category", "Public Website");
  await page
    .getByRole("button", { name: "Apply filters", exact: true })
    .click();
  await expect(page).toHaveURL(/userId=3/);
  await expect(
    page
      .getByRole("button", { name: "Created a gallery", exact: true })
      .filter({ visible: true }),
  ).toBeVisible();
});
test("activity detail is read-only, redacts secrets and returns keyboard focus", async ({
  page,
}) => {
  await session(page);
  await page.goto("/portal/chairman/audit-logs?userId=system");
  const view = page
    .getByRole("button", { name: /View activity/ })
    .filter({ visible: true })
    .first();
  await view.click();
  const detail = page.getByRole("dialog", { name: "Activity details" });
  await expect(detail).toContainText("Reset a user password");
  await expect(detail).toContainText(
    "Not recorded, or no safe displayable values are available.",
  );
  await expect(page.getByText("private-value-for-redaction-test")).toHaveCount(
    0,
  );
  await expect(detail.getByRole("button", { name: /Edit|Delete/ })).toHaveCount(
    0,
  );
  await page.keyboard.press("Escape");
  await expect(detail).toHaveCount(0);
  await expect(view).toBeFocused();
});
test("empty results and failed initial requests show recoverable states", async ({
  page,
}) => {
  await session(page);
  await page.goto("/portal/chairman/audit-logs?search=no-matching-fixture");
  await expect(
    page.getByRole("heading", { name: "No matching activity" }),
  ).toBeVisible();
  let fail = true;
  await page.route(api + "/api/system-settings/catalog", (route) =>
    fail
      ? route.fulfill({
          status: 503,
          json: {
            success: false,
            message: "Settings temporarily unavailable",
            errors: [],
          },
        })
      : route.continue(),
  );
  await page.goto("/portal/chairman/settings");
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Settings temporarily unavailable",
  );
  fail = false;
  await page.getByRole("button", { name: "Retry settings" }).click();
  await expect(
    page.getByRole("tab", { name: "Membership Rules", exact: true }),
  ).toBeVisible();
});
