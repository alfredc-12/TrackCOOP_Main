import type {
  PublicApplicationStatus,
  PublicPaymentRequirement,
} from "./membership-application-types";

export type PublicMembershipPaymentState =
  | "Not Required"
  | "Required"
  | "Pending"
  | "Confirmed"
  | "Unavailable";

export type PublicMembershipPaymentStatus = PublicApplicationStatus & {
  paymongoMode: "test" | "live";
  membershipFee: {
    requiredAmount: number;
    validatedAmount: number;
    pendingAmount: number;
    remainingAmount: number;
    status: PublicMembershipPaymentState;
    canStartCheckout: boolean;
  };
  shareCapital: {
    validatedAmount: number;
    pendingAmount: number;
    targetAmount: number;
    maximumAmount: number;
    remainingToTarget: number;
    remainingToMaximum: number;
    installmentCount: number;
    minimumNextAmount: number;
    canStartCheckout: boolean;
  };
  latestCheckout: {
    paymentPurpose: "Associate Membership Fee" | "Share Capital";
    referenceNumber: string;
    amount: number;
    gatewayStatus: string;
    createdAt: string;
    reusableUntil: string;
    isReusable: boolean;
  } | null;
  paymentRequirements: PublicPaymentRequirement[];
};
