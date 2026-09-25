import type { Response } from "express";
import { AppError } from "../../utils/app-error";
import { asyncHandler } from "../../utils/async-handler";
import type { PosService } from "./pos.service";
import type { CheckoutPayload, ConfirmOrderInput, PosReasonInput } from "./pos.types";

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

function requireOrderId(value: string | string[] | undefined) {
  const id = requireParam(value, "id");
  if (!/^\d+$/.test(id) || Number(id) <= 0) {
    throw new AppError("Order id must be a positive integer", 400, "INVALID_ORDER_ID");
  }
  return id;
}

function sendError(response: Response, error: unknown, fallback: string, includeDetails = false) {
  if (error instanceof AppError) {
    return response.status(error.statusCode).json({ error: error.message });
  }
  console.error(fallback, error);
  return response.status(500).json({
    error: fallback,
    ...(includeDetails ? { details: error instanceof Error ? error.message : String(error) } : {}),
  });
}

export function createPosController(service: PosService) {
  return {
    listOrders: asyncHandler(async (_request, response) => {
      try {
        return response.json(await service.listOrders());
      } catch (error) {
        return sendError(response, error, "Failed to fetch orders");
      }
    }),

    listHistory: asyncHandler(async (request, response) => {
      try {
        return response.json(await service.listMemberHistory(requireAuth(request.auth)));
      } catch (error) {
        return sendError(response, error, "Failed to fetch history");
      }
    }),

    checkout: asyncHandler(async (request, response) => {
      try {
        return response.json(await service.checkout((request.body ?? {}) as CheckoutPayload, request.auth ?? null));
      } catch (error) {
        return sendError(response, error, error instanceof Error ? error.message : "Checkout failed");
      }
    }),

    confirmOrder: asyncHandler(async (request, response) => {
      try {
        return response.json({
          success: true,
          ...(await service.confirmOrder(
            requireOrderId(request.params.id),
            (request.body ?? {}) as ConfirmOrderInput,
            requireAuth(request.auth),
          )),
        });
      } catch (error) {
        return sendError(response, error, "Failed to confirm order", true);
      }
    }),

    rejectOrder: asyncHandler(async (request, response) => {
      try {
        await service.rejectOrder(
          requireOrderId(request.params.id),
          (request.body ?? {}) as PosReasonInput,
          requireAuth(request.auth),
        );
        return response.json({ message: "Order cancelled successfully" });
      } catch (error) {
        return sendError(response, error, "Failed to cancel order");
      }
    }),

    revokeOrder: asyncHandler(async (request, response) => {
      try {
        await service.revokeOrder(
          requireOrderId(request.params.id),
          (request.body ?? {}) as PosReasonInput,
          requireAuth(request.auth),
        );
        return response.json({ success: true, message: "Payment revoked successfully." });
      } catch (error) {
        return sendError(response, error, "Failed to revoke order payment", true);
      }
    }),
  };
}
