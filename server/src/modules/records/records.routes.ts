import { Router, type Request, type Response } from "express";
import multer from "multer";
import type { RowDataPacket } from "mysql2/promise";
import { getPool } from "../../db/pool";
import { createAuthenticate, createOptionalAuthenticate } from "../../middleware/authenticate";
import { requireRoles } from "../../middleware/authorize";
import { createAuthService, type AuthService } from "../auth/auth.service";
import { RecordsError } from "./records-error";
import { authorizedUserFromAuth, type AuthorizedUser } from "./records-auth";
import {
  getDocumentDetail,
  getDocumentFile,
  listDocuments,
  recordDocumentRegisterExport,
  setDocumentArchived,
  updateDocumentMetadata,
  uploadDocument,
  type DocumentListInput,
  type DocumentMetadataInput,
  type RequestMetadata,
} from "./document-service";
import {
  archiveGeneratedReport,
  generateReport,
  getReportFilterOptions,
  listGeneratedReports,
  recordReportAction,
  recordReportRegisterExport,
  reportCatalogFor,
  reportCatalogSummary,
  reportToCsv,
  reportToPdf,
  saveGeneratedReportToDocuments,
} from "./report-service";
import type {
  DocumentAccessLevel,
  DocumentStatus,
  ReportFilterKey,
  ReportFilters,
} from "./records-types";

type StatementMemberRow = RowDataPacket & Record<string, unknown>;
type StatementItemRow = RowDataPacket & Record<string, unknown>;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 1,
  },
});

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

function metadata(request: Request): RequestMetadata {
  const forwarded = request.headers["x-forwarded-for"];
  const forwardedValue = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  const realIp = request.headers["x-real-ip"];
  const realIpValue = Array.isArray(realIp) ? realIp[0] : realIp;
  return {
    ipAddress:
      forwardedValue?.split(",")[0]?.trim().slice(0, 45) ??
      realIpValue?.slice(0, 45) ??
      request.ip?.slice(0, 45) ??
      null,
    userAgent: request.headers["user-agent"]?.slice(0, 500) ?? null,
  };
}

function user(request: Request): AuthorizedUser {
  if (!request.auth) {
    throw new RecordsError("Authentication is required.", 401, "UNAUTHENTICATED");
  }
  try {
    return authorizedUserFromAuth(request.auth);
  } catch (error) {
    throw new RecordsError(
      error instanceof Error ? error.message : "Authenticated user is invalid.",
      403,
      "INVALID_AUTH_USER",
    );
  }
}

function optionalUser(request: Request): AuthorizedUser | null {
  if (!request.auth) return null;
  return user(request);
}

function param(request: Request, key: string) {
  const value = request.query[key];
  if (Array.isArray(value)) return String(value[0] ?? "") || undefined;
  return typeof value === "string" && value ? value : undefined;
}

