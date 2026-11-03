import { Router } from "express";
import { createAuthenticate } from "../../middleware/authenticate";
import { requireRoles } from "../../middleware/authorize";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess } from "../../utils/response";
import { AppError } from "../../utils/app-error";
import { createAuthService, type AuthService } from "../auth/auth.service";
import { overviewFilterSchema, periodFor } from "./overview.schema";
import {
  createOverviewRepository,
  type OverviewRepository,
} from "./overview.repository";
import { overviewExport } from "./overview.export";
export function createFinancialOverviewRouter(
  auth: AuthService = createAuthService(),
  repo: OverviewRepository = createOverviewRepository(),
) {
  const router = Router(),
    access = [createAuthenticate(auth), requireRoles("chairman")];
  router.use("/financial-overview", (_req, res, next) => {
    res.setHeader("Cache-Control", "private, no-store");
    next();
  });
  const parse = (input: unknown) => {
    const result = overviewFilterSchema.safeParse(input);
    if (!result.success)
      throw new AppError(
        "Financial Overview filters are invalid.",
        422,
        "OVERVIEW_FILTERS",
        result.error.issues.map((i) => ({
          code: "VALIDATION_ERROR",
          field: i.path.join("."),
          message: i.message,
        })),
      );
    periodFor(result.data);
    return result.data;
  };
  router.get(
    "/financial-overview/options",
    ...access,
    asyncHandler(async (_req, res) => sendSuccess(res, await repo.options())),
  );
  router.get(
    "/financial-overview/summary",
    ...access,
    asyncHandler(async (req, res) =>
      sendSuccess(res, await repo.summary(parse(req.query))),
    ),
  );
  router.get(
    "/financial-overview/transactions",
    ...access,
    asyncHandler(async (req, res) =>
      sendSuccess(res, await repo.activity(parse(req.query))),
    ),
  );
  router.get(
    "/financial-overview/transactions/:id",
    ...access,
    asyncHandler(async (req, res) => {
      const id = String(req.params.id);
      if (!/^\d{1,20}$/.test(id))
        throw new AppError(
          "Financial record ID is invalid.",
          422,
          "OVERVIEW_FILTERS",
        );
      return sendSuccess(res, await repo.detail(id));
    }),
  );
  for (const key of ["trends", "categories", "sources", "review"] as const)
    router.get(
      `/financial-overview/${key}`,
      ...access,
      asyncHandler(async (req, res) => {
        const report = await repo.summary(parse(req.query));
        return sendSuccess(res, {
          period: report.period,
          filters: report.filters,
          result: report[key === "trends" ? "trend" : key],
        });
      }),
    );
  router.get(
    "/financial-overview/export",
    ...access,
    asyncHandler(async (req, res) => {
      const format = req.query.format ?? "xlsx";
      if (format !== "xlsx" && format !== "pdf")
        throw new AppError(
          "Choose PDF or Excel.",
          422,
          "OVERVIEW_EXPORT_FORMAT",
        );
      const file = await overviewExport(repo, parse(req.query), format);
      res.setHeader(
        "Content-Type",
        format === "xlsx"
          ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          : "application/pdf",
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="trackcoop-financial-overview.${format}"`,
      );
      res.send(file);
    }),
  );
  return router;
}
