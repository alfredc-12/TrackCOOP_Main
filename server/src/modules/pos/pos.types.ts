export type CheckoutItem = {
  id: number;
  quantity: number;
};

export type CheckoutPayload = {
  items?: CheckoutItem[];
  paymentName?: string;
  paymentEmail?: string;
  paymentContact?: string;
  paymentMethod?: "QRPH" | "Cash";
};

export type PosReasonInput = {
  reason?: string;
};

export type ConfirmOrderInput = {
  discount_amount?: number | string;
};

export type CompleteOrderInput = {
  note?: string;
};

export type CheckoutResult = {
  success: true;
  saleId: number;
  totalAmount: number;
  discountAmount: number;
  paymentReferenceId: number;
  checkoutUrl: string;
  checkoutId: string;
  gatewayStatus: string;
  mode: string;
};
