import { apiRequest } from "@/lib/api-client";

export type MembershipDraft = {
  idempotencyKey: string;
  firstName: string;
  middleName: string;
  lastName: string;
  suffix: string;
  contactNumber: string;
  email: string;
  preferredContactMethod: "Phone" | "SMS" | "Email";
  completeAddress: string;
  barangay: string;
  municipality: string;
  province: string;
  sector: string;
  livelihood: string;
  applicantClassification: "Farmer" | "Fisherfolk" | "Both" | "Other";
  primaryActivity: string;
  preferredMembershipType: "ASSOCIATE" | "TRUE_MEMBER" | "NOT_SURE";
  consentAccuracy: boolean;
  consentPrivacy: boolean;
  consentNoImmediateMembership: boolean;
  consentAccountAfterApproval: boolean;
  privacyNoticeVersion: string;
};

export type MembershipApplication = MembershipDraft & {
  id: string;
  reference: string;
  fullName: string;
  status: string;
  paymentStatus: string;
  approvedMembershipType: string | null;
  requiredPaymentType: string | null;
  requiredPaymentAmount: string | null;
  possibleDuplicate: number;
  submittedAt: string;
  updatedAt: string;
  publicResponse: string | null;
};

export type PublicApplicationStatus = {
  reference: string;
  applicantName: string;
  submittedAt: string;
  status: string;
  preferredMembershipType: string;
  approvedMembershipType: string | null;
  publicResponse: string | null;
  paymentStatus: string;
  requiredPaymentType: string | null;
  requiredPaymentAmount: string | null;
  updatedAt: string;
};

export type MembershipPayment = {
  id: string;
  applicationId: string;
  applicationReference: string;
  applicantName: string;
  approvedMembershipType: string;
  paymentReferenceId: string;
  referenceNumber: string;
  provider: string;
  amount: string;
  paymentStatus: string;
  submittedAt: string;
  receiptNumber: string | null;
};

export async function submitMembershipApplication(
  draft: MembershipDraft,
  files: File[],
  documentTypes: string[],
) {
  const body = new FormData();
  body.set("payload", JSON.stringify(draft));
  body.set("documentTypes", JSON.stringify(documentTypes));
  files.forEach((file) => body.append("documents", file));
  return apiRequest<MembershipApplication>(
    "/api/public/membership/applications",
    {
      method: "POST",
      body,
    },
  );
}

export function lookupMembershipApplication(
  reference: string,
  contactNumber: string,
) {
  return apiRequest<PublicApplicationStatus>(
    "/api/public/membership/application-status",
    {
      method: "POST",
      body: JSON.stringify({ reference, contactNumber }),
    },
  );
}

export async function submitAdditionalInformation(
  reference: string,
  contactNumber: string,
  information: string,
  files: File[],
) {
  const body = new FormData();
  body.set(
    "payload",
    JSON.stringify({ reference, contactNumber, information }),
  );
  body.set(
    "documentTypes",
    JSON.stringify(files.map(() => "Requested document")),
  );
  files.forEach((file) => body.append("documents", file));
  return apiRequest<MembershipApplication>(
    "/api/public/membership/applications/additional-information",
    { method: "POST", body },
  );
}

export async function submitMembershipPayment(input: {
  reference: string;
  contactNumber: string;
  provider: string;
  referenceNumber: string;
  amount: number;
  notes: string;
  proof: File;
}) {
  const body = new FormData();
  body.set("reference", input.reference);
  body.set("contactNumber", input.contactNumber);
  body.set("provider", input.provider);
  body.set("referenceNumber", input.referenceNumber);
  body.set("amount", String(input.amount));
  body.set("notes", input.notes);
  body.set("proof", input.proof);
  return apiRequest<MembershipPayment>("/api/public/membership/payments", {
    method: "POST",
    body,
  });
}

export function listMembershipApplications(status?: string, search?: string) {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (search) params.set("search", search);
  return apiRequest<MembershipApplication[]>(
    `/api/membership/applications${params.size ? `?${params}` : ""}`,
  );
}

export function getMembershipApplication(id: string) {
  return apiRequest<
    MembershipApplication & {
      documents: Array<Record<string, unknown>>;
      history: Array<Record<string, unknown>>;
      notes: Array<Record<string, unknown>>;
    }
  >(`/api/membership/applications/${id}`);
}

export function reviewMembershipApplication(
  id: string,
  payload: Record<string, unknown>,
) {
  return apiRequest<MembershipApplication>(
    `/api/membership/applications/${id}/review`,
    { method: "POST", body: JSON.stringify(payload) },
  );
}

export function createMembershipAccount(id: string, overrideReason: string) {
  return apiRequest<{
    application: MembershipApplication;
    activationToken: string;
    expiresAt: string;
  }>(`/api/membership/applications/${id}/account`, {
    method: "POST",
    body: JSON.stringify({
      duplicateResolution: "CONFIRM_NEW",
      overrideReason,
    }),
  });
}

export function listMembershipPayments() {
  return apiRequest<MembershipPayment[]>("/api/membership/payments");
}

export function validateMembershipPayment(
  id: string,
  decision: "VERIFIED" | "REJECTED" | "NEEDS_CLARIFICATION",
  note: string,
) {
  return apiRequest<MembershipPayment>(
    `/api/membership/payments/${id}/validate`,
    {
      method: "POST",
      body: JSON.stringify({ decision, note }),
    },
  );
}

export function activateMembershipAccount(token: string, password: string) {
  return apiRequest<{ activated: true }>("/api/public/membership/activate", {
    method: "POST",
    body: JSON.stringify({ token, password }),
  });
}
