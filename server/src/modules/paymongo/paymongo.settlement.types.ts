import type { RowDataPacket } from "mysql2/promise";
import type { ApplicationCapitalValidationStatus } from "../membership-applications/membership-application.capital";

export type PaymentValidationSource = "Manual Bookkeeper" | "PayMongo Webhook";
export type GatewaySettlementDetails = {
  checkoutId?: string | null;
  paymentId?: string | null;
  paymentIntentId?: string | null;
  gatewayStatus?: string | null;
  paymentMethod?: string | null;
  amount: number;
  currency: "PHP";
  feeAmount?: number | null;
  netAmount?: number | null;
  paidAt?: Date | null;
  environment?: "Test" | "Live";
};
export type SettlePaymentReferenceInput = {
  paymentReferenceId: string;
  validationSource: PaymentValidationSource;
  actorUserId: string | null;
  gatewayEventId?: string | null;
  gatewayDetails?: GatewaySettlementDetails | null;
};
export type SettlementResult = {
  paymentReferenceId: string;
  alreadySettled: boolean;
  validationStatus: "Validated";
};
export type PaymentReferenceForSettlement = RowDataPacket & {
  id: string;
  memberId: string | null;
  payerName: string | null;
  referenceNumber: string;
  paymentPurpose: string;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  amount: string | number;
  validationStatus: ApplicationCapitalValidationStatus;
  paymentChannel: string;
  gatewayEnvironment: "Test" | "Live" | "Manual";
  gatewayCheckoutId: string | null;
  gatewayPaymentId: string | null;
  gatewayPaymentIntentId: string | null;
};
export type MembershipApplicationSettlementRow = RowDataPacket & {
  id: string;
  applicationCode: string;
  applicationStatus: string;
  requestedMembershipType: "Associate" | "True Member";
  convertedMemberId: string | null;
  memberUserId: string | null;
  fullName: string;
};
export type RequirementSettlementRow = RowDataPacket & {
  id: string;
  requirementStatus: "Pending" | "Submitted" | "Verified" | "Rejected" | "Waived";
};
