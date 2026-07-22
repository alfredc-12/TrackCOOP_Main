import { Router } from "express";
import { createAuthenticate } from "../../middleware/authenticate";
import { requireRoles } from "../../middleware/authorize";
import { createAuthService, type AuthService } from "../auth/auth.service";
import { createFinanceController } from "./finance.controller";
import { createFinanceService, type FinanceService } from "./finance.service";

export function createFinanceRouter(
  authService: AuthService = createAuthService(),
  financeService: FinanceService = createFinanceService(),
) {
  const router = Router();
  const controller = createFinanceController(financeService);
  const staff = [createAuthenticate(authService), requireRoles("chairman", "bookkeeper")];
  const bookkeeperOnly = [createAuthenticate(authService), requireRoles("bookkeeper")];

  router.get("/financial-categories", ...staff, controller.listCategories);
  router.post("/financial-categories", ...bookkeeperOnly, controller.createCategory);
  router.patch("/financial-categories/:id", ...bookkeeperOnly, controller.updateCategory);

  router.get("/financial-records", ...staff, controller.listRecords);
  router.post("/financial-records", ...bookkeeperOnly, controller.createRecord);
  router.get("/financial-records/summary", ...staff, controller.summary);
  router.get("/financial-records/trends", ...staff, controller.trends);
  router.get("/financial-records/:id", ...staff, controller.detailRecord);
  router.patch("/financial-records/:id", ...bookkeeperOnly, controller.updateRecord);
  router.post("/financial-records/:id/post", ...bookkeeperOnly, controller.postRecord);
  router.post("/financial-records/:id/void", ...bookkeeperOnly, controller.voidRecord);

  return router;
}