function routeParam(request: Request, key: string) {
  const value = request.params[key];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function documentListInput(request: Request, pageSize = 20): DocumentListInput {
  return {
    search: param(request, "search"),
    category: param(request, "category"),
    documentType: param(request, "documentType"),
    accessLevel: param(request, "accessLevel") as DocumentAccessLevel | undefined,
    status: param(request, "status") as DocumentStatus | undefined,
    uploadedBy: param(request, "uploadedBy"),
    dateFrom: param(request, "dateFrom"),
    dateTo: param(request, "dateTo"),
    expirationFrom: param(request, "expirationFrom"),
    expirationTo: param(request, "expirationTo"),
    fileType: param(request, "fileType"),
    page: Number(param(request, "page") ?? 1),
    pageSize: Number(param(request, "pageSize") ?? pageSize),
  };
}

function formString(request: Request, key: string) {
  const value = request.body?.[key];
  return typeof value === "string" ? value : undefined;
}

function uploadedFileLike(file: Express.Multer.File) {
  return {
    name: file.originalname,
    size: file.size,
    type: file.mimetype,
    async arrayBuffer() {
      return Uint8Array.from(file.buffer).buffer;
    },
  };
}

function cell(value: string | number | null) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function handleRecordsError(response: Response, error: unknown) {
  if (error instanceof RecordsError) {
    response.status(error.status).json({ error: error.message, code: error.code });
    return;
  }
  console.error("Records module request failed:", error);
  response
    .status(500)
    .json({ error: "The records operation could not be completed." });
}

function reportFiltersFromQuery(request: Request) {
  const filters: ReportFilters = {};
  for (const key of filterKeys) {
    const value = param(request, key);
    if (value) filters[key] = value;
  }
  return filters;
}

async function listDocumentsRoute(request: Request, response: Response) {
  try {
    response.json(await listDocuments(documentListInput(request), user(request)));
  } catch (error) {
    handleRecordsError(response, error);
  }
}

async function uploadDocumentRoute(request: Request, response: Response) {
  try {
    if (!request.file) {
      response.status(422).json({ error: "Choose a document file." });
      return;
    }
    response.status(201).json(
      await uploadDocument(
        {
          title: formString(request, "title") ?? "",
          description: formString(request, "description"),
          category: formString(request, "category") ?? "",
          documentType: formString(request, "documentType") ?? "",
          accessLevel: (formString(request, "accessLevel") ?? "") as DocumentAccessLevel,
          expirationDate: formString(request, "expirationDate"),
          file: uploadedFileLike(request.file),
        },
        user(request),
        metadata(request),
      ),
    );
  } catch (error) {
    handleRecordsError(response, error);
  }
}

async function documentDetailRoute(request: Request, response: Response) {
  try {
    response.json(await getDocumentDetail(routeParam(request, "id"), user(request)));
  } catch (error) {
    handleRecordsError(response, error);
  }
}

async function updateDocumentRoute(request: Request, response: Response) {
  try {
    const body = request.body as
      | { action: "archive"; reason?: string }
      | { action: "restore" }
      | { action: "update"; document: DocumentMetadataInput };
    if (body.action === "archive") {
      response.json(
        await setDocumentArchived(
          routeParam(request, "id"),
          true,
          body.reason,
          user(request),
          metadata(request),
        ),
      );
      return;
    }
    if (body.action === "restore") {
      response.json(
        await setDocumentArchived(
          routeParam(request, "id"),
          false,
          undefined,
          user(request),
          metadata(request),
        ),
      );
      return;
    }
    if (body.action === "update" && body.document) {
      response.json(
        await updateDocumentMetadata(
          routeParam(request, "id"),
          body.document,
          user(request),
          metadata(request),
        ),
      );
      return;
    }
    response.status(400).json({ error: "Unsupported document action." });
  } catch (error) {
    handleRecordsError(response, error);
  }
}

async function documentFileRoute(request: Request, response: Response) {
  try {
    const actionParam = param(request, "action");
    const action =
      actionParam === "download"
        ? "Download"
        : actionParam === "print"
          ? "Print"
          : "Preview";
    const file = await getDocumentFile(
      routeParam(request, "id"),
      optionalUser(request),
      action,
      metadata(request),
    );
    const disposition = action === "Download" ? "attachment" : "inline";

    if (action === "Preview") {
      const viewableTypes = ["application/pdf", "image/jpeg", "image/png", "image/gif", "text/plain"];
      if (!viewableTypes.includes(file.mimeType)) {
        response
          .status(200)
          .set({
            "Content-Type": "text/html",
            "Cache-Control": "private, no-store",
            "X-Content-Type-Options": "nosniff",
          })
          .send(`
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
                <a href="/api/documents/${routeParam(request, "id")}/file?action=download" target="_top">Download File</a>
              </body>
            </html>
          `);
        return;
      }
    }

    response.set({
      "Content-Type": file.mimeType,
      "Content-Disposition": `${disposition}; filename="${file.fileName}"; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
      "Content-Length": String(file.contents.length),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    });
    response.send(file.contents);
  } catch (error) {
    handleRecordsError(response, error);
  }
}

async function documentsExportRoute(request: Request, response: Response) {
  try {
    const actor = user(request);
    const input = { ...documentListInput(request, 100), page: 1, pageSize: 100 };
    const first = await listDocuments(input, actor);
    const documents = [...first.documents];
    for (let page = 2; documents.length < first.total; page += 1) {
      const result = await listDocuments({ ...input, page }, actor);
      documents.push(...result.documents);
      if (result.documents.length === 0) break;
    }
    const header = [
      "Reference",
      "Title",
      "File",
      "Category",
      "Document Type",
      "Access Level",
      "Status",
      "Uploaded By",
      "Updated At",
    ].map(cell);
    const rows = documents.map((document) =>
      [
        document.reference,
        document.title,
        document.fileName,
        document.category,
        document.documentType,
        document.accessLevel,
        document.status,
        document.uploadedBy,
        document.updatedAt,
      ]
        .map(cell)
        .join(","),
    );
    await recordDocumentRegisterExport(actor, metadata(request));
    response
      .set({
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="trackcoop-document-register-${new Date().toISOString().slice(0, 10)}.csv"`,
        "Cache-Control": "private, no-store",
      })
      .send(`\uFEFF${header.join(",")}\r\n${rows.join("\r\n")}`);
  } catch (error) {
    handleRecordsError(response, error);
  }
}

async function reportsHomeRoute(request: Request, response: Response) {
  try {
    const actor = user(request);
    const [history, filterOptions] = await Promise.all([
      listGeneratedReports(actor),
      getReportFilterOptions(actor),
    ]);
    const thisMonth = new Date().toISOString().slice(0, 7);
    response.json({
      catalog: reportCatalogFor(actor),
      summary: {
        ...reportCatalogSummary(actor),
        generatedThisMonth: history.filter((item) =>
          item.generatedAt.startsWith(thisMonth),
        ).length,
      },
      recent: history.slice(0, 8),
      filterOptions,
    });
  } catch (error) {
    handleRecordsError(response, error);
  }
}

async function reportsHistoryRoute(request: Request, response: Response) {
  try {
    response.json({ reports: await listGeneratedReports(user(request)) });
  } catch (error) {
    handleRecordsError(response, error);
  }
}

async function reportsHistoryExportRoute(request: Request, response: Response) {
  try {
    const actor = user(request);
    const reports = await listGeneratedReports(actor);
    const rows = [
      [
        "Report Reference",
        "Report",
        "Category",
        "Period",
        "Generated By",
        "Generated At",
        "Format",
        "Status",
        "Document Reference",
      ],
      ...reports.map((report) => [
        report.reference,
        report.title,
        report.category,
        report.periodLabel,
        report.generatedBy,
        report.generatedAt,
        report.outputFormat,
        report.status,
        report.documentReference,
      ]),
    ].map((row) => row.map(cell).join(","));
    await recordReportRegisterExport(actor, metadata(request));
    response
      .set({
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="trackcoop-report-register-${new Date().toISOString().slice(0, 10)}.csv"`,
        "Cache-Control": "private, no-store",
      })
      .send(`\uFEFF${rows.join("\r\n")}`);
  } catch (error) {
    handleRecordsError(response, error);
  }
}

async function generateReportRoute(request: Request, response: Response) {
  try {
    response.json(
      await generateReport(
        routeParam(request, "reportType"),
        request.body?.filters ?? {},
        user(request),
        {
          outputFormat: "PREVIEW",
          metadata: metadata(request),
        },
      ),
    );
  } catch (error) {
    handleRecordsError(response, error);
  }
}

async function exportGeneratedReportRoute(request: Request, response: Response) {
  try {
    const actor = user(request);
    const format = param(request, "format") === "csv" ? "CSV" : "PDF";
    const result = await generateReport(
      routeParam(request, "reportType"),
      reportFiltersFromQuery(request),
      actor,
      { outputFormat: format, metadata: metadata(request) },
    );
    await recordReportAction(
      result.reportId,
      "report.exported",
      actor,
      metadata(request),
    );
    const safeName = `trackcoop-${routeParam(request, "reportType")}-${new Date().toISOString().slice(0, 10)}`;
    if (format === "CSV") {
      response
        .set({
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${safeName}.csv"`,
          "Cache-Control": "private, no-store",
        })
        .send(reportToCsv(result));
      return;
    }
    const pdf = await reportToPdf(result);
    response
      .set({
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safeName}.pdf"`,
        "Content-Length": String(pdf.length),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      })
      .send(pdf);
  } catch (error) {
    handleRecordsError(response, error);
  }
}

