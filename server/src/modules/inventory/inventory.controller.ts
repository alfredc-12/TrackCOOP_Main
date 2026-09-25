import type { Response } from "express";
import { AppError } from "../../utils/app-error";
import { asyncHandler } from "../../utils/async-handler";
import type { InventoryService } from "./inventory.service";
import type { InventoryProductInput, InventoryStockInput } from "./inventory.types";

function requireAuth(auth: Express.Request["auth"]) {
  if (!auth) throw new AppError("Authentication is required", 401, "UNAUTHENTICATED");
  return auth;
}

function requireParam(value: string | string[] | undefined, name: string) {
  if (typeof value !== "string" || !value) {
    throw new AppError(`Route parameter ${name} is required`, 400, "ROUTE_PARAM_REQUIRED");
  }
  return value;
}

function requireProductId(value: string | string[] | undefined) {
  const id = requireParam(value, "id");
  if (!/^\d+$/.test(id) || Number(id) <= 0) {
    throw new AppError("Product id must be a positive integer", 400, "INVALID_PRODUCT_ID");
  }
  return id;
}

function sendError(response: Response, error: unknown, fallback: string) {
  if (error instanceof AppError) {
    return response.status(error.statusCode).json({ error: error.message });
  }

  console.error(fallback, error);
  return response.status(500).json({ error: fallback });
}

export function createInventoryController(service: InventoryService) {
  return {
    listProducts: asyncHandler(async (_request, response) => {
      try {
        return response.json(await service.listProducts({ includeHistory: true }));
      } catch (error) {
        return sendError(response, error, "Failed to fetch inventory");
      }
    }),

    listPublicProducts: asyncHandler(async (_request, response) => {
      try {
        return response.json(await service.listProducts({ publicOnly: true }));
      } catch (error) {
        return sendError(response, error, "Failed to fetch store products");
      }
    }),

    createProduct: asyncHandler(async (request, response) => {
      try {
        const id = await service.createProduct(request.body as InventoryProductInput, requireAuth(request.auth).user.id);
        return response.status(201).json({ success: true, id });
      } catch (error) {
        return sendError(response, error, "Failed to add product");
      }
    }),

    updateProduct: asyncHandler(async (request, response) => {
      try {
        await service.updateProduct(requireProductId(request.params.id), request.body as InventoryProductInput, requireAuth(request.auth).user.id);
        return response.json({ success: true });
      } catch (error) {
        return sendError(response, error, "Failed to update product");
      }
    }),

    archiveProduct: asyncHandler(async (request, response) => {
      try {
        const archived = await service.archiveProduct(requireProductId(request.params.id), requireAuth(request.auth).user.id);
        if (!archived) return response.status(404).json({ error: "Product not found" });
        return response.json({ success: true });
      } catch (error) {
        return sendError(response, error, "Failed to archive product");
      }
    }),

    updateStock: asyncHandler(async (request, response) => {
      try {
        await service.updateStock(
          requireProductId(request.params.id),
          request.body as InventoryStockInput,
          requireAuth(request.auth).user.id,
        );
        return response.json({ success: true });
      } catch (error) {
        return sendError(response, error, "Failed to adjust stock");
      }
    }),

    listHistory: asyncHandler(async (_request, response) => {
      try {
        return response.json(await service.listHistory());
      } catch (error) {
        return sendError(response, error, "Failed to fetch global history");
      }
    }),
  };
}
