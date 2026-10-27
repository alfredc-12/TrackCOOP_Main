import { ZodError, type ZodType } from "zod";
import { AppError } from "../../utils/app-error";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess } from "../../utils/response";
import { productionListQuerySchema, productionRecordSchema, seasonListQuerySchema, seasonSchema, seasonStatusSchema, seasonalAnalyticsQuerySchema } from "./season.schema";
import type { SeasonService } from "./season.service";

function parse<T>(schema: ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new AppError("The request payload is invalid", 400, "VALIDATION_ERROR", result.error.issues.map((issue) => ({ code: "VALIDATION_ERROR", field: issue.path.join("."), message: issue.message })));
  return result.data;
}

function requireAuth(auth: Express.Request["auth"]) {
  if (!auth) throw new AppError("Authentication is required", 401, "UNAUTHENTICATED");
  return auth;
}

function requireParam(value: string | string[] | undefined) {
  if (typeof value !== "string" || !value) throw new AppError("Season id is required", 400, "ROUTE_PARAM_REQUIRED");
  return value;
}

export function createSeasonController(service: SeasonService) {
  return {
    list: asyncHandler(async (request, response) => {
      const result = await service.list(parse(seasonListQuerySchema, request.query));
      return sendSuccess(response, result.seasons, { meta: { total: result.total, page: result.page, pageSize: result.pageSize } });
    }),
    get: asyncHandler(async (request, response) => {
      const season = await service.get(requireParam(request.params.id));
      if (!season) throw new AppError("Season was not found", 404, "SEASON_NOT_FOUND");
      return sendSuccess(response, season);
    }),
    create: asyncHandler(async (request, response) => sendSuccess(response, await service.create(parse(seasonSchema, request.body), requireAuth(request.auth)), { statusCode: 201, message: "Season created" })),
    transition: asyncHandler(async (request, response) => {
      const input = parse(seasonStatusSchema, request.body);
      return sendSuccess(response, await service.transition(requireParam(request.params.id), input.action, requireAuth(request.auth)), { message: "Season status updated" });
    }),
    listProduction: asyncHandler(async (request, response) => {
      const result = await service.listProduction(parse(productionListQuerySchema, request.query));
      return sendSuccess(response, result.records, { meta: { total: result.total, page: result.page, pageSize: result.pageSize } });
    }),
    createProduction: asyncHandler(async (request, response) => sendSuccess(response, await service.createProduction(parse(productionRecordSchema, request.body), requireAuth(request.auth)), { statusCode: 201, message: "Production record created" })),
    analytics: asyncHandler(async (request, response) => sendSuccess(response, await service.analytics(parse(seasonalAnalyticsQuerySchema, request.query)))),
  };
}
