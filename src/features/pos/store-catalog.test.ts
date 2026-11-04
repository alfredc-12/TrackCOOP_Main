import assert from "node:assert/strict";
import { test } from "node:test";
import { availableStoreQuantity, emptyStoreFilters, filterStoreCatalog, type StoreProduct } from "./store-catalog";

function product(overrides: Partial<StoreProduct>): StoreProduct {
  return { id: 1, name: "Rice seed", category: "Seeds", description: "Certified seed for rice planting", unit: "bag", price: 420, stock: 10, sold: 0, status: "Available", img: "", ...overrides };
}
const rows = [
  product({ id: 1, name: "Certified Ríce Seed 5-kg" }),
  product({ id: 2, name: "Fish feed", category: "Feed", description: "Feed for fish production", unit: "sack", price: 600, stock: 8, pending_qty: 5 }),
  product({ id: 3, name: "Fully reserved seed", price: 300, stock: 4, pending_qty: 4 }),
  product({ id: 4, name: "Unavailable seed", status: "Unavailable" }),
  product({ id: 5, name: "No stock", stock: 0 }),
];

test("store search supports words across names, descriptions, categories and units", () => {
  assert.deepEqual(filterStoreCatalog(rows, { ...emptyStoreFilters, search: "  rice 5 kg certified " }).map((item) => item.id), [1]);
  assert.deepEqual(filterStoreCatalog(rows, { ...emptyStoreFilters, search: "fish sack" }).map((item) => item.id), [2]);
  assert.equal(filterStoreCatalog(rows, { ...emptyStoreFilters, search: "fish rice" }).length, 0);
});

test("stock filters use purchasable quantity after pending orders without changing visibility rules", () => {
  assert.equal(availableStoreQuantity(rows[1]), 3);
  assert.equal(availableStoreQuantity(product({ pending_qty: 20 })), 0);
  assert.deepEqual(filterStoreCatalog(rows, emptyStoreFilters).map((item) => item.id), [1, 2, 3]);
  assert.deepEqual(filterStoreCatalog(rows, { ...emptyStoreFilters, stock: "in-stock" }).map((item) => item.id), [1, 2]);
  assert.deepEqual(filterStoreCatalog(rows, { ...emptyStoreFilters, stock: "low-stock" }).map((item) => item.id), [2]);
});

test("category and unit filters combine and compare case-insensitively", () => {
  assert.deepEqual(filterStoreCatalog(rows, { ...emptyStoreFilters, category: "FEED", unit: "SACK" }).map((item) => item.id), [2]);
  assert.equal(filterStoreCatalog(rows, { ...emptyStoreFilters, category: "Seeds", unit: "sack" }).length, 0);
});

test("price/name sorting is stable and leaves inventory order unchanged", () => {
  const originalOrder = rows.map((item) => item.id);
  assert.deepEqual(filterStoreCatalog(rows, { ...emptyStoreFilters, sort: "price-asc" }).map((item) => item.id), [3, 1, 2]);
  assert.deepEqual(filterStoreCatalog(rows, { ...emptyStoreFilters, sort: "price-desc" }).map((item) => item.id), [2, 1, 3]);
  const ties = [product({ id: 2 }), product({ id: 1 })];
  assert.deepEqual(filterStoreCatalog(ties, emptyStoreFilters).map((item) => item.id), [1, 2]);
  assert.deepEqual(rows.map((item) => item.id), originalOrder);
});
