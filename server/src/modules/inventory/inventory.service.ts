import type { InventoryProductInput, InventoryStockInput } from "./inventory.types";
import { createInventoryRepository, type InventoryRepository, type ListInventoryProductsOptions } from "./inventory.repository";

export interface InventoryService {
  listProducts(options?: ListInventoryProductsOptions): ReturnType<InventoryRepository["listProducts"]>;
  createProduct(input: InventoryProductInput, userId: string): ReturnType<InventoryRepository["createProduct"]>;
  updateProduct(productId: string, input: InventoryProductInput): ReturnType<InventoryRepository["updateProduct"]>;
  archiveProduct(productId: string): ReturnType<InventoryRepository["archiveProduct"]>;
  updateStock(productId: string, input: InventoryStockInput, userId: string): ReturnType<InventoryRepository["updateStock"]>;
  listHistory(): ReturnType<InventoryRepository["listHistory"]>;
}

export function createInventoryService(repository: InventoryRepository = createInventoryRepository()): InventoryService {
  return {
    listProducts: (options) => repository.listProducts(options),
    createProduct: (input, userId) => repository.createProduct(input, userId),
    updateProduct: (productId, input) => repository.updateProduct(productId, input),
    archiveProduct: (productId) => repository.archiveProduct(productId),
    updateStock: (productId, input, userId) => repository.updateStock(productId, input, userId),
    listHistory: () => repository.listHistory(),
  };
}
