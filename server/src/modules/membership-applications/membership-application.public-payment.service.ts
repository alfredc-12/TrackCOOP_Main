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
  requireApplicationBirthDateCredential,
  verifyApplicationBirthDate,
} from "./public-tracking-token";

export interface PublicMembershipPaymentService {
  getSummary(
    applicationCode: string,
    rawDateOfBirth: string | undefined,
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
    async getSummary(applicationCode, rawDateOfBirth) {
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

      const dateOfBirth = requireApplicationBirthDateCredential(rawDateOfBirth);
      if (!verifyApplicationBirthDate(application.dateOfBirth, dateOfBirth)) {
        throw new AppError(
          "Applicant date of birth does not match this application",
          403,
          "APPLICATION_BIRTH_DATE_INVALID",
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
