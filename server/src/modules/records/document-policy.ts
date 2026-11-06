import type { Role } from "./records-types";
import type { DocumentAccessLevel } from "./records-types";

export type DocumentPolicyActor = {
  role: Role;
  userId: number;
  memberId?: string | number | null;
};

export type DocumentPolicyRecord = {
  accessLevel: DocumentAccessLevel;
  category: string;
  documentType: string;
  memberId?: string | number | null;
};

const bookkeeperCategoryNames = [
  "FINANCIAL",
  "RECEIPT",
  "RENTAL",
  "POS_AND_SALES",
  "INVENTORY",
] as const;
const bookkeeperCategories = new Set<string>(bookkeeperCategoryNames);

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
    memberIdentity(actor.memberId) !== null &&
    memberIdentity(actor.memberId) === memberIdentity(document.memberId)
  );
}

// Keep BIGINT owner identities exact; missing or malformed ownership never grants access.
function memberIdentity(value: DocumentPolicyRecord["memberId"]): string | null {
  if (typeof value === "number") {
    return Number.isSafeInteger(value) && value > 0 ? String(value) : null;
  }
  return typeof value === "string" && /^[1-9]\d*$/.test(value) ? value : null;
}

/** SQL projection of the same read policy, shared by lists, counts, facets and exports. */
export function documentVisibilitySql(actor: DocumentPolicyActor | null): {
  sql: string;
  values: string[];
} {
  if (actor?.role === "chairman") return { sql: "1 = 1", values: [] };
  if (actor?.role === "bookkeeper") {
    return {
      sql: `(d.access_level IN ('Public', 'Bookkeeper-only')
             OR (d.access_level <> 'Admin-only' AND (
               d.category IN (${bookkeeperCategoryNames.map((category) => `'${category}'`).join(",")})
               OR d.document_type IN ('Receipt','Financial Document')
             )))`,
      values: [],
    };
  }
  const owner = actor?.role === "member" ? memberIdentity(actor.memberId) : null;
  if (owner !== null) {
    return {
      // No approved cooperative-shared designation exists in this schema.
      sql: "(d.access_level = 'Public' OR (d.access_level = 'Member-only' AND d.member_id = CAST(? AS UNSIGNED)))",
      values: [owner],
    };
  }
  return { sql: "d.access_level = 'Public'", values: [] };
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
