"use client";

import {
  DOCUMENT_ACCESS_LEVELS,
  DOCUMENT_CATEGORIES,
  DOCUMENT_TYPES,
  humanizeConstant,
} from "../record-constants";
import type { DocumentAccessLevel } from "../records-types";
import { Field, fieldClass, errorFieldClass } from "./RecordsUi";

export function DocumentMetadataFields({
  role,
  includeFile,
  defaults,
  errors,
}: {
  role: "chairman" | "bookkeeper";
  includeFile?: boolean;
  defaults?: {
    title?: string;
    description?: string | null;
    category?: string;
    documentType?: string;
    accessLevel?: DocumentAccessLevel;
  };
  errors?: Record<string, string>;
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
      <Field label="Document title" required wide error={errors?.title}>
        <input
          name="title"
          required
          maxLength={255}
          defaultValue={defaults?.title ?? ""}
          className={errors?.title ? errorFieldClass : fieldClass}
        />
      </Field>
      <Field label="Description" wide error={errors?.description}>
        <textarea
          name="description"
          rows={3}
          maxLength={5000}
          defaultValue={defaults?.description ?? ""}
          className={errors?.description ? `${errorFieldClass} py-3` : `${fieldClass} py-3`}
        />
      </Field>
      <Field label="Category" required error={errors?.category}>
        <select
          name="category"
          required
          defaultValue={defaults?.category ?? ""}
          className={errors?.category ? errorFieldClass : fieldClass}
        >
          <option value="">Select category</option>
          {categories.map((item) => (
            <option key={item} value={item}>
              {humanizeConstant(item)}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Document type" required error={errors?.documentType}>
        <select
          name="documentType"
          required
          defaultValue={defaults?.documentType ?? ""}
          className={errors?.documentType ? errorFieldClass : fieldClass}
        >
          <option value="">Select type</option>
          {DOCUMENT_TYPES.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </Field>
      <Field label="Access level" required wide={!includeFile} error={errors?.accessLevel}>
        <select
          name="accessLevel"
          required
          defaultValue={defaults?.accessLevel ?? ""}
          className={errors?.accessLevel ? errorFieldClass : fieldClass}
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
      {includeFile ? (
        <Field
          label="File"
          required
          wide
          error={errors?.file}
          hint="PDF, DOC, DOCX, XLS, XLSX, CSV, JPG, JPEG, or PNG; maximum 10 MB."
        >
          <input
            name="file"
            type="file"
            required
            accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.jpg,.jpeg,.png"
            className={errors?.file ? `${errorFieldClass} py-2` : `${fieldClass} py-2`}
          />
        </Field>
      ) : null}
    </div>
  );
}
