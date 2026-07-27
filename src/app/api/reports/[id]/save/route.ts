import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/next-api-auth";
import { saveGeneratedReportToDocuments } from "@/features/records/server/report-service";
import {
  recordsErrorResponse,
  requestMetadata,
} from "@/features/records/server/api-response";
import type { DocumentAccessLevel } from "@/features/records/records-types";

export async function POST(
  request: NextRequest,
  context: RouteContext<"/api/reports/[id]/save">,
) {
  try {
    const auth = await requireApiUser(["chairman", "bookkeeper"]);
    if (auth.response) return auth.response;
    const { id } = await context.params;
    const body = (await request.json()) as {
      accessLevel?: DocumentAccessLevel;
    };
    return NextResponse.json(
      await saveGeneratedReportToDocuments(
        id,
        body.accessLevel ?? "ADMIN_ONLY",
        auth.user,
        requestMetadata(request),
      ),
      { status: 201 },
    );
  } catch (error) {
    return recordsErrorResponse(error);
  }
}
