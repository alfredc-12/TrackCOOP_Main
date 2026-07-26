"use client";

import {
  DOCUMENT_ACCESS_LEVELS,
  DOCUMENT_CATEGORIES,
  DOCUMENT_TYPES,
  RELATED_MODULES,
  humanizeConstant,
} from "../record-constants";
import type { DocumentAccessLevel } from "../records-types";
import { Field, fieldClass } from "./RecordsUi";

export function DocumentMetadataFields({
  role,
  includeFile,
  defaults,
}: {
  role: "chairman" | "bookkeeper";
  includeFile?: boolean;
  defaults?: {
    title?: string;
    description?: string | null;
    category?: string;
    documentType?: string;
    accessLevel?: DocumentAccessLevel;
    relatedModule?: string | null;
    relatedRecordId?: string | null;
    relatedRecordReference?: string | null;
    relationshipType?: string | null;
    memberId?: string | null;
    documentDate?: string | null;
    expirationDate?: string | null;
    tags?: string | null;
    internalNote?: string | null;
  };
}) {
  const categories =
    role === "bookkeeper"
      ? DOCUMENT_CATEGORIES.filter((item) =>
          [
            "FINANCIAL",
            "RECEIPT",
            "RENTAL",
            "POS_AND_SALES",
            "INVENTORY",
            "AUDIT",
            "OTHER",
          ].includes(item),
        )
      : DOCUMENT_CATEGORIES;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Document title" required wide>
        <input
          name="title"
          required
          maxLength={255}
          defaultValue={defaults?.title ?? ""}
          className={fieldClass}
        />
      </Field>
      <Field label="Description" wide>
        <textarea
          name="description"
          rows={3}
          maxLength={5000}
          defaultValue={defaults?.description ?? ""}
          className={`${fieldClass} py-3`}
        />
      </Field>
      <Field label="Category" required>
        <select
          name="category"
          required
          defaultValue={defaults?.category ?? ""}
          className={fieldClass}
        >
          <option value="">Select category</option>
          {categories.map((item) => (
            <option key={item} value={item}>
              {humanizeConstant(item)}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Document type" required>
        <select
          name="documentType"
          required
          defaultValue={defaults?.documentType ?? ""}
          className={fieldClass}
        >
          <option value="">Select type</option>
          {DOCUMENT_TYPES.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </Field>
      <Field label="Access level" required>
        <select
          name="accessLevel"
          required
          defaultValue={defaults?.accessLevel ?? ""}
          className={fieldClass}
        >
          <option value="">Select access</option>
          {DOCUMENT_ACCESS_LEVELS.filter(
            (item) => role === "chairman" || item.value !== "ADMIN_ONLY",
          ).map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Related module">
        <select
          name="relatedModule"
          defaultValue={defaults?.relatedModule ?? ""}
          className={fieldClass}
        >
          <option value="">Not linked</option>
          {RELATED_MODULES.map((item) => (
            <option key={item} value={item}>
              {humanizeConstant(item)}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Related record ID">
        <input
          name="relatedRecordId"
          inputMode="numeric"
          pattern="[0-9]*"
          defaultValue={defaults?.relatedRecordId ?? ""}
          className={fieldClass}
        />
      </Field>
      <Field label="Related record reference">
        <input
          name="relatedRecordReference"
          maxLength={120}
          defaultValue={defaults?.relatedRecordReference ?? ""}
          className={fieldClass}
        />
      </Field>
      <Field label="Relationship type">
        <input
          name="relationshipType"
          placeholder="e.g. PAYMENT_PROOF"
          maxLength={80}
          defaultValue={defaults?.relationshipType ?? ""}
          className={fieldClass}
        />
      </Field>
      <Field
        label="Linked member ID"
        hint="Required for private member-owned receipts and certificates."
      >
        <input
          name="memberId"
          inputMode="numeric"
          pattern="[0-9]*"
          defaultValue={defaults?.memberId ?? ""}
          className={fieldClass}
        />
      </Field>
      <Field label="Document date">
        <input
          name="documentDate"
          type="date"
          defaultValue={defaults?.documentDate ?? ""}
          className={fieldClass}
        />
      </Field>
      <Field label="Expiration date">
        <input
          name="expirationDate"
          type="date"
          defaultValue={defaults?.expirationDate ?? ""}
          className={fieldClass}
        />
      </Field>
      <Field label="Tags or keywords" wide>
        <input
          name="tags"
          maxLength={1000}
          placeholder="Separate keywords with commas"
          defaultValue={defaults?.tags ?? ""}
          className={fieldClass}
        />
      </Field>
      <Field label="Internal note" wide>
        <textarea
          name="internalNote"
          rows={2}
          maxLength={5000}
          defaultValue={defaults?.internalNote ?? ""}
          className={`${fieldClass} py-3`}
        />
      </Field>
      {includeFile ? (
        <Field
          label="File"
          required
          wide
          hint="PDF, DOC, DOCX, XLS, XLSX, CSV, JPG, JPEG, or PNG; maximum 10 MB."
        >
          <input
            name="file"
            type="file"
            required
            accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.jpg,.jpeg,.png"
            className={`${fieldClass} py-2`}
          />
        </Field>
      ) : null}
    </div>
  );
}
