import { Router } from "express";
import { createAuthenticate } from "../../middleware/authenticate";
import { requireRoles } from "../../middleware/authorize";
import { AppError } from "../../utils/app-error";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess } from "../../utils/response";
import { createAuthService, type AuthService } from "../auth/auth.service";
import { dashboardQuerySchema } from "./bookkeeper-dashboard.schema";
import { createBookkeeperDashboardService, type BookkeeperDashboardService } from "./bookkeeper-dashboard.service";

/** Read-only, Bookkeeper-only financial dashboard. The Chairman keeps separate governance views. */
export function createBookkeeperDashboardRouter(
  authService: AuthService = createAuthService(),
  service: BookkeeperDashboardService = createBookkeeperDashboardService(),
) {
  const router = Router();
  const bookkeeperOnly = [createAuthenticate(authService), requireRoles("bookkeeper")];

  router.get(
    "/bookkeeper/financial-dashboard",
    ...bookkeeperOnly,
    asyncHandler(async (request, response) => {
      const parsed = dashboardQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        throw new AppError(
          "Dashboard filters are invalid.",
          422,
          "FINANCE_FILTERS",
          parsed.error.issues.map((issue) => ({ code: "VALIDATION_ERROR", field: issue.path.join("."), message: issue.message })),
        );
      }
      response.setHeader("Cache-Control", "no-store");
      return sendSuccess(response, await service.dashboard(parsed.data));
    }),
  );

  return router;
}

