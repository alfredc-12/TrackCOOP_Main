import { AppError } from "../../utils/app-error";
import type { InventoryProductInput } from "./inventory.types";

export function validateProductInput(input: InventoryProductInput, requireStock = false) {
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const hasSellingPrice = input.price !== undefined && input.price !== null && String(input.price).trim() !== "";
  const sellingPrice = Number(input.price);
  const costPrice = Number(input.cost_price ?? 0);
  const openingStock = Number(input.stock ?? 0);
  const reorderLevel = Number(input.reorder_level ?? 0);
  const productUnit = input.unit?.trim() || "piece";
  const category = typeof input.category === "string" ? input.category.trim() : "";
  const description = typeof input.description === "string" ? input.description.trim() : "";
  const allowedStatuses = new Set(["Available", "Unavailable"]);
  const hasOpeningStock = input.stock !== undefined && input.stock !== null && String(input.stock).trim() !== "";

  if (
    name.length < 2 || name.length > 120 || !category || category.length > 80 ||
    !productUnit || productUnit.length > 30 || description.length > 2000 ||
    !hasSellingPrice || !Number.isFinite(sellingPrice) || sellingPrice < 0 ||
    !Number.isFinite(costPrice) || costPrice < 0 ||
    !Number.isFinite(reorderLevel) || reorderLevel < 0 ||
    (input.status !== undefined && !allowedStatuses.has(input.status)) ||
    (requireStock && (!hasOpeningStock || !Number.isFinite(openingStock) || openingStock < 0))
  ) {
    throw new AppError(
      requireStock ? "Product name, unit, price, and stock are required." : "Product name, unit, and valid price are required.",
      400,
      "INVALID_PRODUCT_INPUT",
    );
  }

  return {
    name,
    category,
    sellingPrice,
    costPrice,
    description: description || null,
    productUnit,
    openingStock,
    reorderLevel,
    dbStatus: input.status === undefined || input.status === "Available" ? "Active" : "Out of Stock",
  };
}
