import type { Role } from "@/config/roles";
import type { DocumentAccessLevel } from "../records-types";

export type DocumentPolicyActor = {
  role: Role;
  userId: number;
  memberId?: number | null;
};

export type DocumentPolicyRecord = {
  accessLevel: DocumentAccessLevel;
  category: string;
  documentType: string;
  memberId?: number | null;
};

const bookkeeperCategories = new Set([
  "FINANCIAL",
  "RECEIPT",
  "RENTAL",
  "POS_AND_SALES",
  "INVENTORY",
]);

export function isFinancialDocument(document: DocumentPolicyRecord) {
  return (
    bookkeeperCategories.has(document.category) ||
    document.documentType === "Receipt" ||
    document.documentType === "Financial Document"
  );
}

export function canAccessDocument(
  actor: DocumentPolicyActor | null,
  document: DocumentPolicyRecord,
) {
  if (document.accessLevel === "PUBLIC") return true;
  if (!actor) return false;
  if (actor.role === "chairman") return true;
  if (actor.role === "bookkeeper") {
    if (document.accessLevel === "ADMIN_ONLY") return false;
    return (
      document.accessLevel === "BOOKKEEPER_ONLY" ||
      (document.accessLevel === "MEMBER_ONLY" &&
        isFinancialDocument(document)) ||
      isFinancialDocument(document)
    );
  }
  return (
    actor.role === "member" &&
    document.accessLevel === "MEMBER_ONLY" &&
    (document.memberId == null ||
      (Boolean(actor.memberId) && actor.memberId === document.memberId))
  );
}

export function canManageDocument(
  actor: DocumentPolicyActor,
  document: DocumentPolicyRecord,
) {
  if (actor.role === "chairman") return true;
  return (
    actor.role === "bookkeeper" &&
    document.accessLevel !== "ADMIN_ONLY" &&
    isFinancialDocument(document)
  );
}

export function canUploadDocument(
  actor: DocumentPolicyActor,
  document: DocumentPolicyRecord,
) {
  if (actor.role === "chairman") return true;
  return (
    actor.role === "bookkeeper" &&
    document.accessLevel !== "ADMIN_ONLY" &&
    isFinancialDocument(document)
  );
}
