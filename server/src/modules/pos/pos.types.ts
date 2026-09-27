export type CheckoutItem = {
  id: number;
  quantity: number;
};

export type CheckoutPayload = {
  items?: CheckoutItem[];
  paymentMethod?: "Cash" | "Online Payment";
  paymentName?: string;
  paymentEmail?: string;
  paymentContact?: string;
};

export type PosReasonInput = {
  reason?: string;
};

export type ConfirmOrderInput = {
  discount_amount?: number | string;
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
