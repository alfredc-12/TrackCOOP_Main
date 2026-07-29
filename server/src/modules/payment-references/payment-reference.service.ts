import { AppError } from "../../utils/app-error";
import type { AuthContext } from "../auth/auth.types";
import {
  createPaymentSettlementService,
  type PaymentSettlementService,
} from "../paymongo/paymongo.settlement";
import {
  createPaymentReceiptService,
  type PaymentReceiptService,
} from "../paymongo/paymongo.settlement.receipt";
import {
  createPaymentReferenceRepository,
  type PaymentReferenceRepository,
} from "./payment-reference.repository";
import {
  createPaymentReferenceReviewService,
  type PaymentReferenceReviewService,
} from "./payment-reference.review";
import {
  createPaymentReferenceReversalService,
  type PaymentReferenceReversalService,
} from "./payment-reference.reversal";
import type {
  PaymentReferenceInput,
  PaymentReferenceListQuery,
  ReviewPaymentReferenceInput,
  ReversePaymentReferenceInput,
  UpdatePaymentReferenceInput,
} from "./payment-reference.types";

export interface PaymentReferenceService {
  listPaymentReferences(query: PaymentReferenceListQuery): ReturnType<PaymentReferenceRepository["list"]>;
  getPaymentReferenceSummary(): ReturnType<PaymentReferenceRepository["summary"]>;
  getPaymentReference(id: string): ReturnType<PaymentReferenceRepository["findById"]>;
  getPaymentReferenceDetail(id: string): ReturnType<PaymentReferenceRepository["detail"]>;
  getPaymentReferenceProof(id: string): Promise<{ filePath: string; fileName: string; mimeType: string } | null>;
  getPaymentReceiptStatus(id: string): ReturnType<PaymentReceiptService["getStatus"]>;
  retryPaymentReceipt(id: string): ReturnType<PaymentReceiptService["process"]>;
  createPaymentReference(input: PaymentReferenceInput, auth: AuthContext): Promise<Awaited<ReturnType<PaymentReferenceRepository["create"]>>>;
  updatePaymentReference(id: string, input: UpdatePaymentReferenceInput, auth: AuthContext): ReturnType<PaymentReferenceRepository["update"]>;
  validatePaymentReference(id: string, input: ReviewPaymentReferenceInput, auth: AuthContext): Promise<Awaited<ReturnType<PaymentReferenceRepository["findById"]>>>;
  rejectPaymentReference(id: string, input: ReviewPaymentReferenceInput, auth: AuthContext): Promise<Awaited<ReturnType<PaymentReferenceRepository["findById"]>>>;
  requestClarification(id: string, input: ReviewPaymentReferenceInput, auth: AuthContext): Promise<Awaited<ReturnType<PaymentReferenceRepository["findById"]>>>;
  returnToPending(id: string, input: ReviewPaymentReferenceInput, auth: AuthContext): Promise<Awaited<ReturnType<PaymentReferenceRepository["findById"]>>>;
  reversePaymentReference(id: string, input: ReversePaymentReferenceInput, auth: AuthContext): ReturnType<PaymentReferenceRepository["detail"]>;
}

export function createPaymentReferenceService(
  repository: PaymentReferenceRepository = createPaymentReferenceRepository(),
  settlementService: PaymentSettlementService = createPaymentSettlementService(),
  reviewService: PaymentReferenceReviewService = createPaymentReferenceReviewService(),
  reversalService: PaymentReferenceReversalService = createPaymentReferenceReversalService(),
  receiptService: PaymentReceiptService = createPaymentReceiptService(),
): PaymentReferenceService {
  async function requireUpdated(id: string) {
    const updated = await repository.findById(id);
    if (!updated) throw new AppError("Payment reference was not found", 404, "PAYMENT_REFERENCE_NOT_FOUND");
    return updated;
  }
  async function review(
    id: string,
    newStatus: "Pending" | "Needs Clarification" | "Rejected",
    input: ReviewPaymentReferenceInput,
    auth: AuthContext,
  ) {
    await reviewService.transition({
      paymentReferenceId: id,
      newStatus,
      reason: input.reason ?? "",
      auth,
    });
    return requireUpdated(id);
  }

  return {
    listPaymentReferences: (query) => repository.list(query),
    getPaymentReferenceSummary: () => repository.summary(),
    getPaymentReference: (id) => repository.findById(id),
    getPaymentReferenceDetail: (id) => repository.detail(id),
    async getPaymentReferenceProof(id) {
      const payment = await repository.findById(id);
      if (!payment) throw new AppError("Payment reference was not found", 404, "PAYMENT_REFERENCE_NOT_FOUND");
      if (!payment.proofFilePath) return null;
      const extension = payment.proofFilePath.toLowerCase().endsWith(".pdf") ? "pdf"
        : payment.proofFilePath.toLowerCase().endsWith(".png") ? "png" : "jpg";
      return {
        filePath: payment.proofFilePath,
        fileName: `${payment.referenceNumber}.${extension}`,
        mimeType: extension === "pdf" ? "application/pdf" : extension === "png" ? "image/png" : "image/jpeg",
      };
    },
    getPaymentReceiptStatus: (id) => receiptService.getStatus(id),
    retryPaymentReceipt: (id) => receiptService.process(id),
    async createPaymentReference(input, auth) {
      const created = await repository.create(input, auth);
      await reviewService.ensureInitialPendingHistory(created.id, auth);
      return created;
    },
    updatePaymentReference: (id, input, auth) => repository.update(id, input, auth),
    async validatePaymentReference(id, _input, auth) {
      const existing = await repository.findById(id);
      if (!existing) throw new AppError("Payment reference was not found", 404, "PAYMENT_REFERENCE_NOT_FOUND");
      if (existing.validationStatus === "Validated") {
        throw new AppError("Payment reference is already in that status", 400, "PAYMENT_REFERENCE_STATUS_UNCHANGED");
      }
      await settlementService.settlePaymentReference({
        paymentReferenceId: id,
        validationSource: "Manual Bookkeeper",
        actorUserId: auth.user.id,
        gatewayEventId: null,
        gatewayDetails: null,
      });
      return requireUpdated(id);
    },
    rejectPaymentReference: (id, input, auth) => review(id, "Rejected", input, auth),
    requestClarification: (id, input, auth) => review(id, "Needs Clarification", input, auth),
    returnToPending: (id, input, auth) => review(id, "Pending", input, auth),
    async reversePaymentReference(id, input, auth) {
      await reversalService.reverse({
        paymentReferenceId: id,
        confirmation: input.confirmation,
        reason: input.reason,
        auth,
      });
      const reversed = await repository.detail(id);
      if (!reversed) throw new AppError("Payment reference was not found", 404, "PAYMENT_REFERENCE_NOT_FOUND");
      return reversed;
    },
  };
}
