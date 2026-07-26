import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/next-api-auth";
import {
  listGeneratedReports,
  getReportFilterOptions,
  reportCatalogFor,
  reportCatalogSummary,
} from "@/features/records/server/report-service";
import { recordsErrorResponse } from "@/features/records/server/api-response";

export async function GET() {
  try {
    const auth = await requireApiUser(["chairman", "bookkeeper"]);
    if (auth.response) return auth.response;
    const [history, filterOptions] = await Promise.all([
      listGeneratedReports(auth.user),
      getReportFilterOptions(auth.user),
    ]);
    const thisMonth = new Date().toISOString().slice(0, 7);
    return NextResponse.json({
      catalog: reportCatalogFor(auth.user),
      summary: {
        ...reportCatalogSummary(auth.user),
        generatedThisMonth: history.filter((item) =>
          item.generatedAt.startsWith(thisMonth),
        ).length,
      },
      recent: history.slice(0, 8),
      filterOptions,
    });
  } catch (error) {
    return recordsErrorResponse(error);
  }
}
