import { ZodError, type ZodType } from "zod";
import { AppError } from "../../utils/app-error";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess } from "../../utils/response";
import {
  listShareCapitalQuerySchema,
  shareCapitalSchema,
  updateShareCapitalSchema,
} from "./share-capital.schema";
import type { ShareCapitalService } from "./share-capital.service";

function parseBody<T>(schema: ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw validationError(result.error);
  return result.data;
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

export function createShareCapitalController(service: ShareCapitalService) {
  return {
    list: asyncHandler(async (request, response) => {
      const query = parseBody(listShareCapitalQuerySchema, request.query);
      const result = await service.listPayments(query);
      return sendSuccess(response, result.payments, {
        meta: { total: result.total, page: result.page, pageSize: result.pageSize },
      });
    }),
    summary: asyncHandler(async (_request, response) => {
      return sendSuccess(response, await service.summary());
    }),
    memberProgress: asyncHandler(async (request, response) => {
      return sendSuccess(
        response,
        await service.memberProgress(requireParam(request.params.memberId, "memberId")),
      );
    }),
    create: asyncHandler(async (request, response) => {
      const input = parseBody(shareCapitalSchema, request.body);
      const payment = await service.createPayment(input, requireAuth(request.auth));
      return sendSuccess(response, payment, { statusCode: 201, message: "Share capital payment created" });
    }),
    detail: asyncHandler(async (request, response) => {
      const payment = await service.getPayment(requireParam(request.params.id, "id"));
      if (!payment) throw new AppError("Share capital payment was not found", 404, "SHARE_CAPITAL_NOT_FOUND");
      return sendSuccess(response, payment);
    }),
    update: asyncHandler(async (request, response) => {
      const input = parseBody(updateShareCapitalSchema, request.body);
      const payment = await service.updatePayment(
        requireParam(request.params.id, "id"),
        input,
        requireAuth(request.auth),
      );
      return sendSuccess(response, payment, { message: "Share capital payment updated" });
    }),
  };
}