async function updateReportRoute(request: Request, response: Response) {
  try {
    if (request.body?.action !== "archive") {
      response.status(400).json({ error: "Unsupported report action." });
      return;
    }
    response.json(
      await archiveGeneratedReport(
        routeParam(request, "id"),
        request.body?.reason ?? "",
        user(request),
        metadata(request),
      ),
    );
  } catch (error) {
    handleRecordsError(response, error);
  }
}

async function saveReportRoute(request: Request, response: Response) {
  try {
    response.status(201).json(
      await saveGeneratedReportToDocuments(
        routeParam(request, "id"),
        request.body?.accessLevel ?? "ADMIN_ONLY",
        user(request),
        metadata(request),
      ),
    );
  } catch (error) {
    handleRecordsError(response, error);
  }
}

async function reportActivityRoute(request: Request, response: Response) {
  try {
    if (request.body?.action !== "print") {
      response.status(400).json({ error: "Unsupported report activity." });
      return;
    }
    response.json(
      await recordReportAction(
        routeParam(request, "id"),
        "report.printed",
        user(request),
        metadata(request),
      ),
    );
  } catch (error) {
    handleRecordsError(response, error);
  }
}

async function statementRoute(request: Request, response: Response) {
  try {
    const actor = user(request);
    const pool = getPool();
    const [members] = await pool.query<StatementMemberRow[]>(
      `SELECT m.*, u.email as user_email
         FROM member_profiles m
         LEFT JOIN users u ON m.user_id = u.user_id
        WHERE m.user_id = ?`,
      [actor.id],
    );
    const member = members[0];
    if (!member) {
      response.status(404).json({ error: "Member profile not found." });
      return;
    }

    const [deposits] = await pool.query<StatementItemRow[]>(
      `SELECT amount, payment_date as date, payment_reference_id as ref
         FROM share_capital_payments
        WHERE member_id = ? AND payment_status = 'Validated'
        ORDER BY payment_date ASC`,
      [member.member_id],
    );
    const [purchases] = await pool.query<StatementItemRow[]>(
      `SELECT sale_number as ref, sale_date as date, total_amount as amount
         FROM pos_sales
        WHERE member_id = ? AND sale_status = 'Completed'
        ORDER BY sale_date ASC`,
      [member.member_id],
    );

    response.json({ member, deposits, purchases });
  } catch (error) {
    handleRecordsError(response, error);
  }
}

