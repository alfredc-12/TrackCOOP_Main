import { resolveUploadUrl } from "@/lib/upload-url";

const legacyProductPrefix = "/images/products/";
const inventoryUploadPrefix = "/uploads/inventory/";

export function resolveProductImageSrc(value: string | null | undefined) {
  const path = value?.trim();

  if (!path) return "";

  if (path.startsWith(legacyProductPrefix)) {
    return resolveUploadUrl(`${inventoryUploadPrefix}${path.slice(legacyProductPrefix.length)}`);
  }

  return resolveUploadUrl(path);
}

export function normalizeProductImage<T extends { img?: string | null }>(item: T) {
  return {
    ...item,
    img: resolveProductImageSrc(item.img),
  };
}
