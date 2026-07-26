import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/next-api-auth";
import { recordReportAction } from "@/features/records/server/report-service";
import {
  recordsErrorResponse,
  requestMetadata,
} from "@/features/records/server/api-response";

export async function POST(
  request: NextRequest,
  context: RouteContext<"/api/reports/[id]/activity">,
) {
  try {
    const auth = await requireApiUser(["chairman", "bookkeeper"]);
    if (auth.response) return auth.response;
    const { id } = await context.params;
    const body = (await request.json()) as { action?: string };
    if (body.action !== "print") {
      return NextResponse.json(
        { error: "Unsupported report activity." },
        { status: 400 },
      );
    }
    return NextResponse.json(
      await recordReportAction(
        id,
        "report.printed",
        auth.user,
        requestMetadata(request),
      ),
    );
  } catch (error) {
    return recordsErrorResponse(error);
  }
}
