import { ZodError, type ZodType } from "zod";
import { AppError } from "../../utils/app-error";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess } from "../../utils/response";
import { exportExpenseReport } from "./expense-export";
import { expenseExportSchema, expenseFilterSchema, expenseRecordIdSchema, expenseRecordQuerySchema } from "./expense-overview.schema";
import type { ExpenseOverviewService } from "./expense-overview.service";

function parseQuery<T>(schema: ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw validationError(result.error);
  return result.data;
}

function validationError(error: ZodError) {
  return new AppError(
    "The request is invalid",
    400,
    "VALIDATION_ERROR",
    error.issues.map((issue) => ({ code: "VALIDATION_ERROR", field: issue.path.join("."), message: issue.message })),
  );
}

export function createExpenseOverviewController(service: ExpenseOverviewService) {
  const filters = (query: unknown) => parseQuery(expenseFilterSchema, query);
  return {
    summary: asyncHandler(async (request, response) => sendSuccess(response, await service.summary(filters(request.query)))),
    trends: asyncHandler(async (request, response) => sendSuccess(response, await service.trends(filters(request.query)))),
    categories: asyncHandler(async (request, response) => sendSuccess(response, await service.categories(filters(request.query)))),
    sources: asyncHandler(async (request, response) => sendSuccess(response, await service.sources(filters(request.query)))),
    drivers: asyncHandler(async (request, response) => sendSuccess(response, await service.drivers(filters(request.query)))),
    matrix: asyncHandler(async (request, response) => sendSuccess(response, await service.matrix(filters(request.query)))),
    integrity: asyncHandler(async (request, response) => sendSuccess(response, await service.integrity(filters(request.query)))),
    insights: asyncHandler(async (request, response) => sendSuccess(response, await service.insights(filters(request.query)))),
    options: asyncHandler(async (_request, response) => sendSuccess(response, await service.options())),
    records: asyncHandler(async (request, response) => {
      const query = parseQuery(expenseRecordQuerySchema, request.query);
      const page = await service.records(query);
      return sendSuccess(response, page);
    }),
    recordDetail: asyncHandler(async (request, response) => {
      const { id } = parseQuery(expenseRecordIdSchema, request.params);
      const detail = await service.recordDetail(id);
      if (!detail) throw new AppError("Expense record was not found", 404, "EXPENSE_RECORD_NOT_FOUND");
      return sendSuccess(response, detail);
    }),
    export: asyncHandler(async (request, response) => {
      if (!request.auth) throw new AppError("Authentication is required", 401, "UNAUTHENTICATED");
      const input = parseQuery(expenseExportSchema, request.query);
      const file = await exportExpenseReport(service, { ...input }, request.auth);
      response
        .set({
          "Content-Type": file.contentType,
          "Content-Disposition": `attachment; filename="${file.filename}"`,
          "Content-Length": String(file.buffer.length),
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        })
        .status(200)
        .send(file.buffer);
    }),
  };
}
