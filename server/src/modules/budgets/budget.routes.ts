import { Router } from "express";
import { createAuthenticate } from "../../middleware/authenticate";
import { requireRoles } from "../../middleware/authorize";
import { createAuthService, type AuthService } from "../auth/auth.service";
import { createBudgetController } from "./budget.controller";
import { createBudgetService, type BudgetService } from "./budget.service";

export function createBudgetRouter(authService: AuthService = createAuthService(), budgetService: BudgetService = createBudgetService()) {
  const router = Router();
  const staff = [createAuthenticate(authService), requireRoles("chairman", "bookkeeper")];
  const chairmanOnly = [createAuthenticate(authService), requireRoles("chairman")];
  const controller = createBudgetController(budgetService);

  router.get("/budgets", ...staff, controller.list);
  router.get("/budgets/summary", ...staff, controller.summary);
  router.get("/budgets/:id", ...staff, controller.get);
  router.post("/budgets", ...chairmanOnly, controller.create);
  router.post("/budgets/:id/status", ...chairmanOnly, controller.transition);
  return router;
}
