import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/next-api-auth";
import { listGeneratedReports } from "@/features/records/server/report-service";
import { recordsErrorResponse } from "@/features/records/server/api-response";

export async function GET() {
  try {
    const auth = await requireApiUser(["chairman", "bookkeeper"]);
    if (auth.response) return auth.response;
    return NextResponse.json({
      reports: await listGeneratedReports(auth.user),
    });
  } catch (error) {
    return recordsErrorResponse(error);
  }
}
