import type { RentalService } from "../_types/rental";

export const MAX_RENTAL_ASSET_PHOTOS = 5;
export const RENTAL_ASSET_PHOTO_MAX_SIZE = 5 * 1024 * 1024;
export const RENTAL_ASSET_PHOTO_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type RentalAssetPhotoType = (typeof RENTAL_ASSET_PHOTO_TYPES)[number];

export function isRentalAssetPhotoType(value: string): value is RentalAssetPhotoType {
  return RENTAL_ASSET_PHOTO_TYPES.includes(value as RentalAssetPhotoType);
}

export function validateRentalAssetPhoto(file: {
  size: number;
  type: string;
}) {
  if (file.size <= 0) return "Choose a non-empty photo.";
  if (!isRentalAssetPhotoType(file.type)) return "Upload a JPG, PNG, or WEBP photo.";
  if (file.size > RENTAL_ASSET_PHOTO_MAX_SIZE) return "Photo must be 5 MB or smaller.";
  return undefined;
}

export function cleanRentalAssetPhotoUrls(
  urls: Array<string | null | undefined>,
) {
  const seen = new Set<string>();
  return urls
    .map((url) => url?.trim())
    .filter((url): url is string => Boolean(url))
    .filter((url) => {
      if (seen.has(url)) return false;
      seen.add(url);
      return true;
    })
    .slice(0, MAX_RENTAL_ASSET_PHOTOS);
}

export function getRentalServiceImages(
  service: Pick<RentalService, "imageUrl" | "imageUrls">,
) {
  return cleanRentalAssetPhotoUrls([
    service.imageUrl,
    ...(service.imageUrls ?? []),
  ]);
}
