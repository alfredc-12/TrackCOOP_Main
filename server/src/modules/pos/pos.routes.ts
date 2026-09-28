import { Router } from "express";
import { createAuthenticate, createOptionalAuthenticate } from "../../middleware/authenticate";
import { requireRoles } from "../../middleware/authorize";
import { createAuthService, type AuthService } from "../auth/auth.service";
import { createPosController } from "./pos.controller";
import { createPosService, type PosService } from "./pos.service";

export function createPosRouter(
  authService: AuthService = createAuthService(),
  posService: PosService = createPosService(),
) {
  const router = Router();
  const controller = createPosController(posService);
  const staff = [createAuthenticate(authService), requireRoles("chairman", "bookkeeper")];
  const chairmanOnly = [createAuthenticate(authService), requireRoles("chairman")];
  const bookkeeperOnly = [createAuthenticate(authService), requireRoles("bookkeeper")];
  const memberOnly = [createAuthenticate(authService), requireRoles("member")];
  const optionalAuth = createOptionalAuthenticate(authService);

  router.get("/pos/orders", ...staff, controller.listOrders);
  router.get("/pos/history", ...memberOnly, controller.listHistory);
  router.post("/pos/checkout", optionalAuth, controller.checkout);
  router.put("/pos/orders/:id/confirm", ...bookkeeperOnly, controller.confirmOrder);
  router.put("/pos/orders/:id/complete", ...chairmanOnly, controller.completeOrder);
  router.put("/pos/orders/:id/reject", ...bookkeeperOnly, controller.rejectOrder);
  router.put("/pos/orders/:id/revoke", ...bookkeeperOnly, controller.revokeOrder);

  return router;
}
