import { AppError } from "../../utils/app-error";
import type { AuthContext } from "../auth/auth.types";
import {
  createPaymentSettlementService,
  type PaymentSettlementService,
} from "../paymongo/paymongo.settlement";
import {
  createPaymentReferenceRepository,
  type PaymentReferenceRepository,
} from "./payment-reference.repository";
import type {
  PaymentReferenceInput,
  PaymentReferenceListQuery,
  ReviewPaymentReferenceInput,
  ReversePaymentReferenceInput,
  UpdatePaymentReferenceInput,
  ValidationStatus,
} from "./payment-reference.types";

export interface PaymentReferenceService {
  listPaymentReferences(query: PaymentReferenceListQuery): ReturnType<PaymentReferenceRepository["list"]>;
  getPaymentReferenceSummary(): ReturnType<PaymentReferenceRepository["summary"]>;
  getPaymentReference(id: string): ReturnType<PaymentReferenceRepository["findById"]>;
  getPaymentReferenceDetail(id: string): ReturnType<PaymentReferenceRepository["detail"]>;
  getPaymentReferenceProof(id: string): Promise<{ filePath: string; fileName: string; mimeType: string } | null>;
  createPaymentReference(input: PaymentReferenceInput, auth: AuthContext): ReturnType<PaymentReferenceRepository["create"]>;
  updatePaymentReference(id: string, input: UpdatePaymentReferenceInput, auth: AuthContext): ReturnType<PaymentReferenceRepository["update"]>;
  validatePaymentReference(id: string, input: ReviewPaymentReferenceInput, auth: AuthContext): ReturnType<PaymentReferenceRepository["setValidationStatus"]>;
  rejectPaymentReference(id: string, input: ReviewPaymentReferenceInput, auth: AuthContext): ReturnType<PaymentReferenceRepository["setValidationStatus"]>;
  requestClarification(id: string, input: ReviewPaymentReferenceInput, auth: AuthContext): ReturnType<PaymentReferenceRepository["setValidationStatus"]>;
  reversePaymentReference(id: string, input: ReversePaymentReferenceInput, auth: AuthContext): ReturnType<PaymentReferenceRepository["reverse"]>;
}

export function createPaymentReferenceService(
  repository: PaymentReferenceRepository = createPaymentReferenceRepository(),
  settlementService: PaymentSettlementService = createPaymentSettlementService(),
): PaymentReferenceService {
  async function transition(
    id: string,
    status: ValidationStatus,
    input: ReviewPaymentReferenceInput,
    auth: AuthContext,
  ) {
    const existing = await repository.findById(id);
    if (!existing) {
      throw new AppError("Payment reference was not found", 404, "PAYMENT_REFERENCE_NOT_FOUND");
    }
    if (existing.validationStatus === status) {
      throw new AppError(
        "Payment reference is already in that status",
        400,
        "PAYMENT_REFERENCE_STATUS_UNCHANGED",
      );
    }
    if (status !== "Validated" && !input.reason?.trim()) {
      throw new AppError(
        "A reason is required for rejected or clarification statuses",
        400,
        "PAYMENT_REVIEW_REASON_REQUIRED",
      );
    }
    return repository.setValidationStatus(id, status, input, auth);
  }

  return {
    listPaymentReferences(query) {
      return repository.list(query);
    },
    getPaymentReferenceSummary() {
      return repository.summary();
    },
    getPaymentReference(id) {
      return repository.findById(id);
    },
    getPaymentReferenceDetail(id) {
      return repository.detail(id);
    },
    async getPaymentReferenceProof(id) {
      const payment = await repository.findById(id);
      if (!payment) {
        throw new AppError("Payment reference was not found", 404, "PAYMENT_REFERENCE_NOT_FOUND");
      }
      if (!payment.proofFilePath) return null;
      const extension = payment.proofFilePath.toLowerCase().endsWith(".pdf")
        ? "pdf"
        : payment.proofFilePath.toLowerCase().endsWith(".png")
          ? "png"
          : "jpg";
      return {
        filePath: payment.proofFilePath,
        fileName: `${payment.referenceNumber}.${extension}`,
        mimeType: extension === "pdf"
          ? "application/pdf"
          : extension === "png"
            ? "image/png"
            : "image/jpeg",
      };
    },
    createPaymentReference(input, auth) {
      return repository.create(input, auth);
    },
    updatePaymentReference(id, input, auth) {
      return repository.update(id, input, auth);
    },
    validatePaymentReference(id, input, auth) {
      return (async () => {
        const existing = await repository.findById(id);
        if (!existing) {
          throw new AppError("Payment reference was not found", 404, "PAYMENT_REFERENCE_NOT_FOUND");
        }
        if (existing.validationStatus === "Validated") {
          throw new AppError(
            "Payment reference is already in that status",
            400,
            "PAYMENT_REFERENCE_STATUS_UNCHANGED",
          );
        }
        await settlementService.settlePaymentReference({
          paymentReferenceId: id,
          validationSource: "Manual Bookkeeper",
          actorUserId: auth.user.id,
          gatewayEventId: null,
          gatewayDetails: null,
        });
        const updated = await repository.findById(id);
        if (!updated) {
          throw new AppError("Payment reference was not found", 404, "PAYMENT_REFERENCE_NOT_FOUND");
        }
        return updated;
      })();
    },
    rejectPaymentReference(id, input, auth) {
      return transition(id, "Rejected", input, auth);
    },
    requestClarification(id, input, auth) {
      return transition(id, "Needs Clarification", input, auth);
    },
    reversePaymentReference(id, input, auth) {
      return repository.reverse(id, input, auth);
    },
  };
}
