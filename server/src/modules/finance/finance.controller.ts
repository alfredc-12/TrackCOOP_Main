import { z, ZodError, type ZodType } from "zod";
import { AppError } from "../../utils/app-error";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess } from "../../utils/response";
import {
  financialCategorySchema,
  financialRecordSchema,
  listFinancialRecordsQuerySchema,
  updateFinancialCategorySchema,
  updateFinancialRecordSchema,
} from "./finance.schema";
import type { FinanceService } from "./finance.service";

const voidRecordSchema = z.object({
  reason: z.string().trim().max(2000).nullable().optional(),
});

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

export function createFinanceController(service: FinanceService) {
  return {
    listCategories: asyncHandler(async (_request, response) => {
      return sendSuccess(response, await service.listCategories());
    }),
    createCategory: asyncHandler(async (request, response) => {
      const input = parseBody(financialCategorySchema, request.body);
      return sendSuccess(response, await service.createCategory(input, requireAuth(request.auth)), {
        statusCode: 201,
        message: "Financial category created",
      });
    }),
    updateCategory: asyncHandler(async (request, response) => {
      const input = parseBody(updateFinancialCategorySchema, request.body);
      return sendSuccess(
        response,
        await service.updateCategory(requireParam(request.params.id, "id"), input, requireAuth(request.auth)),
        { message: "Financial category updated" },
      );
    }),
    listRecords: asyncHandler(async (request, response) => {
      const query = parseBody(listFinancialRecordsQuerySchema, request.query);
      const result = await service.listRecords(query);
      return sendSuccess(response, result.records, {
        meta: { total: result.total, page: result.page, pageSize: result.pageSize },
      });
    }),
    summary: asyncHandler(async (_request, response) => {
      return sendSuccess(response, await service.summary());
    }),
    trends: asyncHandler(async (_request, response) => {
      return sendSuccess(response, await service.trends());
    }),
    createRecord: asyncHandler(async (request, response) => {
      const input = parseBody(financialRecordSchema, request.body);
      return sendSuccess(response, await service.createRecord(input, requireAuth(request.auth)), {
        statusCode: 201,
        message: "Financial record created",
      });
    }),
    detailRecord: asyncHandler(async (request, response) => {
      const record = await service.getRecord(requireParam(request.params.id, "id"));
      if (!record) throw new AppError("Financial record was not found", 404, "FINANCIAL_RECORD_NOT_FOUND");
      return sendSuccess(response, record);
    }),
    updateRecord: asyncHandler(async (request, response) => {
      const input = parseBody(updateFinancialRecordSchema, request.body);
      return sendSuccess(
        response,
        await service.updateRecord(requireParam(request.params.id, "id"), input, requireAuth(request.auth)),
        { message: "Financial record updated" },
      );
    }),
    postRecord: asyncHandler(async (request, response) => {
      return sendSuccess(
        response,
        await service.postRecord(requireParam(request.params.id, "id"), requireAuth(request.auth)),
        { message: "Financial record posted" },
      );
    }),
    voidRecord: asyncHandler(async (request, response) => {
      const input = parseBody(voidRecordSchema, request.body);
      return sendSuccess(
        response,
        await service.voidRecord(requireParam(request.params.id, "id"), input.reason, requireAuth(request.auth)),
        { message: "Financial record voided" },
      );
    }),
  };
}
