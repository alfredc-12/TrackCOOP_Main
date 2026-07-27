import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/next-api-auth";
import { uploadDocumentVersion } from "@/features/records/server/document-service";
import {
  recordsErrorResponse,
  requestMetadata,
} from "@/features/records/server/api-response";

export async function POST(
  request: NextRequest,
  context: RouteContext<"/api/documents/[id]/versions">,
) {
  try {
    const auth = await requireApiUser(["chairman", "bookkeeper"]);
    if (auth.response) return auth.response;
    const { id } = await context.params;
    const form = await request.formData();
    const file = form.get("file");
    const changeNote = form.get("changeNote");
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Choose a version file." },
        { status: 422 },
      );
    }
    return NextResponse.json(
      await uploadDocumentVersion(
        id,
        file,
        typeof changeNote === "string" ? changeNote : "",
        auth.user,
        requestMetadata(request),
      ),
      { status: 201 },
    );
  } catch (error) {
    return recordsErrorResponse(error);
  }
}
