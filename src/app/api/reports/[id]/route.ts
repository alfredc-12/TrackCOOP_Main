import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/next-api-auth";
import { archiveGeneratedReport } from "@/features/records/server/report-service";
import {
  recordsErrorResponse,
  requestMetadata,
} from "@/features/records/server/api-response";

export async function PATCH(
  request: NextRequest,
  context: RouteContext<"/api/reports/[id]">,
) {
  try {
    const auth = await requireApiUser(["chairman", "bookkeeper"]);
    if (auth.response) return auth.response;
    const { id } = await context.params;
    const body = (await request.json()) as { action?: string; reason?: string };
    if (body.action !== "archive") {
      return NextResponse.json(
        { error: "Unsupported report action." },
        { status: 400 },
      );
    }
    return NextResponse.json(
      await archiveGeneratedReport(
        id,
        body.reason ?? "",
        auth.user,
        requestMetadata(request),
      ),
    );
  } catch (error) {
    return recordsErrorResponse(error);
  }
}
