import { Router } from "express";
import { createAuthenticate } from "../../middleware/authenticate";
import { requireRoles } from "../../middleware/authorize";
import { createAuthService, type AuthService } from "../auth/auth.service";
import { createSeasonController } from "./season.controller";
import { createSeasonService, type SeasonService } from "./season.service";

export function createSeasonRouter(authService: AuthService = createAuthService(), seasonService: SeasonService = createSeasonService()) {
  const router = Router();
  const staff = [createAuthenticate(authService), requireRoles("chairman", "bookkeeper")];
  const chairmanOnly = [createAuthenticate(authService), requireRoles("chairman")];
  const controller = createSeasonController(seasonService);

  router.get("/seasons", ...staff, controller.list);
  router.get("/seasons/:id", ...staff, controller.get);
  router.post("/seasons", ...chairmanOnly, controller.create);
  router.post("/seasons/:id/status", ...chairmanOnly, controller.transition);
  router.get("/production-records", ...staff, controller.listProduction);
  router.post("/production-records", ...staff, controller.createProduction);
  router.get("/seasonal-analytics", ...staff, controller.analytics);
  return router;
}
