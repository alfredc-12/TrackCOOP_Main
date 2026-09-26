import { z, type ZodType } from "zod";
import { AppError } from "../../utils/app-error";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess } from "../../utils/response";
import { createPatronagePeriodSchema, patronagePaymentSchema } from "./patronage.schema";
import type { PatronageService } from "./patronage.service";

function parse<T>(schema: ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new AppError("The request payload is invalid.", 400, "VALIDATION_ERROR", result.error.issues.map((issue) => ({
      code: "VALIDATION_ERROR",
      field: issue.path.join("."),
      message: issue.message,
    })));
  }
  return result.data;
}

function requireAuth(auth: Express.Request["auth"]) {
  if (!auth) throw new AppError("Authentication is required.", 401, "UNAUTHENTICATED");
  return auth;
}

function requireParam(value: string | string[] | undefined, name: string) {
  if (typeof value !== "string" || !value) throw new AppError(`${name} is required.`, 400, "ROUTE_PARAM_REQUIRED");
  return value;
}

export function createPatronageController(service: PatronageService) {
  return {
    overview: asyncHandler(async (request, response) => {
      const query = parse(z.object({ periodId: z.string().trim().min(1).optional() }), request.query);
      return sendSuccess(response, await service.overview(query.periodId));
    }),
    financialBasis: asyncHandler(async (request, response) => {
      const query = parse(z.object({
        startDate: z.iso.date(),
        endDate: z.iso.date(),
      }).refine((value) => value.endDate >= value.startDate, {
        message: "End date must be on or after the start date",
        path: ["endDate"],
      }), request.query);
      return sendSuccess(response, await service.financialBasis(query.startDate, query.endDate));
    }),
    createPeriod: asyncHandler(async (request, response) => {
      const result = await service.createPeriod(parse(createPatronagePeriodSchema, request.body), requireAuth(request.auth));
      return sendSuccess(response, result, { statusCode: 201, message: "Patronage period created." });
    }),
    recalculate: asyncHandler(async (request, response) => {
      const result = await service.recalculate(requireParam(request.params.id, "Period ID"), requireAuth(request.auth));
      return sendSuccess(response, result, { message: "Patronage allocations recalculated." });
    }),
    finalize: asyncHandler(async (request, response) => {
      const result = await service.finalize(requireParam(request.params.id, "Period ID"), requireAuth(request.auth));
      return sendSuccess(response, result, { message: "Patronage allocations finalized." });
    }),
    markPaid: asyncHandler(async (request, response) => {
      const input = parse(patronagePaymentSchema, request.body ?? {});
      const result = await service.markPaid(requireParam(request.params.id, "Allocation ID"), input.notes ?? null, requireAuth(request.auth));
      return sendSuccess(response, result, { message: "Patronage refund marked paid." });
    }),
    memberSummary: asyncHandler(async (request, response) => {
      return sendSuccess(response, await service.memberSummary(requireAuth(request.auth)));
    }),
  };
}
