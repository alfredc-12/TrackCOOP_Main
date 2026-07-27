import type { AuthContext } from "../auth/auth.types";
import type { ValidationStatus } from "../payment-references/payment-reference.types";

export type PaymongoMode = "test" | "live";
export type PaymongoGatewayEnvironment = "Test" | "Live" | "Manual";
export type PaymongoOnlineGatewayEnvironment = Exclude<PaymongoGatewayEnvironment, "Manual">;
export type PaymongoPaymentChannel =
  | "PayMongo"
  | "Manual GCash"
  | "Cash"
  | "Bank Transfer"
  | "Other";

export type PaymongoConfig = {
  enabled: boolean;
  mode: PaymongoMode;
  apiBaseUrl: string;
  secretKey?: string;
  webhookSecret?: string;
  webhookToleranceSeconds: number;
  checkoutReuseMinutes?: number;
  paymentMethodTypes: string[];
  passOnFees: boolean;
  successUrl: string;
  cancelUrl: string;
  timeoutMs: number;
};

export type PaymongoBilling = {
  name?: string;
  email?: string;
  phone?: string;
};

export type PaymongoLineItem = {
  name: string;
  amount: number;
  currency: "PHP";
  quantity: number;
  description?: string;
};

export type PaymongoCheckoutRequest = {
  referenceNumber: string;
  description: string;
  lineItems: PaymongoLineItem[];
  paymentMethodTypes: string[];
  successUrl: string;
  cancelUrl: string;
  billing?: PaymongoBilling;
  sendEmailReceipt: boolean;
  showDescription: boolean;
  showLineItems: boolean;
  passOnFees: boolean;
  metadata: Record<string, string>;
};

export type PaymongoCheckoutSession = {
  id: string;
  checkoutUrl: string;
  status: string | null;
  livemode: boolean | null;
  paymentIntentId: string | null;
  paymentId: string | null;
};

export type PaymongoCheckoutAttemptRecord = {
  id: string;
  paymentReferenceId: string;
  attemptNumber: number;
  idempotencyKey: string;
  checkoutId: string;
  checkoutUrl: string | null;
  gatewayStatus: string | null;
  gatewayEnvironment: PaymongoOnlineGatewayEnvironment;
  amount: number;
  currency: "PHP";
  lastCheckedAt: Date | null;
  reusableUntil: Date;
  supersededAt: Date | null;
  completedAt: Date | null;
};

export type PaymongoReusableCheckoutAttemptRecord = Omit<
  PaymongoCheckoutAttemptRecord,
  "checkoutUrl"
> & {
  checkoutUrl: string;
};

export type PaymongoCheckoutAttemptResult = {
  record: PaymongoPaymentReferenceRecord;
  attempt: PaymongoReusableCheckoutAttemptRecord;
  reused: boolean;
};

export type PaymongoPaymentReferenceRecord = {
  id: string;
  memberId: string | null;
  memberUserId: string | null;
  submittedBy: string | null;
  payerName: string | null;
  payerEmail: string | null;
  payerContact: string | null;
  provider: string;
  referenceNumber: string;
  paymentPurpose: string;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  amount: number;
  validationStatus: ValidationStatus;
  paymentChannel: PaymongoPaymentChannel;
  gatewayEnvironment: PaymongoGatewayEnvironment;
  gatewayCheckoutId: string | null;
  gatewayPaymentId: string | null;
  gatewayPaymentIntentId: string | null;
  gatewayStatus: string | null;
  idempotencyKey: string | null;
  paidAt: Date | null;
};

export type PaymongoMembershipApplicationRecord = {
  id: string;
  applicationCode: string;
  publicTrackingTokenHash: string;
  requestedMembershipType: "Associate" | "True Member";
  fullName: string;
  email: string | null;
  contactNumber: string;
  applicationStatus: string;
};

export type PaymongoMembershipSettings = {
  associateFee: number;
  initialShareCapital: number;
  trueMemberRequiredCapital: number;
  maximumShareCapital: number;
};

export type PaymongoMembershipCheckoutPurpose =
  | "Associate Membership Fee"
  | "Share Capital";

export type PaymongoMembershipCheckoutInput = {
  paymentPurpose: PaymongoMembershipCheckoutPurpose;
  requestedAmount?: number;
};

export type PaymongoCheckoutResult = {
  paymentReferenceId: string;
  referenceNumber: string;
  checkoutId: string;
  checkoutUrl: string;
  gatewayStatus: string | null;
  validationStatus: ValidationStatus;
  amount: number;
  currency: "PHP";
  mode: PaymongoMode;
  attemptNumber: number;
  reused: boolean;
};

export type PaymongoPublicCheckoutResult = {
  referenceNumber: string;
  checkoutUrl: string;
  gatewayStatus: string | null;
  paymentPurpose: PaymongoMembershipCheckoutPurpose;
  amount: number;
  currency: "PHP";
  mode: PaymongoMode;
  status: "Waiting" | "Confirmed";
  attemptNumber: number;
  reused: boolean;
};

export type PaymongoPaymentStatus = {
  paymentReferenceId: string;
  referenceNumber: string;
  validationStatus: ValidationStatus;
  paymentChannel: PaymongoPaymentChannel;
  gatewayEnvironment: PaymongoGatewayEnvironment;
  gatewayCheckoutId: string | null;
  gatewayPaymentId: string | null;
  gatewayPaymentIntentId: string | null;
  gatewayStatus: string | null;
  paidAt: Date | null;
  amount: number;
  currency: "PHP";
  checkoutAttemptNumber: number | null;
  gatewayLastCheckedAt: Date | null;
};

export type PaymongoCheckoutActor = AuthContext;
