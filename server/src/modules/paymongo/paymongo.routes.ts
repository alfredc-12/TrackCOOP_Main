import { Router } from "express";
import rateLimit from "express-rate-limit";
import { createAuthenticate } from "../../middleware/authenticate";
import { requireRoles } from "../../middleware/authorize";
import { createAuthService, type AuthService } from "../auth/auth.service";
import { createPaymongoController } from "./paymongo.controller";
import { createPaymongoMemberShareCapitalController } from "./paymongo.member-share-capital.controller";
import {
  createPaymongoMemberShareCapitalService,
  type PaymongoMemberShareCapitalService,
} from "./paymongo.member-share-capital.service";
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

function createMemberCheckoutLimiter() {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 12,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
      success: false,
      message: "Too many Member Share Capital checkout requests. Please try again later.",
      errors: [
        {
          code: "MEMBER_SHARE_CAPITAL_RATE_LIMITED",
          message: "Too many Member Share Capital checkout requests. Please try again later.",
        },
      ],
    },
  });
}

export function createPaymongoRouter(
  authService: AuthService = createAuthService(),
  paymongoService?: PaymongoService,
  memberShareCapitalService?: PaymongoMemberShareCapitalService,
) {
  const router = Router();
  const paymentService = paymongoService ?? createPaymongoService();
  const controller = createPaymongoController(paymentService);
  const memberService = memberShareCapitalService
    ?? (paymongoService ? null : createPaymongoMemberShareCapitalService());
  const memberController = memberService
    ? createPaymongoMemberShareCapitalController(memberService)
    : null;
  const publicCheckoutLimiter = createPublicCheckoutLimiter();
  const memberCheckoutLimiter = createMemberCheckoutLimiter();
  const authenticatedPaymentUser = [
    createAuthenticate(authService),
    requireRoles("chairman", "bookkeeper", "member"),
  ];
  const memberOnly = [createAuthenticate(authService), requireRoles("member")];

  router.post(
    "/paymongo/checkouts/membership-applications/:applicationCode",
    publicCheckoutLimiter,
    controller.createMembershipApplicationCheckout,
  );
  if (memberController) {
    router.get(
      "/paymongo/members/me/share-capital",
      ...memberOnly,
      memberController.summary,
    );
    router.post(
      "/paymongo/checkouts/members/me/share-capital",
      ...memberOnly,
      memberCheckoutLimiter,
      memberController.checkout,
    );
  }
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
