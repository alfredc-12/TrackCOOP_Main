import { Router } from "express";
import { createAuthenticate } from "../../middleware/authenticate";
import { requireRoles } from "../../middleware/authorize";
import { createAuthService, type AuthService } from "../auth/auth.service";
import { createPaymongoController } from "./paymongo.controller";
import {
  createPaymongoService,
  type PaymongoService,
} from "./paymongo.service";

export function createPaymongoRouter(
  authService: AuthService = createAuthService(),
  paymongoService: PaymongoService = createPaymongoService(),
) {
  const router = Router();
  const controller = createPaymongoController(paymongoService);
  const authenticatedPaymentUser = [
    createAuthenticate(authService),
    requireRoles("chairman", "bookkeeper", "member"),
  ];

  router.post(
    "/paymongo/checkouts/payment-references/:paymentReferenceId",
    ...authenticatedPaymentUser,
    controller.createPaymentReferenceCheckout,
  );
  router.get(
    "/paymongo/payments/:paymentReferenceId/status",
    ...authenticatedPaymentUser,
    controller.getPaymentReferenceStatus,
  );

  return router;
}

