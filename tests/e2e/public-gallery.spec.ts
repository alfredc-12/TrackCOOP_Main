import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("public gallery deduplicates repeated image paths in the grid and viewer", async ({ page }) => {
  const duplicateKeyWarnings: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" && /same key|Encountered two children/.test(message.text())) {
      duplicateKeyWarnings.push(message.text());
    }
  });
  const jpeg = await readFile("public/images/Hero Page/Main Photo 1.jpg");
  await page.route("**/public/Test*Image.jpg", (route) => route.fulfill({ contentType: "image/jpeg", body: jpeg }));
  await page.route("**/api/public/landing", (route) => route.fulfill({
    json: {
      success: true,
      data: {
        partners: [],
        recentPhotos: [],
        gallery: [
          ...Array.from({ length: 7 }, (_, index) => ({ id: `slot-${index}`, title: "Uploaded photo", imagePath: "/public/Test Image.jpg" })),
          { id: "bundled-1", imagePath: "/images/Hero%20Page/Main%20Photo%201.jpg" },
          { id: "bundled-2", imagePath: "/images/Hero%20Page/Main%20Photo%201.jpg" },
        ],
      },
    },
  }));
  await page.goto("/gallery");
  await expect(page.getByText("22 photos", { exact: true })).toBeVisible();
  const cards = page.getByRole("button", { name: /^Open gallery photo / });
  await expect(cards).toHaveCount(9);
  const paths = await cards.locator("img").evaluateAll((images) => images.map((image) => decodeURIComponent(new URL(image.getAttribute("src")!, location.href).pathname)));
  expect(new Set(paths).size).toBe(paths.length);
  expect(paths.filter((path) => path === "/public/Test Image.jpg")).toHaveLength(1);
  await cards.first().click();
  const viewer = page.getByRole("dialog", { name: "Gallery photo preview", exact: true });
  await expect(viewer.locator("img")).toHaveCount(1);
  await expect(viewer.getByRole("button")).toHaveCount(1);
  await expect(viewer.getByRole("button", { name: /Next gallery photo|Previous gallery photo|Show gallery photo|Go to gallery photo/ })).toHaveCount(0);
  const selectedSrc = await viewer.locator("img").getAttribute("src");
  await page.keyboard.press("ArrowRight");
  await expect(viewer.locator("img")).toHaveAttribute("src", selectedSrc!);
  await page.keyboard.press("Escape");
  await expect(viewer).not.toBeVisible();
  expect(duplicateKeyWarnings).toEqual([]);
});
