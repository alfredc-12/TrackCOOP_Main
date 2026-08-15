import { apiRequest } from "@/lib/api-client";
import { env } from "@/config/env";
import { ApiClientError } from "@/lib/api-client";
import type {
  ApprovalInput,
  ApprovalResult,
  BeneficiaryInput,
  ChairmanApplicationDetail,
  ChairmanApplicationListQuery,
  ChairmanApplicationListResult,
  ChairmanApplicationSummary,
  ChairmanMembershipApplicationInput,
  ChairmanMembershipApplicationUpdateInput,
  MembershipDocumentType,
  PublicApplicationStatus,
  PublicMembershipApplicationInput,
  PublicPaymongoCheckoutInput,
  PublicPaymongoCheckoutResult,
  PublicSubmissionResult,
  RequirementInput,
  RequirementUpdateInput,
  StatusTransitionInput,
} from "./membership-application-types";

type ApiSuccess<T> = {
  success: true;
  data: T;
  message: string;
  meta: Record<string, unknown>;
};

type ApiFailure = {
  success: false;
  message: string;
  errors: Array<{ code?: string; field?: string; message: string }>;
};

async function apiRequestWithMeta<T>(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  let response: Response;
  try {
    response = await fetch(`${env.apiUrl}${path}`, {
      ...init,
      credentials: "include",
      headers,
    });
  } catch {
    throw new ApiClientError(
      "TrackCOOP could not reach the server. Please try again.",
      0,
    );
  }

  const payload = (await response.json().catch(() => null)) as
    | ApiSuccess<T>
    | ApiFailure
    | null;

  if (!response.ok || !payload?.success) {
    const failure = payload && !payload.success ? payload : null;
    throw new ApiClientError(
      failure?.message ?? "The request could not be completed",
      response.status,
      failure?.errors,
    );
  }

  return { data: payload.data, meta: payload.meta };
}

export function submitMembershipApplication(input: PublicMembershipApplicationInput) {
  return apiRequest<PublicSubmissionResult>("/api/membership-applications/public", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function uploadMembershipApplicationDocument(input: {
  applicationCode: string;
  dateOfBirth: string;
  documentType: MembershipDocumentType;
  file: File;
}) {
  const formData = new FormData();
  formData.append("documentType", input.documentType);
  formData.append("document", input.file);

  return apiRequest(
    `/api/membership-applications/public/${encodeURIComponent(input.applicationCode)}/documents`,
    {
      method: "POST",
      headers: {
        "X-Application-Date-Of-Birth": input.dateOfBirth,
      },
      body: formData,
    },
  );
}

export function getMembershipApplicationStatus(input: {
  applicationCode: string;
  dateOfBirth: string;
}) {
  return apiRequest<PublicApplicationStatus>(
    `/api/membership-applications/public/${encodeURIComponent(input.applicationCode)}/status`,
    {
      headers: {
        "X-Application-Date-Of-Birth": input.dateOfBirth,
      },
      cache: "no-store",
    },
  );
}

export function createMembershipApplicationPaymongoCheckout(
  input: PublicPaymongoCheckoutInput,
) {
  const body =
    input.paymentPurpose === "Share Capital"
      ? {
          paymentPurpose: input.paymentPurpose,
          requestedAmount: input.requestedAmount,
        }
      : { paymentPurpose: input.paymentPurpose };

  return apiRequest<PublicPaymongoCheckoutResult>(
    `/api/paymongo/checkouts/membership-applications/${encodeURIComponent(input.applicationCode)}`,
    {
      method: "POST",
      headers: {
        "X-Application-Date-Of-Birth": input.dateOfBirth,
      },
      body: JSON.stringify(body),
    },
  );
}

export function getChairmanApplicationSummary() {
  return apiRequest<ChairmanApplicationSummary>("/api/membership-applications/summary");
}

export async function listChairmanApplications(query: ChairmanApplicationListQuery) {
  const params = new URLSearchParams({
    page: String(query.page),
    pageSize: String(query.pageSize),
    sortBy: query.sortBy,
    sortDirection: query.sortDirection,
  });

  if (query.search?.trim()) params.set("search", query.search.trim());
  if (query.status && query.status !== "All") params.set("status", query.status);
  if (query.requestedMembershipType && query.requestedMembershipType !== "All") {
    params.set("requestedMembershipType", query.requestedMembershipType);
  }
  if (query.applicationSource && query.applicationSource !== "All") {
    params.set("applicationSource", query.applicationSource);
  }
  if (query.barangay?.trim()) params.set("barangay", query.barangay.trim());

  const response = await apiRequestWithMeta<ChairmanApplicationListResult["applications"]>(
    `/api/membership-applications?${params.toString()}`,
  );

  return {
    applications: response.data,
    total: Number(response.meta.total ?? response.data.length),
    page: Number(response.meta.page ?? query.page),
    pageSize: Number(response.meta.pageSize ?? query.pageSize),
  };
}

export function getChairmanApplication(id: string) {
  return apiRequest<ChairmanApplicationDetail>(`/api/membership-applications/${id}`);
}

export function createChairmanApplication(input: ChairmanMembershipApplicationInput) {
  return apiRequest<ChairmanApplicationDetail>("/api/membership-applications", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateChairmanApplication(
  id: string,
  input: ChairmanMembershipApplicationUpdateInput,
) {
  return apiRequest<ChairmanApplicationDetail>(`/api/membership-applications/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function addApplicationBeneficiary(
  applicationId: string,
  input: BeneficiaryInput & { displayOrder?: number },
) {
  return apiRequest(`/api/membership-applications/${applicationId}/beneficiaries`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateApplicationBeneficiary(
  beneficiaryId: string,
  input: Partial<BeneficiaryInput> & { displayOrder?: number },
) {
  return apiRequest(`/api/membership-application-beneficiaries/${beneficiaryId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteApplicationBeneficiary(beneficiaryId: string) {
  return apiRequest(`/api/membership-application-beneficiaries/${beneficiaryId}`, {
    method: "DELETE",
  });
}

export function uploadChairmanApplicationDocument(input: {
  applicationId: string;
  documentType: MembershipDocumentType;
  file: File;
}) {
  const formData = new FormData();
  formData.append("documentType", input.documentType);
  formData.append("document", input.file);

  return apiRequest(`/api/membership-applications/${input.applicationId}/documents`, {
    method: "POST",
    body: formData,
  });
}

export function deleteApplicationDocument(documentId: string) {
  return apiRequest(`/api/membership-application-documents/${documentId}`, {
    method: "DELETE",
  });
}

export function addApplicationRequirement(applicationId: string, input: RequirementInput) {
  return apiRequest(`/api/membership-applications/${applicationId}/requirements`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateApplicationRequirement(
  requirementId: string,
  input: RequirementUpdateInput,
) {
  return apiRequest(`/api/membership-application-requirements/${requirementId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function transitionApplication(
  applicationId: string,
  action:
    | "start-review"
    | "request-information"
    | "reject"
    | "withdraw",
  input: StatusTransitionInput,
) {
  return apiRequest<ChairmanApplicationDetail>(
    `/api/membership-applications/${applicationId}/${action}`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export function approveApplication(applicationId: string, input: ApprovalInput) {
  return apiRequest<ApprovalResult>(
    `/api/membership-applications/${applicationId}/approve`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export async function downloadApplicationPdf(applicationId: string) {
  const response = await fetch(`${env.apiUrl}/api/membership-applications/${applicationId}/print`, {
    credentials: "include",
  });

  if (!response.ok) {
    throw new ApiClientError("Printable PDF could not be generated.", response.status);
  }

  return response.blob();
}
