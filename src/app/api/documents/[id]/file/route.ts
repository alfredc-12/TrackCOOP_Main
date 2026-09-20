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
    const file = await getDocumentFile(
      id,
      user,
      action,
      requestMetadata(request),
    );
    const disposition = action === "Download" ? "attachment" : "inline";

    if (action === "Preview") {
      const viewableTypes = ["application/pdf", "image/jpeg", "image/png", "image/gif", "text/plain"];
      if (!viewableTypes.includes(file.mimeType)) {
        const html = `
          <!DOCTYPE html>
          <html>
            <head>
              <style>
                body { font-family: system-ui, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f9fafb; color: #374151; }
                p { margin-bottom: 1rem; }
                a { display: inline-block; padding: 0.5rem 1rem; background: #123D2A; color: white; text-decoration: none; border-radius: 0.375rem; font-weight: 500; }
                a:hover { background: #1F6B43; }
              </style>
            </head>
            <body>
              <p>This file type (${file.mimeType}) cannot be previewed directly in the browser.</p>
              <a href="/api/documents/${id}/file?action=download" target="_top">Download File</a>
            </body>
          </html>
        `;
        return new NextResponse(html, {
          headers: {
            "Content-Type": "text/html",
            "Cache-Control": "private, no-store",
            "X-Content-Type-Options": "nosniff",
          },
        });
      }
    }

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
