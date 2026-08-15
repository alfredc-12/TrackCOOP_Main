import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/next-api-auth";
import {
  listDocuments,
  uploadDocument,
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

function listInput(request: NextRequest): DocumentListInput {
  const value = (key: string) =>
    request.nextUrl.searchParams.get(key) || undefined;
  return {
    search: value("search"),
    category: value("category"),
    documentType: value("documentType"),
    accessLevel: value("accessLevel") as DocumentAccessLevel | undefined,
    status: value("status") as DocumentStatus | undefined,
    uploadedBy: value("uploadedBy"),
    dateFrom: value("dateFrom"),
    dateTo: value("dateTo"),
    expirationFrom: value("expirationFrom"),
    expirationTo: value("expirationTo"),
    fileType: value("fileType"),
    page: Number(value("page") ?? 1),
    pageSize: Number(value("pageSize") ?? 20),
  };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireApiUser(["chairman", "bookkeeper", "member"]);
    if (auth.response) return auth.response;
    return NextResponse.json(
      await listDocuments(listInput(request), auth.user),
    );
  } catch (error) {
    return recordsErrorResponse(error);
  }
}

function formString(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === "string" ? value : undefined;
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiUser(["chairman", "bookkeeper"]);
    if (auth.response) return auth.response;
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Choose a document file." },
        { status: 422 },
      );
    }
    const result = await uploadDocument(
      {
        title: formString(form, "title") ?? "",
        description: formString(form, "description"),
        category: formString(form, "category") ?? "",
        documentType: formString(form, "documentType") ?? "",
        accessLevel: (formString(form, "accessLevel") ??
          "") as DocumentAccessLevel,
        expirationDate: formString(form, "expirationDate"),
        file,
      },
      auth.user,
      requestMetadata(request),
    );
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return recordsErrorResponse(error);
  }
}
