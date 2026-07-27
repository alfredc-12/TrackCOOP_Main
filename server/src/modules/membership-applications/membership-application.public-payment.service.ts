import { AppError } from "../../utils/app-error";
import {
  createPaymongoConfigFromEnv,
} from "../paymongo/paymongo.client";
import {
  createPaymongoMembershipInstallmentRepository,
  type PaymongoMembershipInstallmentRepository,
  type PublicMembershipPaymentSummary,
} from "../paymongo/paymongo.membership-installment.repository";
import {
  createPaymongoRepository,
  type PaymongoRepository,
} from "../paymongo/paymongo.repository";
import type { PaymongoConfig } from "../paymongo/paymongo.types";
import {
  requireApplicationTrackingToken,
  verifyApplicationTrackingToken,
} from "./public-tracking-token";

export interface PublicMembershipPaymentService {
  getSummary(
    applicationCode: string,
    rawTrackingToken: string | undefined,
  ): Promise<PublicMembershipPaymentSummary>;
}

export function createPublicMembershipPaymentService(options: {
  config?: PaymongoConfig;
  paymongoRepository?: PaymongoRepository;
  installmentRepository?: PaymongoMembershipInstallmentRepository;
} = {}): PublicMembershipPaymentService {
  const config = options.config ?? createPaymongoConfigFromEnv();
  const paymongoRepository = options.paymongoRepository ?? createPaymongoRepository();
  const installmentRepository = options.installmentRepository
    ?? createPaymongoMembershipInstallmentRepository();

  return {
    async getSummary(applicationCode, rawTrackingToken) {
      const application = await paymongoRepository.findMembershipApplicationByCode(
        applicationCode,
      );
      if (!application) {
        throw new AppError(
          "Membership application was not found",
          404,
          "MEMBERSHIP_APPLICATION_NOT_FOUND",
        );
      }

      const trackingToken = requireApplicationTrackingToken(rawTrackingToken);
      if (!verifyApplicationTrackingToken(
        application.publicTrackingTokenHash,
        trackingToken,
      )) {
        throw new AppError(
          "Application tracking token is invalid",
          403,
          "APPLICATION_TRACKING_TOKEN_INVALID",
        );
      }

      const settings = await paymongoRepository.getMembershipPaymentSettings();
      return installmentRepository.publicPaymentSummary({
        application,
        settings,
        environment: config.mode === "live" ? "Live" : "Test",
        gatewayEnabled: config.enabled,
        mode: config.mode,
      });
    },
  };
}
