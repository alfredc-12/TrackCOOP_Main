import { Router } from "express";
import { createAuthenticate } from "../../middleware/authenticate";
import { requireRoles } from "../../middleware/authorize";
import { createAuthService, type AuthService } from "../auth/auth.service";
import { createPaymentReferenceController } from "./payment-reference.controller";
import { createPaymentReferenceService, type PaymentReferenceService } from "./payment-reference.service";
import { createPaymentValidationController } from "./payment-validation.controller";
import { createPaymentValidationService, type PaymentValidationService } from "./payment-validation.service";

export function createPaymentReferenceRouter(
  authService: AuthService = createAuthService(),
  paymentReferenceService: PaymentReferenceService = createPaymentReferenceService(),
  paymentValidationService: PaymentValidationService = createPaymentValidationService(),
) {
  const router = Router();
  const controller = createPaymentReferenceController(paymentReferenceService);
  const validationController = createPaymentValidationController(paymentValidationService);
  const staff = [createAuthenticate(authService), requireRoles("chairman", "bookkeeper")];
  const bookkeeperOnly = [createAuthenticate(authService), requireRoles("bookkeeper")];
  router.get("/payment-references", ...staff, validationController.list);
  router.get("/payment-references/summary", ...staff, controller.summary);
  router.post("/payment-references", ...bookkeeperOnly, controller.create);
  router.get("/payment-references/:id", ...staff, validationController.detail);
  router.get("/payment-references/:id/proof", ...bookkeeperOnly, controller.proof);
  router.get("/payment-references/:id/receipt", ...bookkeeperOnly, controller.receiptStatus);
  router.post("/payment-references/:id/receipt/retry", ...bookkeeperOnly, controller.retryReceipt);
  router.patch("/payment-references/:id", ...bookkeeperOnly, controller.update);
  router.post("/payment-references/:id/validate", ...bookkeeperOnly, controller.validate);
  router.post("/payment-references/:id/reject", ...bookkeeperOnly, controller.reject);
  router.post("/payment-references/:id/request-clarification", ...bookkeeperOnly, controller.clarification);
  router.post("/payment-references/:id/return-to-pending", ...bookkeeperOnly, controller.returnPending);
  router.post("/payment-references/:id/reverse", ...bookkeeperOnly, controller.reverse);
  router.post("/payment-gateway-events/:eventId/retry", ...bookkeeperOnly, validationController.retryGatewayEvent);
  return router;
}
