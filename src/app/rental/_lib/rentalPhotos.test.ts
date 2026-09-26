import assert from "node:assert/strict";
import test from "node:test";
import { env } from "@/config/env";
import { resolveRentalAssetPhotoUrl } from "./rentalPhotos";

test("loads stored rental uploads from the API origin", () => {
  assert.equal(
    resolveRentalAssetPhotoUrl("/uploads/rentals/tractor.jpg"),
    `${env.apiUrl.replace(/\/$/, "")}/uploads/rentals/tractor.jpg`,
  );
});

test("keeps absolute rental photo URLs unchanged", () => {
  const url = "https://cdn.example.com/rentals/tractor.jpg";
  assert.equal(resolveRentalAssetPhotoUrl(url), url);
});
