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

const bookkeeper = {
  user: { id: "7", displayName: "Bookkeeper", email: "bookkeeper@example.com", username: null, role: "bookkeeper" },
  sessionId: "session",
  tokenHash: "token",
} satisfies AuthContext;
const confirmRepository = { async confirmOrder() { return { paymentReferenceId: 41, saleId: 17, receiptDocumentId: null }; } } as unknown as PosRepository;
const noEmail = { async sendCashPaymentInstructions() { return "skipped" as const; }, async sendPosPaymentReceipt() { return "skipped" as const; } };

test("confirming a cash payment creates the official receipt once and returns its document", async () => {
  const processed: string[] = [];
  const service = createPosService(confirmRepository, {} as PaymongoService, noEmail, {
    async process(paymentReferenceId: string) {
      processed.push(paymentReferenceId);
      return { processingStatus: "Generated", documentId: "88" } as never;
    },
  });
  const result = await service.confirmOrder("17", {}, bookkeeper);
  assert.deepEqual(processed, ["41"]);
  assert.equal(result.receiptDocumentId, 88);
});

test("a receipt that cannot be generated never undoes the confirmed payment", async () => {
  const service = createPosService(confirmRepository, {} as PaymongoService, noEmail, {
    async process() {
      throw new Error("storage unavailable");
    },
  });
  const result = await service.confirmOrder("17", {}, bookkeeper);
  assert.equal(result.paymentReferenceId, 41);
  assert.equal(result.receiptDocumentId, null);
});
