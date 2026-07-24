import { apiRequest } from "@/lib/api-client";
import type {
  MembershipDocumentType,
  PublicApplicationStatus,
  PublicMembershipApplicationInput,
  PublicSubmissionResult,
} from "./membership-application-types";

export function submitMembershipApplication(input: PublicMembershipApplicationInput) {
  return apiRequest<PublicSubmissionResult>("/api/membership-applications/public", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function uploadMembershipApplicationDocument(input: {
  applicationCode: string;
  trackingToken: string;
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
        "X-Application-Tracking-Token": input.trackingToken,
      },
      body: formData,
    },
  );
}

export function getMembershipApplicationStatus(input: {
  applicationCode: string;
  trackingToken: string;
}) {
  return apiRequest<PublicApplicationStatus>(
    `/api/membership-applications/public/${encodeURIComponent(input.applicationCode)}/status`,
    {
      headers: {
        "X-Application-Tracking-Token": input.trackingToken,
      },
      cache: "no-store",
    },
  );
}
