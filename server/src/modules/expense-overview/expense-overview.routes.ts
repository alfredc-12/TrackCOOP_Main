import { Router } from "express";
import { createAuthenticate } from "../../middleware/authenticate";
import { requireRoles } from "../../middleware/authorize";
import { createAuthService, type AuthService } from "../auth/auth.service";
import { createExpenseOverviewController } from "./expense-overview.controller";
import { createExpenseOverviewService, type ExpenseOverviewService } from "./expense-overview.service";

/**
 * Read-only expense monitoring for the Chairman. Every route is a GET: recording, posting, correcting and
 * voiding expenses stay with the Bookkeeper's existing workflows.
 */
export function createExpenseOverviewRouter(
  authService: AuthService = createAuthService(),
  service: ExpenseOverviewService = createExpenseOverviewService(),
) {
  const router = Router();
  const controller = createExpenseOverviewController(service);
  const chairman = [createAuthenticate(authService), requireRoles("chairman")];

  router.get("/financial-overview/expenses/summary", ...chairman, controller.summary);
  router.get("/financial-overview/expenses/trends", ...chairman, controller.trends);
  router.get("/financial-overview/expenses/categories", ...chairman, controller.categories);
  router.get("/financial-overview/expenses/sources", ...chairman, controller.sources);
  router.get("/financial-overview/expenses/drivers", ...chairman, controller.drivers);
  router.get("/financial-overview/expenses/matrix", ...chairman, controller.matrix);
  router.get("/financial-overview/expenses/integrity", ...chairman, controller.integrity);
  router.get("/financial-overview/expenses/insights", ...chairman, controller.insights);
  router.get("/financial-overview/expenses/options", ...chairman, controller.options);
  router.get("/financial-overview/expenses/export", ...chairman, controller.export);
  router.get("/financial-overview/expenses/records", ...chairman, controller.records);
  router.get("/financial-overview/expenses/records/:id", ...chairman, controller.recordDetail);

  return router;
}