export function createRecordsRouter(authService: AuthService = createAuthService()) {
  const router = Router();
  const authenticated = createAuthenticate(authService);
  const optionalAuthenticated = createOptionalAuthenticate(authService);
  const allRoles = [authenticated, requireRoles("chairman", "bookkeeper", "member")];
  const staff = [authenticated, requireRoles("chairman", "bookkeeper")];
  const memberOnly = [authenticated, requireRoles("member")];

  router.get("/documents/export", ...staff, documentsExportRoute);
  router.get("/documents/:id/file", optionalAuthenticated, documentFileRoute);
  router.get("/documents/:id", ...allRoles, documentDetailRoute);
  router.patch("/documents/:id", ...staff, updateDocumentRoute);
  router.get("/documents", ...allRoles, listDocumentsRoute);
  router.post("/documents", ...staff, upload.single("file"), uploadDocumentRoute);

  router.get("/reports/history/export", ...staff, reportsHistoryExportRoute);
  router.get("/reports/history", ...staff, reportsHistoryRoute);
  router.post("/reports/generate/:reportType", ...staff, generateReportRoute);
  router.get("/reports/generate/:reportType/export", ...staff, exportGeneratedReportRoute);
  router.post("/reports/:id/save", ...staff, saveReportRoute);
  router.post("/reports/:id/activity", ...staff, reportActivityRoute);
  router.patch("/reports/:id", ...staff, updateReportRoute);
  router.get("/reports", ...staff, reportsHomeRoute);

  router.get("/members/me/statement", ...memberOnly, statementRoute);

  return router;
}
