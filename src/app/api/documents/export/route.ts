import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/next-api-auth";
import {
  listDocuments,
  recordDocumentRegisterExport,
  type DocumentListInput,
} from "@/features/records/server/document-service";
import {
  recordsErrorResponse,
  requestMetadata,
} from "@/features/records/server/api-response";
import type {
  DocumentAccessLevel,
  DocumentStatus,
} from "@/features/records/records-types";

function cell(value: string | number | null) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireApiUser(["chairman", "bookkeeper"]);
    if (auth.response) return auth.response;
    const param = (key: string) =>
      request.nextUrl.searchParams.get(key) || undefined;
    const input: DocumentListInput = {
      search: param("search"),
      category: param("category"),
      documentType: param("documentType"),
      accessLevel: param("accessLevel") as DocumentAccessLevel | undefined,
      relatedModule: param("relatedModule"),
      status: param("status") as DocumentStatus | undefined,
      uploadedBy: param("uploadedBy"),
      dateFrom: param("dateFrom"),
      dateTo: param("dateTo"),
      expirationFrom: param("expirationFrom"),
      expirationTo: param("expirationTo"),
      fileType: param("fileType"),
      page: 1,
      pageSize: 100,
    };
    const first = await listDocuments(input, auth.user);
    const documents = [...first.documents];
    for (let page = 2; documents.length < first.total; page += 1) {
      const result = await listDocuments({ ...input, page }, auth.user);
      documents.push(...result.documents);
      if (result.documents.length === 0) break;
    }
    const header = [
      "Reference",
      "Title",
      "File",
      "Category",
      "Document Type",
      "Related Module",
      "Access Level",
      "Version",
      "Status",
      "Uploaded By",
      "Updated At",
    ].map(cell);
    const rows = documents.map((document) =>
      [
        document.reference,
        document.title,
        document.fileName,
        document.category,
        document.documentType,
        document.relatedModule,
        document.accessLevel,
        document.currentVersion,
        document.status,
        document.uploadedBy,
        document.updatedAt,
      ]
        .map(cell)
        .join(","),
    );
    await recordDocumentRegisterExport(auth.user, requestMetadata(request));
    return new NextResponse(
      `\uFEFF${header.join(",")}\r\n${rows.join("\r\n")}`,
      {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="trackcoop-document-register-${new Date().toISOString().slice(0, 10)}.csv"`,
          "Cache-Control": "private, no-store",
        },
      },
    );
  } catch (error) {
    return recordsErrorResponse(error);
  }
}
