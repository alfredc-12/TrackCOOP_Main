import { Router } from "express";
import { createAuthenticate } from "../../middleware/authenticate";
import { requireRoles } from "../../middleware/authorize";
import { createAuthService, type AuthService } from "../auth/auth.service";
import { createLandingController } from "./landing.controller";
import { createLandingService, type LandingService } from "./landing.service";

export function createLandingRouter(
  authService: AuthService = createAuthService(),
  landingService: LandingService = createLandingService(),
) {
  const router = Router();
  const controller = createLandingController(landingService);
  const chairmanOnly = [createAuthenticate(authService), requireRoles("chairman")];

  router.get("/public/landing", controller.publicLanding);
  router.get("/landing/:collection", ...chairmanOnly, controller.list);
  router.post("/landing/:collection", ...chairmanOnly, controller.create);
  router.patch("/landing/:collection/:id", ...chairmanOnly, controller.update);
  router.get("/system-settings", ...chairmanOnly, controller.listSettings);
  router.put("/system-settings", ...chairmanOnly, controller.upsertSetting);
  router.get("/audit-logs", ...chairmanOnly, controller.listAuditLogs);

  return router;
}
