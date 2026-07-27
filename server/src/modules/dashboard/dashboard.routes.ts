import { Router } from "express";
import { DashboardController } from "./dashboard.controller";
import { DashboardService } from "./dashboard.service";
import { DashboardRepository } from "./dashboard.repository";
import { createAuthService, type AuthService } from "../auth/auth.service";
import { createAuthenticate } from "../../middleware/authenticate";
import { requireRoles } from "../../middleware/authorize";

export function createDashboardRouter(authService: AuthService | undefined = undefined): Router {
  const router = Router();
  
  const repository = new DashboardRepository();
  const service = new DashboardService(repository);
  const controller = new DashboardController(service);

  const authSvc = authService || createAuthService();
  const chairmanOnly = [createAuthenticate(authSvc), requireRoles("chairman")];

  router.get(
    "/chairman/dashboard",
    ...chairmanOnly,
    controller.getChairmanDashboard
  );

  return router;
}
