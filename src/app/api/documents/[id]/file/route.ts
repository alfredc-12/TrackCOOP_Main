import { NextRequest, NextResponse } from "next/server";
import { getOptionalApiUser } from "@/lib/next-api-auth";
import { getDocumentFile } from "@/features/records/server/document-service";
import {
  recordsErrorResponse,
  requestMetadata,
} from "@/features/records/server/api-response";

export async function GET(
  request: NextRequest,
  context: RouteContext<"/api/documents/[id]/file">,
) {
  try {
    const { id } = await context.params;
    const user = await getOptionalApiUser();
    const actionParam = request.nextUrl.searchParams.get("action");
    const action =
      actionParam === "download"
        ? "Download"
        : actionParam === "print"
          ? "Print"
          : "Preview";
    const versionValue = request.nextUrl.searchParams.get("version");
    const version =
      versionValue && /^\d+$/.test(versionValue)
        ? Number(versionValue)
        : undefined;
    const file = await getDocumentFile(
      id,
      version,
      user,
      action,
      requestMetadata(request),
    );
    const disposition = action === "Download" ? "attachment" : "inline";
    return new NextResponse(new Uint8Array(file.contents), {
      headers: {
        "Content-Type": file.mimeType,
        "Content-Disposition": `${disposition}; filename="${file.fileName}"; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
        "Content-Length": String(file.contents.length),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return recordsErrorResponse(error);
  }
}
