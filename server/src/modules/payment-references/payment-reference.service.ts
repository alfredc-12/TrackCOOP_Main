import { AppError } from "../../utils/app-error";
import type { AuthContext } from "../auth/auth.types";
import {
  createPaymentReferenceRepository,
  type PaymentReferenceRepository,
} from "./payment-reference.repository";
import type {
  PaymentReferenceInput,
  PaymentReferenceListQuery,
  ReviewPaymentReferenceInput,
  UpdatePaymentReferenceInput,
  ValidationStatus,
} from "./payment-reference.types";

export interface PaymentReferenceService {
  listPaymentReferences(query: PaymentReferenceListQuery): ReturnType<PaymentReferenceRepository["list"]>;
  getPaymentReference(id: string): ReturnType<PaymentReferenceRepository["findById"]>;
  createPaymentReference(input: PaymentReferenceInput, auth: AuthContext): ReturnType<PaymentReferenceRepository["create"]>;
  updatePaymentReference(id: string, input: UpdatePaymentReferenceInput, auth: AuthContext): ReturnType<PaymentReferenceRepository["update"]>;
  validatePaymentReference(id: string, input: ReviewPaymentReferenceInput, auth: AuthContext): ReturnType<PaymentReferenceRepository["setValidationStatus"]>;
  rejectPaymentReference(id: string, input: ReviewPaymentReferenceInput, auth: AuthContext): ReturnType<PaymentReferenceRepository["setValidationStatus"]>;
  requestClarification(id: string, input: ReviewPaymentReferenceInput, auth: AuthContext): ReturnType<PaymentReferenceRepository["setValidationStatus"]>;
}

export function createPaymentReferenceService(
  repository: PaymentReferenceRepository = createPaymentReferenceRepository(),
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
    getPaymentReference(id) {
      return repository.findById(id);
    },
    createPaymentReference(input, auth) {
      return repository.create(input, auth);
    },
    updatePaymentReference(id, input, auth) {
      return repository.update(id, input, auth);
    },
    validatePaymentReference(id, input, auth) {
      return transition(id, "Validated", input, auth);
    },
    rejectPaymentReference(id, input, auth) {
      return transition(id, "Rejected", input, auth);
    },
    requestClarification(id, input, auth) {
      return transition(id, "Needs Clarification", input, auth);
    },
  };
}
