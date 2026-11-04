import { Router } from "express";
import { z } from "zod";
import { createAuthenticate } from "../../middleware/authenticate";
import { requireRoles } from "../../middleware/authorize";
import { asyncHandler } from "../../utils/async-handler";
import { AppError } from "../../utils/app-error";
import { sendSuccess } from "../../utils/response";
import type { AuthService } from "../auth/auth.service";
import { parseActivityQuery } from "./activity.schema";
import {
  createActivityRepository,
  type ActivityRepository,
} from "./activity.repository";
export function createActivityRouter(
  auth: AuthService,
  repo: ActivityRepository = createActivityRepository(),
) {
  const router = Router(),
    access = [createAuthenticate(auth), requireRoles("chairman")];
  router.use("/audit-logs", (_r, res, next) => {
    res.setHeader("Cache-Control", "private, no-store");
    next();
  });
  router.get(
    "/audit-logs/options",
    ...access,
    asyncHandler(async (req, res) => {
      const r = z
        .string()
        .trim()
        .max(120)
        .safeParse(req.query.search ?? "");
      if (!r.success)
        throw new AppError(
          "User search is too long.",
          422,
          "INVALID_ACTIVITY_FILTERS",
        );
      return sendSuccess(res, await repo.options(r.data));
    }),
  );
  router.get(
    "/audit-logs",
    ...access,
    asyncHandler(async (req, res) => {
      const r = await repo.list(parseActivityQuery(req.query));
      return sendSuccess(res, r.items, {
        meta: { total: r.total, page: r.page, pageSize: r.pageSize },
      });
    }),
  );
  router.get(
    "/audit-logs/:id",
    ...access,
    asyncHandler(async (req, res) => {
      const id = String(req.params.id);
      if (!/^\d{1,20}$/.test(id))
        throw new AppError(
          "Activity reference is invalid.",
          422,
          "INVALID_ACTIVITY_ID",
        );
      return sendSuccess(res, await repo.detail(id));
    }),
  );
  return router;
}
