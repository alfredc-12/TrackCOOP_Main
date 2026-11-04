import { Router } from "express";
import { z } from "zod";
import { createAuthenticate } from "../../middleware/authenticate";
import { requireRoles } from "../../middleware/authorize";
import { createAuthService, type AuthService } from "../auth/auth.service";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess } from "../../utils/response";
import { AppError } from "../../utils/app-error";
import { parseFinancialAnalyticsFilters } from "./financial-analytics.filters";
import { buildWorkbook, matrixSheets, periodSheets, reportSheets } from "./financial-analytics.export";
import { createFinancialAnalyticsService, type FinancialAnalyticsService } from "./financial-analytics.service";
import { inclusiveDays, isValidDate, MAX_REPORTING_DAYS } from "./financial-analytics.periods";

const windowSchema = z.object({ from: z.string().refine(isValidDate), to: z.string().refine(isValidDate) });
function parseWindow(query: Record<string, unknown>, asOf: string) {
  const parsed = windowSchema.safeParse(query);
  if (!parsed.success || parsed.data.from > parsed.data.to || parsed.data.to > asOf || inclusiveDays(parsed.data.from, parsed.data.to) > MAX_REPORTING_DAYS) {
    throw new AppError("Choose a valid period that ends on or before today.", 400, "VALIDATION_ERROR");
  }
  return parsed.data;
}
const scopeSchema = z.enum(["full", "matrix", "period"]).default("full");

export function createFinancialAnalyticsRouter(auth: AuthService = createAuthService(), service: FinancialAnalyticsService = createFinancialAnalyticsService()) {
  const router = Router();
  const access = [createAuthenticate(auth), requireRoles("chairman")];
  const noStore = (res: import("express").Response) => res.setHeader("Cache-Control", "private, no-store");

  router.get("/chairman/financial-analytics", ...access, asyncHandler(async (req, res) => {
    const filters = parseFinancialAnalyticsFilters(req.query);
    noStore(res);
    return sendSuccess(res, await service.report(filters));
  }));

  router.get("/chairman/financial-analytics/matrix", ...access, asyncHandler(async (req, res) => {
    const filters = parseFinancialAnalyticsFilters(req.query);
    noStore(res);
    return sendSuccess(res, await service.matrix(filters));
  }));

  router.get("/chairman/financial-analytics/period", ...access, asyncHandler(async (req, res) => {
    const filters = parseFinancialAnalyticsFilters(req.query);
    const window = parseWindow(req.query, filters.asOf);
    noStore(res);
    return sendSuccess(res, await service.period(filters, window));
  }));

  router.get("/chairman/financial-analytics/export", ...access, asyncHandler(async (req, res) => {
    const filters = parseFinancialAnalyticsFilters(req.query);
    const scope = scopeSchema.safeParse(req.query.scope);
    if (!scope.success) throw new AppError("Unknown export scope", 400, "VALIDATION_ERROR");
    const window = scope.data === "period" ? parseWindow(req.query, filters.asOf) : undefined;
    const source = await service.workbookSource(filters, window);
    const sheets = scope.data === "matrix" ? matrixSheets(source.report, source) : scope.data === "period" && source.period ? periodSheets(source.report, source.period) : reportSheets(source.report, source);
    noStore(res);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="financial-analytics-${scope.data}-${source.filters.asOf}.xlsx"`);
    res.send(await buildWorkbook(sheets));
  }));

  return router;
}
