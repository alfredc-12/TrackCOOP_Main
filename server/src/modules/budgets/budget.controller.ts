import { type ZodType } from "zod";
import { AppError } from "../../utils/app-error";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess } from "../../utils/response";
import { budgetListQuerySchema, budgetSchema, budgetStatusSchema } from "./budget.schema";
import type { BudgetService } from "./budget.service";

function parse<T>(schema: ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new AppError("The request payload is invalid", 400, "VALIDATION_ERROR", result.error.issues.map((issue) => ({
      code: "VALIDATION_ERROR",
      field: issue.path.join("."),
      message: issue.message,
    })));
  }
  return result.data;
}

function requireAuth(auth: Express.Request["auth"]) {
  if (!auth) throw new AppError("Authentication is required", 401, "UNAUTHENTICATED");
  return auth;
}

function requireParam(value: string | string[] | undefined) {
  if (typeof value !== "string" || !value) throw new AppError("Budget id is required", 400, "ROUTE_PARAM_REQUIRED");
  return value;
}

export function createBudgetController(service: BudgetService) {
  return {
    list: asyncHandler(async (request, response) => {
      const result = await service.list(parse(budgetListQuerySchema, request.query));
      return sendSuccess(response, result.budgets, { meta: { total: result.total, page: result.page, pageSize: result.pageSize } });
    }),
    get: asyncHandler(async (request, response) => {
      const budget = await service.get(requireParam(request.params.id));
      if (!budget) throw new AppError("Budget was not found", 404, "BUDGET_NOT_FOUND");
      return sendSuccess(response, budget);
    }),
    create: asyncHandler(async (request, response) => {
      return sendSuccess(response, await service.create(parse(budgetSchema, request.body), requireAuth(request.auth)), { statusCode: 201, message: "Budget created" });
    }),
    transition: asyncHandler(async (request, response) => {
      const input = parse(budgetStatusSchema, request.body);
      return sendSuccess(response, await service.transition(requireParam(request.params.id), input.action, requireAuth(request.auth)), { message: "Budget status updated" });
    }),
    summary: asyncHandler(async (_request, response) => sendSuccess(response, await service.summary())),
  };
}
