import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

const photos = ["gallery", "announcement", "announcement", "gallery", "gallery", "announcement", "gallery"].map((source, index) => ({
  id: `${source}:${index + 1}`,
  source,
  position:index+1,
  altText:index < 2 ? "Cooperative training" : `Field activity ${index+1}`,
  title: index < 2 ? "Cooperative training" : `Field activity ${index + 1}`,
  caption: `Caption for photo ${index + 1}`,
  imagePath: `/images/Hero%20Page/Main%20Photo%20${index % 4 + 1}.jpg`,
  publishedAt: new Date(Date.UTC(2026, 10, 7 - index)).toISOString(),
}));

async function mockLanding(page: Page, recentPhotos = photos) {
  await page.route("**/api/public/landing", (route) => route.fulfill({
    json: { success: true, data: { partners: [], gallery: [], recentPhotos:[], landingPhotos:recentPhotos } },
  }));
  await page.route("**/api/announcements*", (route) => route.fulfill({ json: { success: true, data: [] } }));
}

for (const width of [1440, 768, 390]) {
  test(`homepage shows seven saved mixed photos and an accessible preview at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await mockLanding(page);
    await page.goto("/");
    const section = page.locator("#projects");
    await section.scrollIntoViewIfNeeded();
    const tiles = section.getByRole("button", { name: /^Enlarge photo / });
    await expect(tiles).toHaveCount(7);
    await expect(section.locator(".recent-photos-mosaic")).toHaveCount(1);
    await expect(section.locator(".public-photo-caption")).toHaveCount(0);
    await expect(tiles.nth(1)).toHaveAttribute("aria-label","Enlarge photo 2: Cooperative training");
    await expect(section.getByText("Caption for photo 2", { exact: true })).toHaveCount(0);
    expect(await section.evaluate((element) => element.scrollWidth <= innerWidth)).toBe(true);

    await tiles.nth(1).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Announcement photo", { exact: true })).toHaveCount(0);
    await expect(dialog.getByText("Caption for photo 2", { exact: true })).toHaveCount(0);
    await expect(dialog.locator("img")).toHaveCSS("object-fit", "contain");
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(tiles.nth(1)).toBeFocused();

    await page.keyboard.press("Enter");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Close photo preview", exact: true }).last().click();
    await expect(dialog).not.toBeVisible();
    await tiles.first().click();
    await page.mouse.click(2,2);
    await expect(dialog).not.toBeVisible();

    for (const image of await section.locator("img").all()) {
      await image.scrollIntoViewIfNeeded();
      await expect.poll(() => image.evaluate((element) => (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    }
    await section.screenshot({ path: `test-results/recent-photos-${width}.png` });
  });
}

test("short and failed-image placements reflow without empty mosaic positions", async ({ page }) => {
  await mockLanding(page, photos.slice(0, 3).map((photo, index) => ({ ...photo, imagePath: index === 0 ? "/uploads/recent-photos/missing.jpg" : photo.imagePath })));
  await page.route("**/uploads/recent-photos/missing.jpg", (route) => route.fulfill({ status: 404, body: "Not found" }));
  await page.goto("/");
  const section = page.locator("#projects");
  await section.scrollIntoViewIfNeeded();
  await expect(section.getByRole("button", { name: /^Enlarge photo / })).toHaveCount(2);
  await expect(section.locator(".recent-photos-mosaic")).toHaveCount(0);
});

test("failed landing request offers retry and then shows the empty state", async ({ page }) => {
  let attempts = 0;
  await page.route("**/api/public/landing", (route) => {
    attempts += 1;
    return route.fulfill(attempts === 1
      ? { status: 503, json: { success: false } }
      : { json: { success: true, data: { partners: [], gallery: [], recentPhotos: [], landingPhotos:[] } } });
  });
  await page.route("**/api/announcements*", (route) => route.fulfill({ json: { success: true, data: [] } }));
  await page.goto("/");
  const section = page.locator("#projects");
  await section.scrollIntoViewIfNeeded();
  await expect(section.getByText("Gallery photos could not be loaded.")).toBeVisible();
  await section.getByRole("button", { name: "Retry" }).click();
  await expect(section.getByText("No gallery photos are currently available.")).toBeVisible();
});

test("photo URLs preserve bundled files, API upload paths, and direct S3 addresses", async ({ page }) => {
  const s3Url = "https://trackcoop-test-bucket.s3.ap-southeast-1.amazonaws.com/public/gallery/photo.jpg";
  const jpeg = await readFile("public/images/Hero Page/Main Photo 1.jpg");
  await mockLanding(page, photos.slice(0, 3).map((photo, index) => ({
    ...photo,
    imagePath: [photo.imagePath, "/uploads/recent-photos/photo.jpg", s3Url][index],
  })));
  await page.route("**/uploads/recent-photos/photo.jpg", (route) => route.fulfill({ contentType: "image/jpeg", body: jpeg }));
  await page.route(s3Url, (route) => route.fulfill({ contentType: "image/jpeg", body: jpeg }));
  await page.goto("/");
  const section = page.locator("#projects");
  await section.scrollIntoViewIfNeeded();
  const images = section.locator("img");
  await expect(images).toHaveCount(3);
  await expect.poll(async () => new URL((await images.nth(0).getAttribute("src")) ?? "", page.url()).pathname).toBe(photos[0].imagePath);
  await expect(images.nth(1)).toHaveAttribute("src", /^https?:\/\/[^/]+\/uploads\/recent-photos\/photo\.jpg$/);
  await expect(images.nth(2)).toHaveAttribute("src", s3Url);
  await section.getByRole("button", { name: /^Enlarge photo / }).nth(2).click();
  await expect(page.getByRole("dialog").locator("img")).toHaveAttribute("src", s3Url);
});
