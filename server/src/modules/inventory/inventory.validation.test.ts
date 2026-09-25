import assert from "node:assert/strict";
import test from "node:test";
import type { InventoryProductInput } from "./inventory.types";
import { validateProductInput } from "./inventory-validation";

test("inventory product validation accepts a valid product", () => {
  const result = validateProductInput({
    name: "Certified Rice Seeds",
    category: "Seeds",
    unit: "sack",
    price: "1250",
    cost_price: "900",
    stock: "52",
    reorder_level: "10",
    status: "Available",
  }, true);

  assert.equal(result.name, "Certified Rice Seeds");
  assert.equal(result.sellingPrice, 1250);
  assert.equal(result.openingStock, 52);
});

test("inventory product validation rejects invalid numeric fields", () => {
  assert.throws(() => validateProductInput({ name: "Item", price: "", cost_price: "1", reorder_level: "0" }));
  assert.throws(() => validateProductInput({ name: "Item", price: "NaN", cost_price: "1", reorder_level: "0" }));
  assert.throws(() => validateProductInput({ name: "Item", price: "10", cost_price: "-1", reorder_level: "0" }));
  assert.throws(() => validateProductInput({ name: "Item", price: "10", cost_price: "1", reorder_level: "-1" }));
});

test("inventory product validation rejects invalid status and oversized names", () => {
  const archivedInput = { name: "Item", price: 10, status: "Archived" } as unknown as InventoryProductInput;
  assert.throws(() => validateProductInput(archivedInput));
  assert.throws(() => validateProductInput({ name: "x".repeat(121), price: 10 }));
});

test("opening stock is required for new products", () => {
  assert.throws(() => validateProductInput({ name: "Item", price: 10 }, true));
});
