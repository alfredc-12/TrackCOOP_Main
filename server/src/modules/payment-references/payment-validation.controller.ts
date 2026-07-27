import { ZodError, type ZodType } from "zod";
import { AppError } from "../../utils/app-error";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess } from "../../utils/response";
import {
  listPaymentReferencesQuerySchema,
  retryGatewayEventSchema,
} from "./payment-reference.schema";
import type { PaymentValidationService } from "./payment-validation.service";

function parse<T>(schema: ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new AppError(
      "The request payload is invalid",
      400,
      "VALIDATION_ERROR",
      (result.error as ZodError).issues.map((issue) => ({
        code: "VALIDATION_ERROR",
        field: issue.path.join("."),
        message: issue.message,
      })),
    );
  }
  return result.data;
}
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

export function createPaymentValidationController(service: PaymentValidationService) {
  return {
    list: asyncHandler(async (request, response) => {
      const result = await service.list(parse(listPaymentReferencesQuerySchema, request.query));
      return sendSuccess(response, result);
    }),
    detail: asyncHandler(async (request, response) => sendSuccess(
      response,
      await service.detail(requireParam(request.params.id, "id")),
    )),
    retryGatewayEvent: asyncHandler(async (request, response) => {
      const input = parse<{ note: string }>(retryGatewayEventSchema, request.body);
      const result = await service.retryGatewayEvent({
        gatewayEventId: requireParam(request.params.eventId, "eventId"),
        note: input.note,
        auth: requireAuth(request.auth),
      });
      return sendSuccess(response, result, {
        message: result.alreadyProcessed
          ? "Gateway settlement was already processed"
          : "Failed gateway settlement retried",
      });
    }),
  };
}
