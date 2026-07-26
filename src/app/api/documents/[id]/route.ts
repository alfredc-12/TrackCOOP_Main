import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/next-api-auth";
import {
  getDocumentDetail,
  setDocumentArchived,
  updateDocumentMetadata,
  type DocumentMetadataInput,
} from "@/features/records/server/document-service";
import {
  recordsErrorResponse,
  requestMetadata,
} from "@/features/records/server/api-response";

export async function GET(
  _request: NextRequest,
  context: RouteContext<"/api/documents/[id]">,
) {
  try {
    const auth = await requireApiUser(["chairman", "bookkeeper", "member"]);
    if (auth.response) return auth.response;
    const { id } = await context.params;
    return NextResponse.json(await getDocumentDetail(id, auth.user));
  } catch (error) {
    return recordsErrorResponse(error);
  }
}

type PatchBody =
  | { action: "archive"; reason?: string }
  | { action: "restore" }
  | { action: "update"; document: DocumentMetadataInput };

export async function PATCH(
  request: NextRequest,
  context: RouteContext<"/api/documents/[id]">,
) {
  try {
    const auth = await requireApiUser(["chairman", "bookkeeper"]);
    if (auth.response) return auth.response;
    const { id } = await context.params;
    const body = (await request.json()) as PatchBody;
    if (body.action === "archive") {
      return NextResponse.json(
        await setDocumentArchived(
          id,
          true,
          body.reason,
          auth.user,
          requestMetadata(request),
        ),
      );
    }
    if (body.action === "restore") {
      return NextResponse.json(
        await setDocumentArchived(
          id,
          false,
          undefined,
          auth.user,
          requestMetadata(request),
        ),
      );
    }
    if (body.action === "update" && body.document) {
      return NextResponse.json(
        await updateDocumentMetadata(
          id,
          body.document,
          auth.user,
          requestMetadata(request),
        ),
      );
    }
    return NextResponse.json(
      { error: "Unsupported document action." },
      { status: 400 },
    );
  } catch (error) {
    return recordsErrorResponse(error);
  }
}
