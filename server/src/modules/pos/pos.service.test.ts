import assert from "node:assert/strict";
import test from "node:test";
import type { AuthContext } from "../auth/auth.types";
import type { PaymongoService } from "../paymongo/paymongo.service";
import type { PosRepository } from "./pos.repository";
import { createPosService } from "./pos.service";

test("cash checkout responds before customer email delivery finishes", async () => {
  let emailStarted = false;
  const repository = {
    async createCheckout() {
      return {
        saleId: 17,
        totalAmount: 300,
        discountAmount: 0,
        paymentReferenceId: 41,
      };
    },
  } as unknown as PosRepository;
  const unresolvedEmail = new Promise<"sent">(() => undefined);
  const service = createPosService(
    repository,
    {} as PaymongoService,
    {
      async sendCashPaymentInstructions() {
        emailStarted = true;
        return unresolvedEmail;
      },
      async sendPosPaymentReceipt() {
        return "skipped";
      },
    },
  );

  const result = await service.checkout({ paymentMethod: "Cash", items: [{ id: 1, quantity: 1 }] }, null);

  assert.equal(emailStarted, true);
  assert.equal(result.paymentMethod, "Cash");
  assert.equal(result.paymentStatus, "Pending");
  assert.equal(result.paymentReferenceId, 41);
});

test("cash payment confirmation responds before receipt email delivery finishes", async () => {
  let emailStarted = false;
  const repository = {
    async confirmOrder() {
      return { paymentReferenceId: 41, saleId: 17 };
    },
  } as unknown as PosRepository;
  const unresolvedEmail = new Promise<"sent">(() => undefined);
  const service = createPosService(
    repository,
    {} as PaymongoService,
    {
      async sendCashPaymentInstructions() {
        return "skipped";
      },
      async sendPosPaymentReceipt() {
        emailStarted = true;
        return unresolvedEmail;
      },
    },
  );

  const result = await service.confirmOrder(
    "17",
    {},
    {
      user: { id: "7", displayName: "Bookkeeper", email: "bookkeeper@example.com", username: null, role: "bookkeeper" },
      sessionId: "session",
      tokenHash: "token",
    } satisfies AuthContext,
  );

  assert.equal(emailStarted, true);
  assert.equal(result.paymentReferenceId, 41);
});
