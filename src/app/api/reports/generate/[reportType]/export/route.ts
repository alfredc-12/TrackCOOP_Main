import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/next-api-auth";
import {
  generateReport,
  recordReportAction,
  reportToCsv,
  reportToPdf,
} from "@/features/records/server/report-service";
import {
  recordsErrorResponse,
  requestMetadata,
} from "@/features/records/server/api-response";
import type {
  ReportFilterKey,
  ReportFilters,
} from "@/features/records/records-types";

const filterKeys: ReportFilterKey[] = [
  "dateFrom",
  "dateTo",
  "year",
  "month",
  "barangay",
  "sector",
  "membershipType",
  "paymentStatus",
  "paymentMethod",
  "rentalAssetId",
  "rentalStatus",
  "productId",
  "productCategory",
  "documentCategory",
  "documentAccessLevel",
  "relatedModule",
  "userId",
  "role",
  "auditAction",
];

export async function GET(
  request: NextRequest,
  context: RouteContext<"/api/reports/generate/[reportType]/export">,
) {
  try {
    const auth = await requireApiUser(["chairman", "bookkeeper"]);
    if (auth.response) return auth.response;
    const { reportType } = await context.params;
    const format =
      request.nextUrl.searchParams.get("format") === "csv" ? "CSV" : "PDF";
    const filters: ReportFilters = {};
    for (const key of filterKeys) {
      const value = request.nextUrl.searchParams.get(key);
      if (value) filters[key] = value;
    }
    const result = await generateReport(reportType, filters, auth.user, {
      outputFormat: format,
      metadata: requestMetadata(request),
    });
    await recordReportAction(
      result.reportId,
      "report.exported",
      auth.user,
      requestMetadata(request),
    );
    const safeName = `trackcoop-${reportType}-${new Date().toISOString().slice(0, 10)}`;
    if (format === "CSV") {
      return new NextResponse(reportToCsv(result), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${safeName}.csv"`,
          "Cache-Control": "private, no-store",
        },
      });
    }
    const pdf = await reportToPdf(result);
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safeName}.pdf"`,
        "Content-Length": String(pdf.length),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return recordsErrorResponse(error);
  }
}
