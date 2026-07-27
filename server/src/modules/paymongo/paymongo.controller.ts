import type { Request } from "express";
import { ZodError, type ZodType } from "zod";
import { AppError } from "../../utils/app-error";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess } from "../../utils/response";
import { paymongoMembershipCheckoutBodySchema } from "./paymongo.schema";
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

function validationError(error: ZodError) {
  return new AppError(
    "The request payload is invalid",
    400,
    "VALIDATION_ERROR",
    error.issues.map((issue) => ({
      code: "VALIDATION_ERROR",
      field: issue.path.join("."),
      message: issue.message,
    })),
  );
}

function parse<T>(schema: ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw validationError(result.error);
  return result.data;
}

function trackingToken(request: Request) {
  return request.get("X-Application-Tracking-Token");
}

export function createPaymongoController(service: PaymongoService) {
  return {
    createMembershipApplicationCheckout: asyncHandler(async (request, response) => {
      const result = await service.createMembershipApplicationCheckout(
        requireParam(request.params.applicationCode, "applicationCode"),
        trackingToken(request),
        parse(paymongoMembershipCheckoutBodySchema, request.body),
      );

      return sendSuccess(response, result, {
        statusCode: 201,
        message: "PayMongo membership checkout session created",
      });
    }),

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
