import { Router } from "express";
import { z } from "zod";
import { AppError } from "../../utils/app-error";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess } from "../../utils/response";
import {
  rfmCommitSchema,
  rfmFiltersSchema,
  rfmRecalculationSchema,
} from "./member-indicator.policy";
import {
  createRfmWorkspaceRepository,
  type RfmWorkspaceRepository,
} from "./member-indicator.workspace-repository";
import {
  createRfmWorkbook,
  exportRfmWorkspace,
  rfmResultRows,
} from "./member-indicator.export";

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success)
    throw new AppError(
      "Check the indicator filters or calculation input.",
      400,
      "VALIDATION_ERROR",
      result.error.issues.map((i) => ({
        code: "VALIDATION_ERROR",
        field: i.path.join("."),
        message: i.message,
      })),
    );
  return result.data;
}
const pageSchema = z.object({
  page: z.coerce.number().int().positive().max(1000000).default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});
const idSchema = z.string().regex(/^\d+$/).max(30);
export function createRfmWorkspaceRouter(
  repository: RfmWorkspaceRepository = createRfmWorkspaceRepository(),
) {
  const router = Router();
  router.use((_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });
  router.get(
    "/",
    asyncHandler(async (req, res) =>
      sendSuccess(
        res,
        await repository.workspace(parse(rfmFiltersSchema, req.query)),
      ),
    ),
  );
  router.get(
    "/export",
    asyncHandler(async (req, res) => {
      const data = await repository.workspace(
        parse(rfmFiltersSchema, req.query),
        true,
      );
      const workbook = await exportRfmWorkspace(data);
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="member-indicators.xlsx"',
      );
      res.setHeader("Cache-Control", "no-store");
      return res.send(workbook);
    }),
  );
  router.get(
    "/runs",
    asyncHandler(async (req, res) => {
      const page = parse(pageSchema, req.query);
      return sendSuccess(res, await repository.runs(page.page, page.pageSize));
    }),
  );
  router.post(
    "/preview",
    asyncHandler(async (req, res) =>
      sendSuccess(
        res,
        await repository.preview(parse(rfmRecalculationSchema, req.body)),
      ),
    ),
  );
  router.post(
    "/recalculate",
    asyncHandler(async (req, res) => {
      if (!req.auth)
        throw new AppError(
          "Authentication is required.",
          401,
          "UNAUTHENTICATED",
        );
      const input = parse(rfmCommitSchema, req.body);
      return sendSuccess(
        res,
        await repository.recalculate(input, req.auth, input.previewFingerprint),
      );
    }),
  );
  router.get(
    "/:memberId/history",
    asyncHandler(async (req, res) => {
      const page = parse(pageSchema, req.query);
      return sendSuccess(
        res,
        await repository.history(
          parse(idSchema, req.params.memberId),
          page.page,
          page.pageSize,
        ),
      );
    }),
  );
  router.get(
    "/:memberId/history/export",
    asyncHandler(async (req, res) => {
      const id = parse(idSchema, req.params.memberId);
      const { rows } = await repository.history(id, 1, 100, true);
      const workbook = await createRfmWorkbook([
        { name: "Saved RFM History", rows: rfmResultRows(rows) },
        {
          name: "Context",
          rows: [
            ["Definition", "Value"],
            ["Generated at (UTC)", new Date().toISOString()],
            [
              "Scope",
              `Member ${id}; all saved observations, ordered by basis end. Advisory indicators only.`,
            ],
            [
              "Comparability",
              "Compare distinct basis periods only when formula and preserved configuration fingerprints agree. Repeated calculations are observations, not additional months.",
            ],
          ],
        },
      ]);
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="member-rfm-history.xlsx"',
      );
      res.setHeader("Cache-Control", "no-store");
      return res.send(workbook);
    }),
  );
  router.get(
    "/:memberId/evidence/:indicatorId",
    asyncHandler(async (req, res) =>
      sendSuccess(
        res,
        await repository.evidence(
          parse(idSchema, req.params.memberId),
          parse(idSchema, req.params.indicatorId),
        ),
      ),
    ),
  );
  return router;
}
