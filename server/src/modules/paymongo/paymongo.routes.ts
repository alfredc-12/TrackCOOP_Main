import { Router } from "express";
import rateLimit from "express-rate-limit";
import { createAuthenticate } from "../../middleware/authenticate";
import { requireRoles } from "../../middleware/authorize";
import { createAuthService, type AuthService } from "../auth/auth.service";
import { createPaymongoController } from "./paymongo.controller";
import {
  createPaymongoService,
  type PaymongoService,
} from "./paymongo.service";

function createPublicCheckoutLimiter() {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
      success: false,
      message: "Too many PayMongo checkout requests. Please try again later.",
      errors: [
        {
          code: "PAYMONGO_CHECKOUT_RATE_LIMITED",
          message: "Too many PayMongo checkout requests. Please try again later.",
        },
      ],
    },
  });
}

export function createPaymongoRouter(
  authService: AuthService = createAuthService(),
  paymongoService: PaymongoService = createPaymongoService(),
) {
  const router = Router();
  const controller = createPaymongoController(paymongoService);
  const publicCheckoutLimiter = createPublicCheckoutLimiter();
  const authenticatedPaymentUser = [
    createAuthenticate(authService),
    requireRoles("chairman", "bookkeeper", "member"),
  ];

  router.post(
    "/paymongo/checkouts/membership-applications/:applicationCode",
    publicCheckoutLimiter,
    controller.createMembershipApplicationCheckout,
  );
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
