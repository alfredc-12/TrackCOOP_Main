import { createPaymongoService, type PaymongoService } from "../paymongo/paymongo.service";
import { createPaymentReceiptService, type PaymentReceiptService } from "../paymongo/paymongo.settlement.receipt";
import type { AuthContext } from "../auth/auth.types";
import { createPosRepository, type PosRepository } from "./pos.repository";
import { sendCashPaymentInstructions, sendPosPaymentReceipt } from "./pos-email";
import type { CheckoutPayload, CompleteOrderInput, ConfirmOrderInput, PosReasonInput } from "./pos.types";

type PosEmailSender = {
  sendCashPaymentInstructions: typeof sendCashPaymentInstructions;
  sendPosPaymentReceipt: typeof sendPosPaymentReceipt;
};

const RECEIPT_RETRY_DELAYS_MS = [15_000, 60_000, 300_000];

/**
 * Bounded retries after a failed receipt. process() is idempotent (one receipt row and one deterministic file per
 * payment), so a retry can never create a second receipt. If these also fail, the Bookkeeper is notified and can
 * use Retry receipt; nothing is lost because the receipt row stays Pending or Failed.
 */
function scheduleReceiptRetries(service: Pick<PaymentReceiptService, "process">, paymentReferenceId: string, attempt = 0) {
  if (attempt >= RECEIPT_RETRY_DELAYS_MS.length) return;
  const timer = setTimeout(async () => {
    const status = await service.process(paymentReferenceId).catch(() => null);
    if (status?.processingStatus !== "Generated") scheduleReceiptRetries(service, paymentReferenceId, attempt + 1);
  }, RECEIPT_RETRY_DELAYS_MS[attempt]);
  timer.unref?.();
}

export interface PosService {
  listOrders(): ReturnType<PosRepository["listOrders"]>;
  listMemberHistory(auth: AuthContext): ReturnType<PosRepository["listMemberHistory"]>;
  checkout(input: CheckoutPayload, auth: AuthContext | null): Promise<Record<string, unknown>>;
  confirmOrder(orderId: string, input: ConfirmOrderInput, auth: AuthContext): ReturnType<PosRepository["confirmOrder"]>;
  completeOrder(orderId: string, input: CompleteOrderInput, auth: AuthContext): ReturnType<PosRepository["completeOrder"]>;
  rejectOrder(orderId: string, input: PosReasonInput, auth: AuthContext): ReturnType<PosRepository["rejectOrder"]>;
  revokeOrder(orderId: string, input: PosReasonInput, auth: AuthContext): ReturnType<PosRepository["revokeOrder"]>;
}

export function createPosService(
  repository: PosRepository = createPosRepository(),
  paymongoService: PaymongoService = createPaymongoService(),
  emailSender: PosEmailSender = { sendCashPaymentInstructions, sendPosPaymentReceipt },
  receiptService: Pick<PaymentReceiptService, "process"> = createPaymentReceiptService(),
): PosService {
  return {
    listOrders: () => repository.listOrders(),
    listMemberHistory: (auth) => repository.listMemberHistory(auth),
    async checkout(input, auth) {
      const sale = await repository.createCheckout(input, auth);
      if (input.paymentMethod === "Cash") {
        void emailSender.sendCashPaymentInstructions(String(sale.paymentReferenceId));
        return {
          success: true,
          saleId: sale.saleId,
          totalAmount: sale.totalAmount,
          discountAmount: sale.discountAmount,
          paymentReferenceId: sale.paymentReferenceId,
          paymentMethod: "Cash",
          paymentStatus: "Pending",
        };
      }
      const checkout = await paymongoService.createPointOfSaleCheckout(String(sale.paymentReferenceId));
      return {
        success: true,
        saleId: sale.saleId,
        totalAmount: sale.totalAmount,
        discountAmount: sale.discountAmount,
        paymentReferenceId: sale.paymentReferenceId,
        checkoutUrl: checkout.checkoutUrl,
        checkoutId: checkout.checkoutId,
        gatewayStatus: checkout.gatewayStatus,
        mode: checkout.mode,
        paymentMethod: "QRPH",
      };
    },
    async confirmOrder(orderId, input, auth) {
      const result = await repository.confirmOrder(orderId, input, auth);
      if (!result.paymentReferenceId) return result;
      const paymentReferenceId = String(result.paymentReferenceId);
      // The payment is committed. Generate its one official receipt; the customer's email is queued by the
      // receipt itself the moment it becomes Generated, so a failure here never produces a premature email.
      const receipt = await receiptService.process(paymentReferenceId).catch(() => null);
      if (receipt?.processingStatus !== "Generated") scheduleReceiptRetries(receiptService, paymentReferenceId);
      // Legacy direct send (smtp mode only; inert in resend mode).
      void emailSender.sendPosPaymentReceipt(paymentReferenceId);
      return { ...result, receiptDocumentId: receipt?.documentId ? Number(receipt.documentId) : result.receiptDocumentId };
    },
    completeOrder: (orderId, input, auth) => repository.completeOrder(orderId, input, auth),
    rejectOrder: (orderId, input, auth) => repository.rejectOrder(orderId, input, auth),
    revokeOrder: (orderId, input, auth) => repository.revokeOrder(orderId, input, auth),
  };
}
