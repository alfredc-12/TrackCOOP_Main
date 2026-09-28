import { createPaymongoService, type PaymongoService } from "../paymongo/paymongo.service";
import type { AuthContext } from "../auth/auth.types";
import { createPosRepository, type PosRepository } from "./pos.repository";
import { sendCashPaymentInstructions, sendPosPaymentReceipt } from "./pos-email";
import type { CheckoutPayload, CompleteOrderInput, ConfirmOrderInput, PosReasonInput } from "./pos.types";

type PosEmailSender = {
  sendCashPaymentInstructions: typeof sendCashPaymentInstructions;
  sendPosPaymentReceipt: typeof sendPosPaymentReceipt;
};

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
      if (result.paymentReferenceId) {
        void emailSender.sendPosPaymentReceipt(String(result.paymentReferenceId));
      }
      return result;
    },
    completeOrder: (orderId, input, auth) => repository.completeOrder(orderId, input, auth),
    rejectOrder: (orderId, input, auth) => repository.rejectOrder(orderId, input, auth),
    revokeOrder: (orderId, input, auth) => repository.revokeOrder(orderId, input, auth),
  };
}
