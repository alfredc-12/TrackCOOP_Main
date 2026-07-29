import type { AuthContext } from "../auth/auth.types";
import {
  createPaymongoGatewayRecoveryService,
  type PaymongoGatewayRecoveryService,
} from "../paymongo/paymongo.gateway-recovery";
import {
  createPaymentValidationRepository,
  requirePaymentValidationDetail,
  type PaymentValidationRepository,
} from "./payment-validation.repository";
import type { PaymentReferenceListQuery } from "./payment-reference.types";

export interface PaymentValidationService {
  list(query: PaymentReferenceListQuery): ReturnType<PaymentValidationRepository["list"]>;
  detail(paymentReferenceId: string): ReturnType<typeof requirePaymentValidationDetail>;
  retryGatewayEvent(input: {
    gatewayEventId: string;
    note: string;
    auth: AuthContext;
  }): ReturnType<PaymongoGatewayRecoveryService["retryFailedEvent"]>;
}

export function createPaymentValidationService(
  repository: PaymentValidationRepository = createPaymentValidationRepository(),
  gatewayRecovery: PaymongoGatewayRecoveryService = createPaymongoGatewayRecoveryService(),
): PaymentValidationService {
  return {
    list: (query) => repository.list(query),
    detail: (paymentReferenceId) => requirePaymentValidationDetail(repository, paymentReferenceId),
    retryGatewayEvent: (input) => gatewayRecovery.retryFailedEvent(input),
  };
}
