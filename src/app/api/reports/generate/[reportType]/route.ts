import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/next-api-auth";
import { generateReport } from "@/features/records/server/report-service";
import {
  recordsErrorResponse,
  requestMetadata,
} from "@/features/records/server/api-response";
import type { ReportFilters } from "@/features/records/records-types";

type GenerateBody = { filters?: ReportFilters };

export async function POST(
  request: NextRequest,
  context: RouteContext<"/api/reports/generate/[reportType]">,
) {
  try {
    const auth = await requireApiUser(["chairman", "bookkeeper"]);
    if (auth.response) return auth.response;
    const { reportType } = await context.params;
    const body = (await request.json()) as GenerateBody;
    return NextResponse.json(
      await generateReport(reportType, body.filters ?? {}, auth.user, {
        outputFormat: "PREVIEW",
        metadata: requestMetadata(request),
      }),
    );
  } catch (error) {
    return recordsErrorResponse(error);
  }
}
