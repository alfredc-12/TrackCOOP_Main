import { AppError } from "../../utils/app-error";
import type { AuthContext } from "../auth/auth.types";
import {
  createMembershipRepository,
  type MembershipRepository,
} from "./membership.repository";
import type {
  AccountCreationInput,
  ApplicationStatus,
  MembershipApplicationInput,
  ReviewAction,
  UploadedApplicationDocument,
} from "./membership.types";

export interface MembershipService {
  submitApplication(
    input: MembershipApplicationInput,
    documents: UploadedApplicationDocument[],
  ): ReturnType<MembershipRepository["submit"]>;
  lookupApplication(
    reference: string,
    contactNumber: string,
  ): ReturnType<MembershipRepository["lookup"]>;
  submitAdditionalInformation(
    reference: string,
    contactNumber: string,
    information: string,
    documents: UploadedApplicationDocument[],
  ): ReturnType<MembershipRepository["submitAdditionalInformation"]>;
  listApplications(
    status?: ApplicationStatus,
    search?: string,
  ): ReturnType<MembershipRepository["list"]>;
  getApplication(id: string): ReturnType<MembershipRepository["detail"]>;
  getApplicationDocument: MembershipRepository["getApplicationDocument"];
  reviewApplication(
    id: string,
    input: ReviewAction,
    auth: AuthContext,
  ): ReturnType<MembershipRepository["review"]>;
  submitPayment: MembershipRepository["submitPayment"];
  listPayments: MembershipRepository["listPayments"];
  getPaymentProof: MembershipRepository["getPaymentProof"];
  validatePayment: MembershipRepository["validatePayment"];
  createAccount(
    applicationId: string,
    input: AccountCreationInput,
    auth: AuthContext,
  ): ReturnType<MembershipRepository["createAccount"]>;
  activateAccount(token: string, password: string): Promise<void>;
}

export function createMembershipService(
  repository: MembershipRepository = createMembershipRepository(),
): MembershipService {
  return {
    submitApplication(input, documents) {
      return repository.submit(input, documents);
    },
    lookupApplication(reference, contactNumber) {
      return repository.lookup(reference, contactNumber);
    },
    submitAdditionalInformation(
      reference,
      contactNumber,
      information,
      documents,
    ) {
      return repository.submitAdditionalInformation(
        reference,
        contactNumber,
        information,
        documents,
      );
    },
    listApplications(status, search) {
      return repository.list(status, search);
    },
    async getApplication(id) {
      const application = await repository.detail(id);
      if (!application) {
        throw new AppError(
          "Membership application was not found",
          404,
          "APPLICATION_NOT_FOUND",
        );
      }
      return application;
    },
    getApplicationDocument(applicationId, documentId) {
      return repository.getApplicationDocument(applicationId, documentId);
    },
    reviewApplication(id, input, auth) {
      return repository.review(id, input, auth);
    },
    submitPayment(reference, contactNumber, payment) {
      return repository.submitPayment(reference, contactNumber, payment);
    },
    listPayments() {
      return repository.listPayments();
    },
    getPaymentProof(paymentId) {
      return repository.getPaymentProof(paymentId);
    },
    validatePayment(id, decision, note, auth) {
      return repository.validatePayment(id, decision, note, auth);
    },
    createAccount(applicationId, input, auth) {
      return repository.createAccount(applicationId, input, auth);
    },
    activateAccount(token, password) {
      return repository.activate(token, password);
    },
  };
}
