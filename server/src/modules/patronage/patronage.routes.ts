import { Router } from "express";
import { createAuthenticate } from "../../middleware/authenticate";
import { requireRoles } from "../../middleware/authorize";
import { createAuthService, type AuthService } from "../auth/auth.service";
import { createPatronageController } from "./patronage.controller";
import { createPatronageService, type PatronageService } from "./patronage.service";

export function createPatronageRouter(
  authService: AuthService = createAuthService(),
  patronageService: PatronageService = createPatronageService(),
) {
  const router = Router();
  const controller = createPatronageController(patronageService);
  const chairmanOnly = [createAuthenticate(authService), requireRoles("chairman")];
  const memberOnly = [createAuthenticate(authService), requireRoles("member")];

  router.get("/patronage", ...chairmanOnly, controller.overview);
  router.get("/patronage/financial-basis", ...chairmanOnly, controller.financialBasis);
  router.post("/patronage/periods", ...chairmanOnly, controller.createPeriod);
  router.post("/patronage/periods/:id/recalculate", ...chairmanOnly, controller.recalculate);
  router.post("/patronage/periods/:id/finalize", ...chairmanOnly, controller.finalize);
  router.post("/patronage/allocations/:id/paid", ...chairmanOnly, controller.markPaid);
  router.get("/members/me/patronage", ...memberOnly, controller.memberSummary);

  return router;
}
