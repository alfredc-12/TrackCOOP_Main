import { test, expect, type Page } from "@playwright/test";
import { createServer, type Server } from "node:http";
import { mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import type { Pool } from "mysql2/promise";
import {
  fixturePool,
  seedGallery,
} from "../../server/src/modules/gallery-placement/gallery-placement.fixture";
import { createGalleryPlacementRepository } from "../../server/src/modules/gallery-placement/gallery-placement.repository";
import { createLandingRepository } from "../../server/src/modules/landing/landing.repository";
import { createLandingService } from "../../server/src/modules/landing/landing.service";
import { createLandingRouter } from "../../server/src/modules/landing/landing.routes";
import type { AuthService } from "../../server/src/modules/auth/auth.service";
import { errorHandler } from "../../server/src/middleware/error-handler";
import { AppError } from "../../server/src/utils/app-error";
test.skip(
  process.env.GALLERY_LOCAL_SQL_TEST !== "1",
  "Opt-in disposable gallery SQL fixture only.",
);
let server: Server, pool: Pool;
const origin = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3147";
const api = `http://localhost:${process.env.PLAYWRIGHT_API_PORT ?? 5368}`;
const before = process.env.GALLERY_VISUAL_STAGE === "before";
const user = {
  id: "1",
  displayName: "Gallery Chair",
  email: "chair@example.invalid",
  username: "gallery-chair",
  accountStatus: "Active",
  role: "chairman",
};
const envelope = (data: unknown) => ({
  success: true,
  data,
  message: "Disposable gallery fixture",
  meta: {},
});
test.beforeAll(async () => {
  pool = await fixturePool();
  await seedGallery(pool);
  const repo = createGalleryPlacementRepository(pool);
  await repo.publish(
    {
      expectedRevision: "0",
      slots: Array.from({ length: 7 }, (_, i) => ({
        position: i + 1,
        photo:
          i < 6
            ? { source: "gallery" as const, photoId: String(i + 1) }
            : { source: "announcement" as const, photoId: "1" },
      })),
    },
    "1",
  );
  const app = express()
    .use(cors({ origin, credentials: true }))
    .use(express.json())
    .use(cookieParser());
  const auth = {
    authenticate: async (token: string) => {
      if (!token) throw new AppError("Login required", 401);
      return {
        user: {
          ...user,
          role: token.includes("member") ? "member" : "chairman",
        },
        sessionId: "fixture",
        tokenHash: "fixture",
      };
    },
  } as unknown as AuthService;
  app.get("/api/auth/me", (req, res) =>
    res.json(
      envelope({
        ...user,
        role: String(req.cookies.trackcoop_session).includes("member")
          ? "member"
          : "chairman",
      }),
    ),
  );
  app.get("/api/public/landing", async (_req, res, next) => {
    try {
      const photos = await repo.publicPhotos();
      res.json(
        envelope({
          partners: [],
          gallery: photos.map((p) => ({ ...p, title: p.altText, caption: "" })),
          recentPhotos: photos.map((p) => ({
            ...p,
            title: p.altText,
            caption: "",
            publishedAt: new Date().toISOString(),
          })),
          landingPhotos: photos,
        }),
      );
    } catch (e) {
      next(e);
    }
  });
  app.use("/uploads", express.static(resolve(".gallery-verification/uploads")));
  app.use(
    "/api",
    createLandingRouter(
      auth,
      createLandingService(createLandingRepository(pool)),
      repo,
    ),
  );
  app.get("/api/announcements", (_req, res) => res.json(envelope([])));
  app.use("/api", (_req, res) => res.json(envelope([])));
  app.use(errorHandler);
  server = createServer(app);
  await new Promise<void>((resolve) =>
    server.listen(Number(process.env.PLAYWRIGHT_API_PORT ?? 5368), resolve),
  );
  mkdirSync(`.gallery-verification/${before ? "before" : "after"}`, {
    recursive: true,
  });
});
test.afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await pool.end();
});
async function admin(page: Page) {
  await page
    .context()
    .addCookies([
      { name: "trackcoop_session", value: "gallery-chair", url: origin },
    ]);
  await page.goto("/portal/chairman/landing/gallery");
  await expect(
    page.getByRole("heading", { name: "Landing placement", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Add photos", exact: true }),
  ).toBeVisible();
  if (before)
    await expect(
      page.getByRole("heading", { name: "Harvest field photos", exact: true }),
    ).toBeVisible();
  if (!before)
    await expect(
      page.getByRole("article", {
        name: "gallery: Harvest field photos",
        exact: true,
      }),
    ).toBeVisible();
}
for (const width of [1440, 768, 390])
  test(`gallery workspace and public mosaic at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await admin(page);
    await page.waitForFunction(() =>
      Array.from(document.querySelectorAll<HTMLImageElement>("main img"))
        .filter(
          (i) => i.src.includes("Main%20Photo") || i.src.includes("Post%20"),
        )
        .every((i) => i.complete && i.naturalWidth > 0),
    );
    await page.screenshot({
      path: `.gallery-verification/${before ? "before" : "after"}/admin-${width}.png`,
      fullPage: true,
      animations: "disabled",
    });
    if (before) return;
    if (!before) {
      const group = page.getByRole("article", {
        name: "gallery: Harvest field photos",
        exact: true,
      });
      await group
        .getByRole("button", {
          name: "Browse all 6 photos from Harvest field photos",
        })
        .click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await expect(
        page.getByRole("dialog").getByRole("button", { name: /Select photo/ }),
      ).toHaveCount(6);
      await page.screenshot({
        path: `.gallery-verification/after/browser-${width}.png`,
        animations: "disabled",
      });
      await page.keyboard.press("Escape");
    }
    await page.context().clearCookies();
    await page.goto("/");
    const section = page.locator("#projects");
    await expect(
      section.getByRole("button", { name: /Enlarge photo/ }),
    ).toHaveCount(7);
    await section.scrollIntoViewIfNeeded();
    await section.screenshot({
      path: `.gallery-verification/${before ? "before" : "after"}/public-${width}.png`,
      animations: "disabled",
    });
    if (!before) {
      await section
        .getByRole("button", { name: /Enlarge photo/ })
        .first()
        .click();
      await expect(page.getByRole("dialog")).toBeVisible();
      if (width === 1440)
        await expect(page.getByRole("dialog").getByRole("img")).toHaveCSS(
          "max-height",
          "920px",
        );
      await page.screenshot({
        path: `.gallery-verification/after/lightbox-${width}.png`,
        animations: "disabled",
      });
      await page.keyboard.press("Escape");
      await expect(
        section.getByRole("button", { name: /Enlarge photo/ }).first(),
      ).toBeFocused();
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBeTruthy();
    expect(errors).toEqual([]);
  });
test("randomize stays a proposal until explicit publication; restoring keeps the saved arrangement", async ({
  page,
}) => {
  test.skip(before);
  await admin(page);
  const original = await page.request.get(
    `${api}/api/landing/gallery-placement`,
  );
  const saved = (await original.json()).data;
  await page.getByRole("button", { name: "Randomize", exact: true }).click();
  await expect(page.getByText(/Randomized proposal/)).toBeVisible();
  expect(
    (
      await (
        await page.request.get(`${api}/api/landing/gallery-placement`)
      ).json()
    ).data,
  ).toEqual(saved);
  await page
    .getByRole("button", { name: "Restore published", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Restore published", exact: true })
    .click();
  await expect(
    page.getByText(/^Published arrangement .*photos$/),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Save & Publish", exact: true }),
  ).toBeDisabled();
});
test("individual drag/drop, click selection, reorder and publish retain exact source-qualified order", async ({
  page,
}) => {
  test.skip(before);
  await page.setViewportSize({ width: 1440, height: 1100 });
  await admin(page);
  const slot = page.getByRole("button", {
    name: "Choose photo for position 1",
    exact: true,
  });
  const image = page
    .getByRole("article", {
      name: "announcement: General assembly",
      exact: true,
    })
    .getByRole("button", {
      name: "Select photo 2 from General assembly",
      exact: true,
    });
  await image.dragTo(slot, { sourcePosition: { x: 16, y: 52 } });
  await expect(page.getByText(/Unsaved changes/)).toBeVisible();
  await page
    .getByRole("button", { name: "Move photo 1 right", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Choose photo for position 3", exact: true })
    .click();
  await page
    .getByRole("article", {
      name: "gallery: Harvest field photos",
      exact: true,
    })
    .getByRole("button", {
      name: "Select photo 1 from Harvest field photos",
      exact: true,
    })
    .click({ position: { x: 16, y: 52 } });
  await page
    .getByRole("button", { name: "Save & Publish", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Save & Publish", exact: true })
    .click();
  await expect(
    page.getByText("Your homepage photos are published."),
  ).toBeVisible();
  const data = (
    await (
      await page.request.get(`${api}/api/landing/gallery-placement`)
    ).json()
  ).data;
  expect(data.slots[1].photo.id).toBe("announcement:2");
  expect(data.slots[2].photo.id).toBe("gallery:1");
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Save & Publish", exact: true }),
  ).toBeDisabled();
});
test("filters use custom controls and missing searches recover cleanly", async ({
  page,
}) => {
  test.skip(before);
  await admin(page);
  await page.getByRole("combobox", { name: "Photo source" }).click();
  await page
    .getByRole("option", { name: "Announcements", exact: true })
    .click();
  await expect(
    page.getByRole("article", {
      name: "gallery: Harvest field photos",
      exact: true,
    }),
  ).toHaveCount(0);
  await page
    .getByPlaceholder("Group or announcement title")
    .fill("no matching fixture title");
  await expect(page.getByText(/No matching photo groups/)).toBeVisible();
  await page.getByPlaceholder("Group or announcement title").fill("");
  await expect(
    page.getByRole("article", {
      name: "announcement: General assembly",
      exact: true,
    }),
  ).toBeVisible();
});
test("stale publication preserves the draft and requests a reload", async ({
  page,
}) => {
  test.skip(before);
  await admin(page);
  await page
    .getByRole("button", { name: "Remove photo 1", exact: true })
    .click();
  await pool.query(
    "UPDATE gallery_landing_state SET revision=revision+1 WHERE state_id=1",
  );
  await page
    .getByRole("button", { name: "Save & Publish", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Save & Publish", exact: true })
    .click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Another officer",
  );
  await expect(page.getByText(/Unsaved changes/)).toBeVisible();
});
test("placement writes require Chairman permission", async ({ page }) => {
  test.skip(before);
  const response = await page.request.put(
    `${api}/api/landing/gallery-placement`,
    { headers: { Cookie: "trackcoop_session=member" }, data: {} },
  );
  expect(response.status()).toBe(403);
});
test("public lightbox is image-only, navigable and supports backdrop dismissal", async ({
  page,
}) => {
  test.skip(before);
  await page.goto("/");
  const section = page.locator("#projects");
  await expect(
    section.getByRole("button", { name: /Enlarge photo/ }),
  ).toHaveCount(7);
  await expect(section.locator(".public-photo-caption")).toHaveCount(0);
  await section
    .getByRole("button", { name: /Enlarge photo/ })
    .first()
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Next photo", exact: true }).click();
  await expect(dialog.getByRole("heading", { name: /photo 2 of/ })).toHaveCount(
    1,
  );
  await page.keyboard.press("ArrowLeft");
  await expect(dialog.getByRole("heading", { name: /photo 1 of/ })).toHaveCount(
    1,
  );
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});

test("metadata is delayed and photo selection has a keyboard alternative", async ({
  page,
}) => {
  test.skip(before);
  await admin(page);
  const group = page.getByRole("article", {
    name: "gallery: Harvest field photos",
    exact: true,
  });
  await group.hover({ position: { x: 8, y: 8 } });
  await page.waitForTimeout(100);
  await expect(page.getByRole("tooltip")).toHaveCount(0);
  await expect(page.getByRole("tooltip")).toContainText("Harvest field photos");
  await page
    .getByRole("button", { name: "Choose photo for position 4", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  const photo = group.getByRole("button", {
    name: "Select photo 2 from Harvest field photos",
    exact: true,
  });
  await photo.focus();
  await page.keyboard.press("Enter");
  await expect(
    page
      .getByRole("button", { name: "Choose photo for position 4", exact: true })
      .getByRole("img"),
  ).toHaveAttribute("alt", "Harvest photo 2");
  await expect(
    page.getByRole("button", { name: "Save & Publish", exact: true }),
  ).toBeEnabled();
});
test("touch devices can open metadata and select a photo without dragging", async ({
  browser,
}) => {
  test.skip(before);
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  try {
    await admin(page);
    const group = page.getByRole("article", {
      name: "gallery: Harvest field photos",
      exact: true,
    });
    await group
      .getByRole("button", {
        name: "Information about Harvest field photos",
        exact: true,
      })
      .tap();
    await expect(page.getByRole("tooltip")).toContainText("Gallery");
    await group
      .getByRole("button", {
        name: "Browse all 6 photos from Harvest field photos",
        exact: true,
      })
      .tap();
    const chooser = page.getByRole("dialog");
    await expect(
      chooser.getByRole("button", { name: /Select photo/ }),
    ).toHaveCount(6);
    await chooser
      .getByRole("button", { name: /Select photo/ })
      .first()
      .tap();
    await expect(
      page.getByRole("status").filter({ hasText: "Photo selected" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Choose photo for position 5", exact: true })
      .tap();
    await expect(
      page
        .getByRole("button", {
          name: "Choose photo for position 5",
          exact: true,
        })
        .getByRole("img"),
    ).toHaveAttribute("alt", "Harvest photo 1");
  } finally {
    await context.close();
  }
});
test("a failed library request offers recovery without changing placements", async ({
  page,
}) => {
  test.skip(before);
  await page.route(
    "**/api/landing/gallery-library?**",
    (route) => route.abort(),
    { times: 1 },
  );
  await page
    .context()
    .addCookies([
      { name: "trackcoop_session", value: "gallery-chair", url: origin },
    ]);
  await page.goto("/portal/chairman/landing/gallery");
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "could not reach",
  );
  await page
    .getByRole("button", { name: "Retry library", exact: true })
    .click();
  await expect(
    page.getByRole("article", {
      name: "gallery: Harvest field photos",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Save & Publish", exact: true }),
  ).toBeDisabled();
});
test("deleted selected images are marked unavailable, removable, and never replaced by unrelated public photos", async ({
  page,
}) => {
  test.skip(before);
  const current = (
    await (
      await page.request.get(`${api}/api/landing/gallery-placement`, {
        headers: { Cookie: "trackcoop_session=gallery-chair" },
      })
    ).json()
  ).data;
  const slot = current.slots.find(
    (s: { photo?: { source: string } }) => s.photo?.source === "gallery",
  );
  await pool.execute("DELETE FROM gallery_images WHERE gallery_image_id=?", [
    slot.photo.photoId,
  ]);
  await admin(page);
  const missing = page.getByRole("button", {
    name: `Choose photo for position ${slot.position}`,
    exact: true,
  });
  await expect(missing).toContainText("Photo unavailable");
  await page
    .getByRole("button", { name: `Remove photo ${slot.position}`, exact: true })
    .click();
  await page
    .getByRole("button", { name: "Save & Publish", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Save & Publish", exact: true })
    .click();
  await expect(
    page.getByText("Your homepage photos are published."),
  ).toBeVisible();
  await page.context().clearCookies();
  await page.goto("/");
  await expect(
    page.locator("#projects").getByRole("button", { name: /Enlarge photo/ }),
  ).toHaveCount(6);
  await expect(page.locator("#projects .recent-photos-mosaic")).toHaveCount(0);
  await pool.query("UPDATE gallery_groups SET public_visibility=0");
  await pool.query("UPDATE announcements SET audience_type='All Members'");
  await page.reload();
  await expect(
    page.locator("#projects").getByRole("button", { name: /Enlarge photo/ }),
  ).toHaveCount(0);
  await expect(
    page.getByText("No gallery photos are currently available."),
  ).toBeVisible();
});

test("Gallery upload, edit, cover, deletion, visibility and preview remain available", async ({
  page,
}) => {
  test.skip(before);
  await admin(page);
  await page.getByRole("button", { name: "Add photos", exact: true }).click();
  let editor = page.getByRole("dialog");
  await editor
    .getByLabel("Title", { exact: true })
    .fill("Fixture upload workflow");
  const png = readFileSync(resolve("public/images/Hero Page/Main Photo 1.jpg"));
  await editor.locator('input[type="file"]').setInputFiles([
    { name: "fixture-one.jpg", mimeType: "image/jpeg", buffer: png },
    { name: "fixture-two.jpg", mimeType: "image/jpeg", buffer: png },
  ]);
  await editor
    .getByRole("button", { name: "Create gallery", exact: true })
    .click();
  await expect(editor).toHaveCount(0);
  const group = page.getByRole("article", {
    name: "gallery: Fixture upload workflow",
    exact: true,
  });
  await expect(group).toBeVisible();
  await group
    .getByRole("button", {
      name: "Manage Fixture upload workflow",
      exact: true,
    })
    .click();
  editor = page.getByRole("dialog");
  await expect(editor.getByLabel("Title", { exact: true })).toHaveValue(
    "Fixture upload workflow",
  );
  await editor
    .getByRole("button", { name: "Set as cover", exact: true })
    .click();
  await editor.getByRole("button", { name: "Delete", exact: true }).click();
  await page
    .getByRole("dialog")
    .filter({
      has: page.getByRole("heading", {
        name: "Delete this photo?",
        exact: true,
      }),
    })
    .getByRole("button", { name: "Delete photo", exact: true })
    .click();
  await editor
    .getByRole("button", { name: "Save gallery", exact: true })
    .click();
  await expect(editor).toHaveCount(0);
  await group
    .getByRole("button", {
      name: "Browse all 1 photos from Fixture upload workflow",
      exact: true,
    })
    .click();
  const browser = page.getByRole("dialog");
  await browser
    .getByRole("button", { name: "Toggle visibility", exact: true })
    .click();
  await expect(browser).toHaveCount(0);
  const hidden = (
    await (
      await page.request.get(
        `${api}/api/landing/gallery-library?search=Fixture%20upload%20workflow`,
      )
    ).json()
  ).data;
  expect(hidden.groups[0].eligible).toBe(false);
  await group
    .getByRole("button", {
      name: "Preview Fixture upload workflow",
      exact: true,
    })
    .click();
  await expect(page.getByRole("dialog").getByRole("img")).toHaveCount(1);
  await page.keyboard.press("Escape");
});
