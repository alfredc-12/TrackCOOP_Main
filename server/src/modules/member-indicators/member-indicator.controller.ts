import { ZodError, type ZodType } from "zod";
import { AppError } from "../../utils/app-error";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess } from "../../utils/response";
import {
  listMemberIndicatorsQuerySchema,
  recalculateIndicatorsSchema,
} from "./member-indicator.schema";
import type { MemberIndicatorService } from "./member-indicator.service";

function parseBody<T>(schema: ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);

  if (!result.success) {
    throw validationError(result.error);
  }

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

export function createMemberIndicatorController(
  service: MemberIndicatorService,
) {
  return {
    list: asyncHandler(async (request, response) => {
      const query = parseBody(listMemberIndicatorsQuerySchema, request.query);
      const result = await service.listIndicators(query);
      return sendSuccess(response, result.indicators, {
        meta: {
          total: result.total,
          page: result.page,
          pageSize: result.pageSize,
        },
      });
    }),

    summary: asyncHandler(async (_request, response) => {
      return sendSuccess(response, await service.summary());
    }),

    detail: asyncHandler(async (request, response) => {
      const indicator = await service.getMemberIndicator(
        requireParam(request.params.memberId, "memberId"),
      );

      if (!indicator) {
        throw new AppError(
          "Member indicator was not found",
          404,
          "MEMBER_INDICATOR_NOT_FOUND",
        );
      }

      return sendSuccess(response, indicator);
    }),

    recalculate: asyncHandler(async (request, response) => {
      if (!request.auth) {
        throw new AppError("Authentication is required", 401, "UNAUTHENTICATED");
      }

      const input = parseBody(recalculateIndicatorsSchema, request.body);
      const result = await service.recalculate(input, request.auth);
      return sendSuccess(response, result, {
        message: "Member indicators recalculated",
      });
    }),
  };
}
