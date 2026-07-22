import { Router } from "express";
import { createAuthenticate } from "../../middleware/authenticate";
import { requireRoles } from "../../middleware/authorize";
import { createAuthService, type AuthService } from "../auth/auth.service";
import { createPaymentReferenceController } from "./payment-reference.controller";
import {
  createPaymentReferenceService,
  type PaymentReferenceService,
} from "./payment-reference.service";

export function createPaymentReferenceRouter(
  authService: AuthService = createAuthService(),
  paymentReferenceService: PaymentReferenceService = createPaymentReferenceService(),
) {
  const router = Router();
  const controller = createPaymentReferenceController(paymentReferenceService);
  const staff = [createAuthenticate(authService), requireRoles("chairman", "bookkeeper")];
  const bookkeeperOnly = [createAuthenticate(authService), requireRoles("bookkeeper")];

  router.get("/payment-references", ...staff, controller.list);
  router.post("/payment-references", ...staff, controller.create);
  router.get("/payment-references/:id", ...staff, controller.detail);
  router.patch("/payment-references/:id", ...staff, controller.update);
  router.post("/payment-references/:id/validate", ...bookkeeperOnly, controller.validate);
  router.post("/payment-references/:id/reject", ...bookkeeperOnly, controller.reject);
  router.post(
    "/payment-references/:id/request-clarification",
    ...bookkeeperOnly,
    controller.clarification,
  );

  return router;
}
