import { AppError } from "../../utils/app-error";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess } from "../../utils/response";
import type { PaymongoService } from "./paymongo.service";

function requireParam(value: string | string[] | undefined, name: string) {
  if (typeof value !== "string" || !value) {
    throw new AppError(`Route parameter ${name} is required`, 400, "ROUTE_PARAM_REQUIRED");
  }
  return value;
}

function requireAuth(auth: Express.Request["auth"]) {
  if (!auth) throw new AppError("Authentication is required", 401, "UNAUTHENTICATED");
  return auth;
}

export function createPaymongoController(service: PaymongoService) {
  return {
    createPaymentReferenceCheckout: asyncHandler(async (request, response) => {
      const result = await service.createPaymentReferenceCheckout(
        requireParam(request.params.paymentReferenceId, "paymentReferenceId"),
        requireAuth(request.auth),
      );

      return sendSuccess(response, result, {
        statusCode: 201,
        message: "PayMongo checkout session created",
      });
    }),

    getPaymentReferenceStatus: asyncHandler(async (request, response) => {
      const result = await service.getPaymentReferenceStatus(
        requireParam(request.params.paymentReferenceId, "paymentReferenceId"),
        requireAuth(request.auth),
      );

      return sendSuccess(response, result);
    }),
  };
}

