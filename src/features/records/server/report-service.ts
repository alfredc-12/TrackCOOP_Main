import { createHash, randomUUID } from "node:crypto";
import { unlink } from "node:fs/promises";
import PDFDocument from "pdfkit";
import type {
  PoolConnection,
  ResultSetHeader,
  RowDataPacket,
} from "mysql2/promise";
import type { AuthorizedUser } from "@/lib/next-api-auth";
import { db } from "@/lib/db";
import { REPORT_CATALOG, REPORT_CATEGORY_LABELS } from "../record-constants";
import type {
  DocumentAccessLevel,
  GeneratedReportRecord,
  ReportCategory,
  ReportColumn,
  ReportDefinition,
  ReportFilters,
  ReportFilterOptions,
  ReportResult,
} from "../records-types";
import { storeProtectedDocument } from "./document-security";
import { RecordsError } from "./records-error";
import type { RequestMetadata } from "./document-service";

type QuerySpec = {
  sql: string;
  values: Array<string | number | null>;
  columns: ReportColumn[];
};

type ReportHistoryRow = RowDataPacket & {
  id: string;
  reference: string;
  reportKey: string | null;
  title: string | null;
  legacyType: string;
  category: ReportCategory | null;
  periodLabel: string | null;
  generatedBy: string;
  generatedAt: string;
  outputFormat: string | null;
  status: string;
  documentId: string | null;
  documentReference: string | null;
  filtersJson: string | null;
};

type StoredReportRow = RowDataPacket & {
  id: string;
  reference: string;
  reportKey: string | null;
  title: string | null;
  category: ReportCategory | null;
  filtersJson: string | null;
  documentId: string | null;
};

const currencyFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  minimumFractionDigits: 2,
});

function definitionFor(key: string) {
  const definition = REPORT_CATALOG.find((item) => item.key === key);
  if (!definition) {
    throw new RecordsError("Report type not found.", 404, "REPORT_NOT_FOUND");
  }
  return definition;
}

function validateFilters(definition: ReportDefinition, source: ReportFilters) {
  const result: ReportFilters = {};
  for (const key of definition.filters) {
    const value = source[key]?.trim();
    if (value) result[key] = value.slice(0, 190);
  }
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  if (result.dateFrom && !datePattern.test(result.dateFrom)) {
    throw new RecordsError(
      "Enter a valid start date.",
      422,
      "INVALID_REPORT_FILTER",
    );
  }
  if (result.dateTo && !datePattern.test(result.dateTo)) {
    throw new RecordsError(
      "Enter a valid end date.",
      422,
      "INVALID_REPORT_FILTER",
    );
  }
  if (result.dateFrom && result.dateTo) {
    const from = new Date(`${result.dateFrom}T00:00:00`);
    const to = new Date(`${result.dateTo}T00:00:00`);
    if (from > to) {
      throw new RecordsError(
        "The report start date must be before the end date.",
        422,
        "INVALID_REPORT_FILTER",
      );
    }
    if (to.getTime() - from.getTime() > 10 * 366 * 24 * 60 * 60 * 1000) {
      throw new RecordsError(
        "Choose a report period of ten years or less.",
        422,
        "INVALID_REPORT_FILTER",
      );
    }
  }
  if (result.year && !/^(20\d{2}|2100)$/.test(result.year)) {
    throw new RecordsError(
      "Enter a valid report year.",
      422,
      "INVALID_REPORT_FILTER",
    );
  }
  if (result.month && !/^(?:[1-9]|1[0-2])$/.test(result.month)) {
    throw new RecordsError(
      "Enter a valid report month.",
      422,
      "INVALID_REPORT_FILTER",
    );
  }
  for (const idKey of ["rentalAssetId", "productId", "userId"] as const) {
    if (result[idKey] && !/^\d+$/.test(result[idKey]!)) {
      throw new RecordsError(
        "A report filter contains an invalid record.",
        422,
        "INVALID_REPORT_FILTER",
      );
    }
  }
  return result;
}

function ensureAuthorized(definition: ReportDefinition, user: AuthorizedUser) {
  if (!definition.allowedRoles.includes(user.role)) {
    throw new RecordsError(
      "You do not have permission to generate this report.",
      403,
      "REPORT_FORBIDDEN",
    );
  }
  if (definition.configurationRequired) {
    throw new RecordsError(
      "Template or Client Configuration Required.",
      409,
      "REPORT_CONFIGURATION_REQUIRED",
    );
  }
}

function addDateRange(
  conditions: string[],
  values: Array<string | number>,
  column: string,
  filters: ReportFilters,
) {
  if (filters.dateFrom) {
    conditions.push(`DATE(${column}) >= ?`);
    values.push(filters.dateFrom);
  }
  if (filters.dateTo) {
    conditions.push(`DATE(${column}) <= ?`);
    values.push(filters.dateTo);
  }
}

function addEquals(
  conditions: string[],
  values: Array<string | number>,
  column: string,
  value: string | undefined,
) {
  if (value) {
    conditions.push(`${column} = ?`);
    values.push(value);
  }
}

const financialColumns: ReportColumn[] = [
  { key: "recordNumber", label: "Record" },
  { key: "recordDate", label: "Date", format: "date" },
  { key: "recordType", label: "Type" },
  { key: "category", label: "Category" },
  { key: "source", label: "Source" },
  { key: "amount", label: "Amount", format: "currency" },
];

function financialLedgerSpec(filters: ReportFilters): QuerySpec {
  const conditions = [
    "fr.record_status = 'Active'",
    "fr.approved_by IS NOT NULL",
    "fr.record_type IN ('Income','Expense')",
    "(fr.payment_reference_id IS NULL OR pr.validation_status = 'Validated')",
  ];
  const values: Array<string | number> = [];
  addDateRange(conditions, values, "fr.record_date", filters);
  return {
    sql: `SELECT fr.record_number AS recordNumber,
                 fr.record_date AS recordDate,
                 fr.record_type AS recordType,
                 fc.category_name AS category,
                 fr.source_module AS source,
                 fr.amount
            FROM financial_records fr
            JOIN financial_categories fc ON fc.financial_category_id = fr.financial_category_id
            LEFT JOIN payment_references pr ON pr.payment_reference_id = fr.payment_reference_id
           WHERE ${conditions.join(" AND ")}
           ORDER BY fr.record_date DESC, fr.financial_record_id DESC`,
    values,
    columns: financialColumns,
  };
}

function financialGroupedSpec(
  filters: ReportFilters,
  type: "Income" | "Expense",
  groupColumn: string,
  groupLabel: string,
): QuerySpec {
  const conditions = [
    "fr.record_status = 'Active'",
    "fr.approved_by IS NOT NULL",
    "fr.record_type = ?",
    "(fr.payment_reference_id IS NULL OR pr.validation_status = 'Validated')",
  ];
  const values: Array<string | number> = [type];
  addDateRange(conditions, values, "fr.record_date", filters);
  return {
    sql: `SELECT ${groupColumn} AS item,
                 COUNT(*) AS transactions,
                 SUM(fr.amount) AS amount
            FROM financial_records fr
            JOIN financial_categories fc ON fc.financial_category_id = fr.financial_category_id
            LEFT JOIN payment_references pr ON pr.payment_reference_id = fr.payment_reference_id
           WHERE ${conditions.join(" AND ")}
           GROUP BY ${groupColumn}
           ORDER BY amount DESC, item`,
    values,
    columns: [
      { key: "item", label: groupLabel },
      { key: "transactions", label: "Transactions", format: "number" },
      { key: "amount", label: "Amount", format: "currency" },
    ],
  };
}

function memberListSpec(
  filters: ReportFilters,
  forcedMembershipType?: string,
): QuerySpec {
  const conditions = ["mp.approval_status = 'Approved'"];
  const values: Array<string | number> = [];
  addEquals(conditions, values, "mp.barangay", filters.barangay);
  addEquals(conditions, values, "mp.sector", filters.sector);
  addEquals(
    conditions,
    values,
    "mp.membership_type",
    forcedMembershipType ?? filters.membershipType,
  );
  return {
    sql: `SELECT mp.member_code AS memberCode,
                 mp.full_name AS memberName,
                 COALESCE(mp.barangay, 'Not recorded') AS barangay,
                 COALESCE(mp.sector, 'Not recorded') AS sector,
                 mp.membership_type AS membershipType,
                 mp.official_member_status AS status,
                 mp.approved_at AS approvedAt
            FROM member_profiles mp
           WHERE ${conditions.join(" AND ")}
           ORDER BY mp.full_name`,
    values,
    columns: [
      { key: "memberCode", label: "Member" },
      { key: "memberName", label: "Name" },
      { key: "barangay", label: "Barangay" },
      { key: "sector", label: "Sector" },
      { key: "membershipType", label: "Membership Type" },
      { key: "status", label: "Status" },
      { key: "approvedAt", label: "Approved", format: "date" },
    ],
  };
}

function rentalBookingSpec(
  filters: ReportFilters,
  forcedStatus?: string,
  scheduleOnly = false,
): QuerySpec {
  const conditions = ["1 = 1"];
  const values: Array<string | number> = [];
  addDateRange(conditions, values, "rb.start_datetime", filters);
  addEquals(conditions, values, "rb.rental_asset_id", filters.rentalAssetId);
  addEquals(
    conditions,
    values,
    "rb.booking_status",
    forcedStatus ?? filters.rentalStatus,
  );
  addEquals(conditions, values, "rb.payment_status", filters.paymentStatus);
  if (scheduleOnly) {
    conditions.push("rb.booking_status IN ('Approved','Scheduled','In Use')");
  }
  return {
    sql: `SELECT rb.booking_number AS bookingReference,
                 ra.asset_name AS asset,
                 rb.start_datetime AS startDate,
                 rb.end_datetime AS endDate,
                 rb.booking_status AS bookingStatus,
                 rb.payment_status AS paymentStatus,
                 rb.total_amount AS approvedAmount
            FROM rental_bookings rb
            JOIN rental_assets ra ON ra.rental_asset_id = rb.rental_asset_id
           WHERE ${conditions.join(" AND ")}
           ORDER BY rb.start_datetime DESC, rb.rental_booking_id DESC`,
    values,
    columns: [
      { key: "bookingReference", label: "Booking" },
      { key: "asset", label: "Asset" },
      { key: "startDate", label: "Start", format: "datetime" },
      { key: "endDate", label: "End", format: "datetime" },
      { key: "bookingStatus", label: "Booking Status" },
      { key: "paymentStatus", label: "Payment Status" },
      { key: "approvedAmount", label: "Stored Amount", format: "currency" },
    ],
  };
}

function documentRegisterSpec(filters: ReportFilters): QuerySpec {
  const conditions = ["1 = 1"];
  const values: Array<string | number> = [];
  addDateRange(conditions, values, "d.uploaded_at", filters);
  addEquals(conditions, values, "d.category", filters.documentCategory);
  const accessMap: Record<string, string> = {
    PUBLIC: "Public",
    MEMBER_ONLY: "Member-only",
    ADMIN_ONLY: "Admin-only",
    BOOKKEEPER_ONLY: "Bookkeeper-only",
  };
  addEquals(
    conditions,
    values,
    "d.access_level",
    filters.documentAccessLevel
      ? (accessMap[filters.documentAccessLevel] ?? filters.documentAccessLevel)
      : undefined,
  );
  addEquals(conditions, values, "d.related_module", filters.relatedModule);
  return {
    sql: `SELECT d.document_reference AS documentReference,
                 d.title,
                 COALESCE(d.category, 'OTHER') AS category,
                 d.document_type AS documentType,
                 d.access_level AS accessLevel,
                 d.document_status AS status,
                 d.related_module AS relatedModule,
                 d.current_version AS version,
                 d.expiration_date AS expirationDate,
                 d.uploaded_at AS uploadedAt
            FROM documents d
           WHERE ${conditions.join(" AND ")}
           ORDER BY d.updated_at DESC, d.document_id DESC`,
    values,
    columns: [
      { key: "documentReference", label: "Reference" },
      { key: "title", label: "Document" },
      { key: "category", label: "Category" },
      { key: "documentType", label: "Type" },
      { key: "accessLevel", label: "Access" },
      { key: "status", label: "Status" },
      { key: "relatedModule", label: "Related Module" },
      { key: "version", label: "Version", format: "number" },
      { key: "expirationDate", label: "Expires", format: "date" },
      { key: "uploadedAt", label: "Uploaded", format: "datetime" },
    ],
  };
}

function reportQuery(
  definition: ReportDefinition,
  filters: ReportFilters,
): QuerySpec {
  switch (definition.key) {
    case "financial-summary":
    case "cash-in-out":
    case "financial-ledger":
      return financialLedgerSpec(filters);
    case "income-by-source":
      return financialGroupedSpec(
        filters,
        "Income",
        "fr.source_module",
        "Income Source",
      );
    case "expense-by-category":
      return financialGroupedSpec(
        filters,
        "Expense",
        "fc.category_name",
        "Expense Category",
      );
    case "payment-status":
    case "payment-method": {
      const conditions = ["1 = 1"];
      const values: Array<string | number> = [];
      addDateRange(conditions, values, "pr.submitted_at", filters);
      addEquals(
        conditions,
        values,
        "pr.validation_status",
        filters.paymentStatus,
      );
      addEquals(conditions, values, "pr.provider", filters.paymentMethod);
      const group =
        definition.key === "payment-status"
          ? "pr.validation_status"
          : "pr.provider";
      return {
        sql: `SELECT ${group} AS item, COUNT(*) AS payments, SUM(pr.amount) AS amount
                FROM payment_references pr
               WHERE ${conditions.join(" AND ")}
               GROUP BY ${group}
               ORDER BY payments DESC, item`,
        values,
        columns: [
          {
            key: "item",
            label: definition.key === "payment-status" ? "Status" : "Provider",
          },
          { key: "payments", label: "Payments", format: "number" },
          { key: "amount", label: "Submitted Amount", format: "currency" },
        ],
      };
    }
    case "receipt-register": {
      const spec = documentRegisterSpec(filters);
      spec.sql = spec.sql.replace(
        "WHERE 1 = 1",
        "WHERE 1 = 1 AND d.document_type = 'Receipt'",
      );
      return spec;
    }
    case "reconciliation-exceptions": {
      const conditions = [
        "pr.validation_status = 'Validated'",
        "fr.financial_record_id IS NULL",
      ];
      const values: Array<string | number> = [];
      addDateRange(conditions, values, "pr.validated_at", filters);
      return {
        sql: `SELECT CAST(pr.payment_reference_id AS CHAR) AS paymentId,
                     pr.payment_purpose AS purpose,
                     pr.provider,
                     CONCAT('***', RIGHT(pr.reference_number, 4)) AS maskedReference,
                     pr.amount,
                     pr.validated_at AS validatedAt,
                     'No active posted ledger entry' AS exception
                FROM payment_references pr
                LEFT JOIN financial_records fr
                  ON fr.payment_reference_id = pr.payment_reference_id
                 AND fr.record_status = 'Active'
                 AND fr.approved_by IS NOT NULL
               WHERE ${conditions.join(" AND ")}
               ORDER BY pr.validated_at DESC`,
        values,
        columns: [
          { key: "paymentId", label: "Payment" },
          { key: "purpose", label: "Purpose" },
          { key: "provider", label: "Provider" },
          { key: "maskedReference", label: "Reference" },
          { key: "amount", label: "Amount", format: "currency" },
          { key: "validatedAt", label: "Validated", format: "datetime" },
          { key: "exception", label: "Exception" },
        ],
      };
    }
    case "refund-reversal": {
      const conditions = [
        "(fr.record_status IN ('Corrected','Reversed','Voided') OR fr.reversal_of_record_id IS NOT NULL)",
      ];
      const values: Array<string | number> = [];
      addDateRange(conditions, values, "fr.record_date", filters);
      return {
        sql: `SELECT fr.record_number AS recordNumber,
                     fr.record_date AS recordDate,
                     fr.record_type AS recordType,
                     fc.category_name AS category,
                     fr.amount,
                     fr.record_status AS status,
                     CAST(fr.reversal_of_record_id AS CHAR) AS reversesRecord
                FROM financial_records fr
                JOIN financial_categories fc ON fc.financial_category_id = fr.financial_category_id
               WHERE ${conditions.join(" AND ")}
               ORDER BY fr.record_date DESC`,
        values,
        columns: [
          ...financialColumns.slice(0, 4),
          { key: "amount", label: "Amount", format: "currency" },
          { key: "status", label: "Status" },
          { key: "reversesRecord", label: "Reverses Record" },
        ],
      };
    }
    case "annual-financial-summary":
    case "monthly-financial-summary": {
      const conditions = [
        "fr.record_status = 'Active'",
        "fr.approved_by IS NOT NULL",
        "fr.record_type IN ('Income','Expense')",
        "(fr.payment_reference_id IS NULL OR pr.validation_status = 'Validated')",
      ];
      const values: Array<string | number> = [];
      if (filters.year) {
        conditions.push("YEAR(fr.record_date) = ?");
        values.push(filters.year);
      }
      const period =
        definition.key === "annual-financial-summary"
          ? "DATE_FORMAT(fr.record_date, '%Y')"
          : "DATE_FORMAT(fr.record_date, '%Y-%m')";
      return {
        sql: `SELECT ${period} AS period,
                     SUM(CASE WHEN fr.record_type = 'Income' THEN fr.amount ELSE 0 END) AS income,
                     SUM(CASE WHEN fr.record_type = 'Expense' THEN fr.amount ELSE 0 END) AS expense,
                     SUM(CASE WHEN fr.record_type = 'Income' THEN fr.amount ELSE -fr.amount END) AS net,
                     COUNT(*) AS transactions
                FROM financial_records fr
                LEFT JOIN payment_references pr ON pr.payment_reference_id = fr.payment_reference_id
               WHERE ${conditions.join(" AND ")}
               GROUP BY ${period}
               ORDER BY period DESC`,
        values,
        columns: [
          { key: "period", label: "Period" },
          { key: "income", label: "Confirmed Income", format: "currency" },
          { key: "expense", label: "Confirmed Expense", format: "currency" },
          { key: "net", label: "Net", format: "currency" },
          { key: "transactions", label: "Transactions", format: "number" },
        ],
      };
    }
    case "member-directory":
      return memberListSpec(filters);
    case "associate-members":
      return memberListSpec(filters, "Associate");
    case "true-members":
      return memberListSpec(filters, "True Member");
    case "membership-applications": {
      const conditions = ["1 = 1"];
      const values: Array<string | number> = [];
      addDateRange(conditions, values, "ma.submitted_at", filters);
      addEquals(conditions, values, "ma.barangay", filters.barangay);
      addEquals(
        conditions,
        values,
        "ma.requested_membership_type",
        filters.membershipType,
      );
      return {
        sql: `SELECT ma.application_code AS applicationReference,
                     CONCAT_WS(' ', ma.first_name, ma.middle_name, ma.last_name, ma.suffix) AS applicant,
                     COALESCE(ma.barangay, 'Not recorded') AS barangay,
                     ma.requested_membership_type AS membershipType,
                     ma.application_status AS status,
                     ma.submitted_at AS submittedAt
                FROM membership_applications ma
               WHERE ${conditions.join(" AND ")}
               ORDER BY ma.submitted_at DESC`,
        values,
        columns: [
          { key: "applicationReference", label: "Application" },
          { key: "applicant", label: "Applicant" },
          { key: "barangay", label: "Barangay" },
          { key: "membershipType", label: "Membership Type" },
          { key: "status", label: "Status" },
          { key: "submittedAt", label: "Submitted", format: "datetime" },
        ],
      };
    }
    case "membership-growth": {
      const conditions = [
        "mp.approval_status = 'Approved'",
        "mp.approved_at IS NOT NULL",
      ];
      const values: Array<string | number> = [];
      addDateRange(conditions, values, "mp.approved_at", filters);
      return {
        sql: `SELECT DATE_FORMAT(mp.approved_at, '%Y-%m') AS period,
                     COUNT(*) AS approvedMembers,
                     SUM(mp.membership_type = 'Associate') AS associateMembers,
                     SUM(mp.membership_type = 'True Member') AS trueMembers
                FROM member_profiles mp
               WHERE ${conditions.join(" AND ")}
               GROUP BY DATE_FORMAT(mp.approved_at, '%Y-%m')
               ORDER BY period`,
        values,
        columns: [
          { key: "period", label: "Month" },
          {
            key: "approvedMembers",
            label: "Approved Members",
            format: "number",
          },
          { key: "associateMembers", label: "Associate", format: "number" },
          { key: "trueMembers", label: "True Members", format: "number" },
        ],
      };
    }
    case "members-by-barangay":
    case "members-by-sector": {
      const group =
        definition.key === "members-by-barangay" ? "mp.barangay" : "mp.sector";
      const conditions = ["mp.approval_status = 'Approved'"];
      const values: Array<string | number> = [];
      addEquals(
        conditions,
        values,
        "mp.membership_type",
        filters.membershipType,
      );
      return {
        sql: `SELECT COALESCE(${group}, 'Not recorded') AS item,
                     COUNT(*) AS members,
                     SUM(mp.membership_type = 'Associate') AS associateMembers,
                     SUM(mp.membership_type = 'True Member') AS trueMembers
                FROM member_profiles mp
               WHERE ${conditions.join(" AND ")}
               GROUP BY ${group}
               ORDER BY members DESC, item`,
        values,
        columns: [
          {
            key: "item",
            label:
              definition.key === "members-by-barangay" ? "Barangay" : "Sector",
          },
          { key: "members", label: "Members", format: "number" },
          { key: "associateMembers", label: "Associate", format: "number" },
          { key: "trueMembers", label: "True Members", format: "number" },
        ],
      };
    }
    case "membership-fee-status":
      return {
        sql: `SELECT mp.member_code AS memberCode,
                     mp.full_name AS memberName,
                     COALESCE(SUM(CASE
                       WHEN pr.validation_status = 'Validated'
                        AND pr.payment_purpose = 'Associate Membership Fee'
                       THEN pr.amount ELSE 0 END), 0) AS validatedAmount,
                     CASE WHEN COALESCE(SUM(CASE
                       WHEN pr.validation_status = 'Validated'
                        AND pr.payment_purpose = 'Associate Membership Fee'
                       THEN pr.amount ELSE 0 END), 0) >= 200
                       THEN 'Paid' ELSE 'Outstanding' END AS feeStatus
                FROM member_profiles mp
                LEFT JOIN payment_references pr ON pr.member_id = mp.member_id
               WHERE mp.membership_type = 'Associate'
               GROUP BY mp.member_id
               ORDER BY mp.full_name`,
        values: [],
        columns: [
          { key: "memberCode", label: "Member" },
          { key: "memberName", label: "Name" },
          {
            key: "validatedAmount",
            label: "Validated Fee",
            format: "currency",
          },
          { key: "feeStatus", label: "Fee Status" },
        ],
      };
    case "share-capital-contributions": {
      const conditions = ["1 = 1"];
      const values: Array<string | number> = [];
      addDateRange(conditions, values, "scp.payment_date", filters);
      addEquals(
        conditions,
        values,
        "scp.payment_status",
        filters.paymentStatus,
      );
      return {
        sql: `SELECT mp.member_code AS memberCode,
                     mp.full_name AS memberName,
                     scp.payment_date AS paymentDate,
                     scp.amount,
                     scp.payment_status AS status
                FROM share_capital_payments scp
                JOIN member_profiles mp ON mp.member_id = scp.member_id
               WHERE ${conditions.join(" AND ")}
               ORDER BY scp.payment_date DESC, scp.share_payment_id DESC`,
        values,
        columns: [
          { key: "memberCode", label: "Member" },
          { key: "memberName", label: "Name" },
          { key: "paymentDate", label: "Payment Date", format: "date" },
          { key: "amount", label: "Amount", format: "currency" },
          { key: "status", label: "Status" },
        ],
      };
    }
    case "share-capital-balance":
    case "incomplete-initial-capital": {
      const having =
        definition.key === "incomplete-initial-capital"
          ? "HAVING validatedCapital < 1500"
          : "";
      return {
        sql: `SELECT mp.member_code AS memberCode,
                     mp.full_name AS memberName,
                     mp.membership_type AS membershipType,
                     COALESCE(SUM(CASE WHEN scp.payment_status = 'Validated' THEN scp.amount ELSE 0 END), 0) AS validatedCapital,
                     GREATEST(1500 - COALESCE(SUM(CASE WHEN scp.payment_status = 'Validated' THEN scp.amount ELSE 0 END), 0), 0) AS initialBalance,
                     mp.share_capital_deadline AS deadline
                FROM member_profiles mp
                LEFT JOIN share_capital_payments scp ON scp.member_id = mp.member_id
               WHERE mp.membership_type = 'True Member'
               GROUP BY mp.member_id
               ${having}
               ORDER BY initialBalance DESC, mp.full_name`,
        values: [],
        columns: [
          { key: "memberCode", label: "Member" },
          { key: "memberName", label: "Name" },
          { key: "membershipType", label: "Membership Type" },
          {
            key: "validatedCapital",
            label: "Validated Capital",
            format: "currency",
          },
          {
            key: "initialBalance",
            label: "Initial Balance",
            format: "currency",
          },
          { key: "deadline", label: "Deadline", format: "date" },
        ],
      };
    }
    case "membership-certificates": {
      const spec = documentRegisterSpec(filters);
      spec.sql = spec.sql.replace(
        "WHERE 1 = 1",
        "WHERE 1 = 1 AND d.document_type = 'Certificate' AND d.category = 'CERTIFICATE'",
      );
      return spec;
    }
    case "rental-booking-summary":
      return rentalBookingSpec(filters);
    case "rental-schedule":
      return rentalBookingSpec(filters, undefined, true);
    case "completed-rentals":
      return rentalBookingSpec(filters, "Completed");
    case "cancelled-rentals":
      return rentalBookingSpec(filters, "Cancelled");
    case "rental-payment-status":
      return rentalBookingSpec(filters);
    case "rental-income":
    case "rental-expenses": {
      const type = definition.key === "rental-income" ? "Income" : "Expense";
      const conditions = [
        "fr.record_status = 'Active'",
        "fr.approved_by IS NOT NULL",
        "fr.source_module = 'Rental'",
        "fr.record_type = ?",
        "(fr.payment_reference_id IS NULL OR pr.validation_status = 'Validated')",
      ];
      const values: Array<string | number> = [type];
      addDateRange(conditions, values, "fr.record_date", filters);
      if (filters.rentalAssetId) {
        conditions.push(
          "fr.source_record_id IN (SELECT rental_booking_id FROM rental_bookings WHERE rental_asset_id = ?)",
        );
        values.push(filters.rentalAssetId);
      }
      return {
        sql: `SELECT fr.record_number AS recordNumber,
                     fr.record_date AS recordDate,
                     fc.category_name AS category,
                     fr.amount,
                     rb.booking_number AS bookingReference,
                     ra.asset_name AS asset
                FROM financial_records fr
                JOIN financial_categories fc ON fc.financial_category_id = fr.financial_category_id
                LEFT JOIN payment_references pr ON pr.payment_reference_id = fr.payment_reference_id
                LEFT JOIN rental_bookings rb ON rb.rental_booking_id = fr.source_record_id
                LEFT JOIN rental_assets ra ON ra.rental_asset_id = rb.rental_asset_id
               WHERE ${conditions.join(" AND ")}
               ORDER BY fr.record_date DESC`,
        values,
        columns: [
          { key: "recordNumber", label: "Ledger Record" },
          { key: "recordDate", label: "Date", format: "date" },
          { key: "category", label: "Category" },
          { key: "bookingReference", label: "Booking" },
          { key: "asset", label: "Asset" },
          { key: "amount", label: "Confirmed Amount", format: "currency" },
        ],
      };
    }
    case "rental-asset-utilization": {
      const conditions = ["1 = 1"];
      const values: Array<string | number> = [];
      addDateRange(conditions, values, "rb.start_datetime", filters);
      addEquals(
        conditions,
        values,
        "ra.rental_asset_id",
        filters.rentalAssetId,
      );
      return {
        sql: `SELECT ra.asset_code AS assetCode,
                     ra.asset_name AS asset,
                     COUNT(rb.rental_booking_id) AS bookings,
                     SUM(rb.booking_status = 'Completed') AS completed,
                     SUM(rb.booking_status IN ('Approved','Scheduled','In Use')) AS activeSchedule,
                     COALESCE(SUM(CASE WHEN rb.booking_status = 'Completed'
                       THEN TIMESTAMPDIFF(HOUR, rb.start_datetime, rb.end_datetime) ELSE 0 END), 0) AS completedHours
                FROM rental_assets ra
                LEFT JOIN rental_bookings rb ON rb.rental_asset_id = ra.rental_asset_id
               WHERE ${conditions.join(" AND ")}
               GROUP BY ra.rental_asset_id
               ORDER BY bookings DESC, ra.asset_name`,
        values,
        columns: [
          { key: "assetCode", label: "Asset Code" },
          { key: "asset", label: "Asset" },
          { key: "bookings", label: "Bookings", format: "number" },
          { key: "completed", label: "Completed", format: "number" },
          { key: "activeSchedule", label: "Active Schedule", format: "number" },
          { key: "completedHours", label: "Completed Hours", format: "number" },
        ],
      };
    }
    case "rental-asset-availability":
      return {
        sql: `SELECT ra.asset_code AS assetCode,
                     ra.asset_name AS asset,
                     ra.asset_status AS assetStatus,
                     ra.rate_unit AS rateUnit,
                     COALESCE(SUM(rm.maintenance_status IN ('Scheduled','In Progress')), 0) AS activeMaintenance
                FROM rental_assets ra
                LEFT JOIN rental_maintenance_periods rm ON rm.rental_asset_id = ra.rental_asset_id
               WHERE (? IS NULL OR ra.rental_asset_id = ?)
               GROUP BY ra.rental_asset_id
               ORDER BY ra.asset_name`,
        values: [filters.rentalAssetId ?? null, filters.rentalAssetId ?? null],
        columns: [
          { key: "assetCode", label: "Asset Code" },
          { key: "asset", label: "Asset" },
          { key: "assetStatus", label: "Asset Status" },
          { key: "rateUnit", label: "Rate Unit" },
          {
            key: "activeMaintenance",
            label: "Active Maintenance",
            format: "number",
          },
        ],
      };
    case "maintenance-history": {
      const conditions = ["1 = 1"];
      const values: Array<string | number> = [];
      addDateRange(conditions, values, "rm.start_datetime", filters);
      addEquals(
        conditions,
        values,
        "rm.rental_asset_id",
        filters.rentalAssetId,
      );
      return {
        sql: `SELECT ra.asset_name AS asset,
                     rm.maintenance_type AS maintenanceType,
                     rm.start_datetime AS startDate,
                     rm.end_datetime AS endDate,
                     rm.operational_impact AS impact,
                     rm.maintenance_status AS status,
                     rm.cost
                FROM rental_maintenance_periods rm
                JOIN rental_assets ra ON ra.rental_asset_id = rm.rental_asset_id
               WHERE ${conditions.join(" AND ")}
               ORDER BY rm.start_datetime DESC`,
        values,
        columns: [
          { key: "asset", label: "Asset" },
          { key: "maintenanceType", label: "Maintenance" },
          { key: "startDate", label: "Start", format: "datetime" },
          { key: "endDate", label: "End", format: "datetime" },
          { key: "impact", label: "Operational Impact" },
          { key: "status", label: "Status" },
          { key: "cost", label: "Stored Cost", format: "currency" },
        ],
      };
    }
    case "sales-summary":
    case "bulk-orders":
    case "preorders": {
      const conditions = ["1 = 1"];
      const values: Array<string | number> = [];
      addDateRange(conditions, values, "ps.sale_date", filters);
      if (definition.key === "bulk-orders")
        conditions.push("ps.sale_type = 'Bulk Order'");
      if (definition.key === "preorders")
        conditions.push("ps.sale_type = 'Preorder'");
      return {
        sql: `SELECT ps.sale_number AS saleReference,
                     ps.sale_date AS saleDate,
                     ps.sale_type AS saleType,
                     ps.sale_status AS saleStatus,
                     ps.payment_status AS paymentStatus,
                     ps.total_amount AS totalAmount
                FROM pos_sales ps
               WHERE ${conditions.join(" AND ")}
               ORDER BY ps.sale_date DESC`,
        values,
        columns: [
          { key: "saleReference", label: "Sale" },
          { key: "saleDate", label: "Date", format: "datetime" },
          { key: "saleType", label: "Type" },
          { key: "saleStatus", label: "Sale Status" },
          { key: "paymentStatus", label: "Payment Status" },
          { key: "totalAmount", label: "Amount", format: "currency" },
        ],
      };
    }
    case "sales-by-product":
    case "sales-by-category": {
      const group =
        definition.key === "sales-by-product"
          ? "psi.product_name_snapshot"
          : "COALESCE(p.category, 'Not recorded')";
      const conditions = [
        "ps.sale_status IN ('Paid','Completed')",
        "ps.payment_status = 'Paid'",
      ];
      const values: Array<string | number> = [];
      addDateRange(conditions, values, "ps.sale_date", filters);
      addEquals(conditions, values, "psi.product_id", filters.productId);
      addEquals(conditions, values, "p.category", filters.productCategory);
      return {
        sql: `SELECT ${group} AS item,
                     SUM(psi.quantity) AS quantity,
                     SUM(psi.line_total) AS salesAmount,
                     COUNT(DISTINCT ps.pos_sale_id) AS sales
                FROM pos_sale_items psi
                JOIN pos_sales ps ON ps.pos_sale_id = psi.pos_sale_id
                JOIN products p ON p.product_id = psi.product_id
               WHERE ${conditions.join(" AND ")}
               GROUP BY ${group}
               ORDER BY salesAmount DESC, item`,
        values,
        columns: [
          {
            key: "item",
            label:
              definition.key === "sales-by-product" ? "Product" : "Category",
          },
          { key: "quantity", label: "Quantity", format: "number" },
          { key: "sales", label: "Sales", format: "number" },
          { key: "salesAmount", label: "Sales Amount", format: "currency" },
        ],
      };
    }
    case "pos-payment-status": {
      const conditions = ["1 = 1"];
      const values: Array<string | number> = [];
      addDateRange(conditions, values, "ps.sale_date", filters);
      addEquals(conditions, values, "ps.payment_status", filters.paymentStatus);
      return {
        sql: `SELECT ps.payment_status AS paymentStatus,
                     COUNT(*) AS sales,
                     SUM(ps.total_amount) AS totalAmount,
                     SUM(ps.amount_paid) AS amountPaid
                FROM pos_sales ps
               WHERE ${conditions.join(" AND ")}
               GROUP BY ps.payment_status
               ORDER BY sales DESC`,
        values,
        columns: [
          { key: "paymentStatus", label: "Payment Status" },
          { key: "sales", label: "Sales", format: "number" },
          { key: "totalAmount", label: "Sales Amount", format: "currency" },
          { key: "amountPaid", label: "Amount Paid", format: "currency" },
        ],
      };
    }
    case "product-inventory":
    case "low-stock": {
      const conditions = ["p.track_inventory = 1"];
      const values: Array<string | number> = [];
      addEquals(conditions, values, "p.category", filters.productCategory);
      const having =
        definition.key === "low-stock"
          ? "HAVING stockBalance <= p.reorder_level"
          : "";
      return {
        sql: `SELECT p.sku,
                     p.product_name AS product,
                     COALESCE(p.category, 'Not recorded') AS category,
                     COALESCE(SUM(im.quantity_change), 0) AS stockBalance,
                     p.reorder_level AS reorderLevel,
                     p.unit,
                     p.product_status AS status
                FROM products p
                LEFT JOIN inventory_movements im ON im.product_id = p.product_id
               WHERE ${conditions.join(" AND ")}
               GROUP BY p.product_id
               ${having}
               ORDER BY stockBalance, p.product_name`,
        values,
        columns: [
          { key: "sku", label: "SKU" },
          { key: "product", label: "Product" },
          { key: "category", label: "Category" },
          { key: "stockBalance", label: "Stock", format: "number" },
          { key: "reorderLevel", label: "Reorder Level", format: "number" },
          { key: "unit", label: "Unit" },
          { key: "status", label: "Status" },
        ],
      };
    }
    case "inventory-movement": {
      const conditions = ["1 = 1"];
      const values: Array<string | number> = [];
      addDateRange(conditions, values, "im.movement_date", filters);
      addEquals(conditions, values, "im.product_id", filters.productId);
      return {
        sql: `SELECT p.sku,
                     p.product_name AS product,
                     im.movement_date AS movementDate,
                     im.movement_type AS movementType,
                     im.quantity_change AS quantityChange,
                     im.reference_number AS reference,
                     u.display_name AS recordedBy
                FROM inventory_movements im
                JOIN products p ON p.product_id = im.product_id
                JOIN users u ON u.user_id = im.recorded_by
               WHERE ${conditions.join(" AND ")}
               ORDER BY im.movement_date DESC`,
        values,
        columns: [
          { key: "sku", label: "SKU" },
          { key: "product", label: "Product" },
          { key: "movementDate", label: "Date", format: "datetime" },
          { key: "movementType", label: "Movement" },
          { key: "quantityChange", label: "Quantity Change", format: "number" },
          { key: "reference", label: "Reference" },
          { key: "recordedBy", label: "Recorded By" },
        ],
      };
    }
    case "product-expenses": {
      const conditions = [
        "fr.record_status = 'Active'",
        "fr.approved_by IS NOT NULL",
        "fr.source_module = 'POS'",
        "fr.record_type = 'Expense'",
      ];
      const values: Array<string | number> = [];
      addDateRange(conditions, values, "fr.record_date", filters);
      return {
        sql: `SELECT fr.record_number AS recordNumber,
                     fr.record_date AS recordDate,
                     fc.category_name AS category,
                     fr.amount,
                     fr.remarks
                FROM financial_records fr
                JOIN financial_categories fc ON fc.financial_category_id = fr.financial_category_id
               WHERE ${conditions.join(" AND ")}
               ORDER BY fr.record_date DESC`,
        values,
        columns: [
          { key: "recordNumber", label: "Record" },
          { key: "recordDate", label: "Date", format: "date" },
          { key: "category", label: "Category" },
          { key: "amount", label: "Confirmed Expense", format: "currency" },
          { key: "remarks", label: "Remarks" },
        ],
      };
    }
    case "document-register":
      return documentRegisterSpec(filters);
    case "documents-by-category":
    case "documents-by-access":
    case "documents-by-module": {
      const group =
        definition.key === "documents-by-category"
          ? "COALESCE(d.category, 'OTHER')"
          : definition.key === "documents-by-access"
            ? "d.access_level"
            : "COALESCE(d.related_module, 'UNLINKED')";
      const conditions = ["1 = 1"];
      const values: Array<string | number> = [];
      addEquals(conditions, values, "d.category", filters.documentCategory);
      addEquals(conditions, values, "d.related_module", filters.relatedModule);
      return {
        sql: `SELECT ${group} AS item,
                     COUNT(*) AS documents,
                     SUM(d.document_status = 'Archived') AS archived,
                     SUM(d.expiration_date < CURRENT_DATE() AND d.document_status <> 'Archived') AS expired
                FROM documents d
               WHERE ${conditions.join(" AND ")}
               GROUP BY ${group}
               ORDER BY documents DESC, item`,
        values,
        columns: [
          { key: "item", label: "Group" },
          { key: "documents", label: "Documents", format: "number" },
          { key: "archived", label: "Archived", format: "number" },
          { key: "expired", label: "Expired", format: "number" },
        ],
      };
    }
    case "expiring-documents":
    case "expired-documents":
    case "archived-documents": {
      const spec = documentRegisterSpec(filters);
      const condition =
        definition.key === "expiring-documents"
          ? "d.document_status <> 'Archived' AND d.expiration_date BETWEEN COALESCE(?, CURRENT_DATE()) AND COALESCE(?, DATE_ADD(CURRENT_DATE(), INTERVAL 30 DAY))"
          : definition.key === "expired-documents"
            ? "d.document_status <> 'Archived' AND d.expiration_date < CURRENT_DATE()"
            : "d.document_status = 'Archived'";
      spec.sql = spec.sql.replace(
        "WHERE 1 = 1",
        `WHERE 1 = 1 AND ${condition}`,
      );
      if (definition.key === "expiring-documents") {
        spec.values = [
          filters.dateFrom ?? "",
          filters.dateTo ?? "",
          ...spec.values,
        ];
        spec.sql = spec.sql.replaceAll(
          "COALESCE(?,",
          "COALESCE(NULLIF(?, ''),",
        );
      }
      return spec;
    }
    case "document-upload-activity": {
      const conditions = ["1 = 1"];
      const values: Array<string | number> = [];
      addDateRange(conditions, values, "d.uploaded_at", filters);
      addEquals(conditions, values, "d.uploaded_by", filters.userId);
      return {
        sql: `SELECT d.document_reference AS documentReference,
                     d.title,
                     d.category,
                     u.display_name AS uploadedBy,
                     d.access_level AS accessLevel,
                     d.uploaded_at AS uploadedAt
                FROM documents d
                JOIN users u ON u.user_id = d.uploaded_by
               WHERE ${conditions.join(" AND ")}
               ORDER BY d.uploaded_at DESC`,
        values,
        columns: [
          { key: "documentReference", label: "Reference" },
          { key: "title", label: "Document" },
          { key: "category", label: "Category" },
          { key: "uploadedBy", label: "Uploaded By" },
          { key: "accessLevel", label: "Access" },
          { key: "uploadedAt", label: "Uploaded", format: "datetime" },
        ],
      };
    }
    case "document-download-history": {
      const conditions = ["dal.access_action = 'Download'"];
      const values: Array<string | number> = [];
      addDateRange(conditions, values, "dal.accessed_at", filters);
      addEquals(conditions, values, "dal.user_id", filters.userId);
      return {
        sql: `SELECT d.document_reference AS documentReference,
                     d.title,
                     COALESCE(u.display_name, 'Public visitor') AS accessedBy,
                     dal.user_role AS role,
                     dv.version_number AS version,
                     dal.accessed_at AS accessedAt
                FROM document_access_logs dal
                JOIN documents d ON d.document_id = dal.document_id
                LEFT JOIN users u ON u.user_id = dal.user_id
                LEFT JOIN document_versions dv ON dv.document_version_id = dal.document_version_id
               WHERE ${conditions.join(" AND ")}
               ORDER BY dal.accessed_at DESC`,
        values,
        columns: [
          { key: "documentReference", label: "Reference" },
          { key: "title", label: "Document" },
          { key: "accessedBy", label: "User" },
          { key: "role", label: "Role" },
          { key: "version", label: "Version", format: "number" },
          { key: "accessedAt", label: "Downloaded", format: "datetime" },
        ],
      };
    }
    case "document-version-history": {
      const conditions = ["1 = 1"];
      const values: Array<string | number> = [];
      addDateRange(conditions, values, "dv.created_at", filters);
      addEquals(conditions, values, "dv.uploaded_by", filters.userId);
      return {
        sql: `SELECT d.document_reference AS documentReference,
                     d.title,
                     dv.version_number AS version,
                     dv.original_file_name AS fileName,
                     dv.change_note AS changeNote,
                     u.display_name AS uploadedBy,
                     dv.created_at AS uploadedAt
                FROM document_versions dv
                JOIN documents d ON d.document_id = dv.document_id
                JOIN users u ON u.user_id = dv.uploaded_by
               WHERE ${conditions.join(" AND ")}
               ORDER BY dv.created_at DESC`,
        values,
        columns: [
          { key: "documentReference", label: "Reference" },
          { key: "title", label: "Document" },
          { key: "version", label: "Version", format: "number" },
          { key: "fileName", label: "File" },
          { key: "changeNote", label: "Change Note" },
          { key: "uploadedBy", label: "Uploaded By" },
          { key: "uploadedAt", label: "Uploaded", format: "datetime" },
        ],
      };
    }
    case "role-permission-summary":
      return {
        sql: `SELECT r.role_name AS role,
                     r.role_slug AS roleKey,
                     r.is_active AS active,
                     COUNT(u.user_id) AS accounts,
                     SUM(u.account_status = 'Active') AS activeAccounts
                FROM roles r
                LEFT JOIN users u ON u.role_id = r.role_id
               WHERE (? = '' OR r.role_slug = ?)
               GROUP BY r.role_id
               ORDER BY r.role_id`,
        values: [filters.role ?? "", filters.role ?? ""],
        columns: [
          { key: "role", label: "Role" },
          { key: "roleKey", label: "Role Key" },
          { key: "active", label: "Enabled" },
          { key: "accounts", label: "Accounts", format: "number" },
          { key: "activeAccounts", label: "Active Accounts", format: "number" },
        ],
      };
    case "notification-activity": {
      const conditions = ["1 = 1"];
      const values: Array<string | number> = [];
      addDateRange(conditions, values, "n.created_at", filters);
      addEquals(conditions, values, "n.user_id", filters.userId);
      return {
        sql: `SELECT n.notification_type AS notificationType,
                     COUNT(*) AS notifications,
                     SUM(n.is_read = 1) AS readCount,
                     SUM(n.is_read = 0) AS unreadCount
                FROM notifications n
               WHERE ${conditions.join(" AND ")}
               GROUP BY n.notification_type
               ORDER BY notifications DESC`,
        values,
        columns: [
          { key: "notificationType", label: "Notification Type" },
          { key: "notifications", label: "Notifications", format: "number" },
          { key: "readCount", label: "Read", format: "number" },
          { key: "unreadCount", label: "Unread", format: "number" },
        ],
      };
    }
    case "user-activity":
    case "audit-trail":
    case "login-activity":
    case "data-change-history": {
      const conditions = ["1 = 1"];
      const values: Array<string | number> = [];
      addDateRange(conditions, values, "al.action_time", filters);
      addEquals(conditions, values, "al.user_id", filters.userId);
      addEquals(conditions, values, "r.role_slug", filters.role);
      if (filters.auditAction) {
        conditions.push("al.action LIKE ?");
        values.push(`%${filters.auditAction}%`);
      }
      if (definition.key === "login-activity")
        conditions.push("al.action LIKE 'auth.%'");
      if (definition.key === "data-change-history") {
        conditions.push(
          "(al.old_values IS NOT NULL OR al.new_values IS NOT NULL)",
        );
      }
      return {
        sql: `SELECT al.action_time AS occurredAt,
                     COALESCE(u.display_name, 'System') AS actor,
                     COALESCE(r.role_name, 'System') AS role,
                     al.action,
                     al.entity_table AS entity,
                     CAST(al.record_id AS CHAR) AS recordId,
                     al.description
                FROM audit_logs al
                LEFT JOIN users u ON u.user_id = al.user_id
                LEFT JOIN roles r ON r.role_id = u.role_id
               WHERE ${conditions.join(" AND ")}
               ORDER BY al.action_time DESC
               LIMIT 5000`,
        values,
        columns: [
          { key: "occurredAt", label: "Date and Time", format: "datetime" },
          { key: "actor", label: "Actor" },
          { key: "role", label: "Role" },
          { key: "action", label: "Action" },
          { key: "entity", label: "Entity" },
          { key: "recordId", label: "Record" },
          { key: "description", label: "Description" },
        ],
      };
    }
    default:
      throw new RecordsError(
        "This report data source is not available.",
        409,
        "REPORT_SOURCE_UNAVAILABLE",
      );
  }
}

function serializableValue(value: unknown): string | number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number" || typeof value === "string") return value;
  if (typeof value === "bigint") return Number(value);
  if (value instanceof Date) return value.toISOString();
  if (Buffer.isBuffer(value)) return value.toString("utf8");
  return String(value);
}

function mapRows(rows: RowDataPacket[], columns: ReportColumn[]) {
  return rows.map((row) =>
    Object.fromEntries(
      columns.map((column) => [column.key, serializableValue(row[column.key])]),
    ),
  );
}

async function categorySummary(
  category: ReportCategory,
  filters: ReportFilters,
) {
  const dateConditions: string[] = [];
  const values: Array<string | number> = [];
  if (category === "FINANCIAL") {
    const conditions = [
      "fr.record_status = 'Active'",
      "fr.approved_by IS NOT NULL",
      "fr.record_type IN ('Income','Expense')",
      "(fr.payment_reference_id IS NULL OR pr.validation_status = 'Validated')",
    ];
    addDateRange(conditions, values, "fr.record_date", filters);
    const [rows] = await db.query<
      (RowDataPacket & {
        income: string | number;
        expense: string | number;
        transactions: string | number;
      })[]
    >(
      `SELECT COALESCE(SUM(CASE WHEN fr.record_type = 'Income' THEN fr.amount ELSE 0 END), 0) AS income,
              COALESCE(SUM(CASE WHEN fr.record_type = 'Expense' THEN fr.amount ELSE 0 END), 0) AS expense,
              COUNT(*) AS transactions
         FROM financial_records fr
         LEFT JOIN payment_references pr ON pr.payment_reference_id = fr.payment_reference_id
        WHERE ${conditions.join(" AND ")}`,
      values,
    );
    const income = Number(rows[0]?.income ?? 0);
    const expense = Number(rows[0]?.expense ?? 0);
    return [
      { label: "Confirmed income", value: income, format: "currency" as const },
      {
        label: "Confirmed expense",
        value: expense,
        format: "currency" as const,
      },
      {
        label: "Net amount",
        value: income - expense,
        format: "currency" as const,
      },
      {
        label: "Transactions",
        value: Number(rows[0]?.transactions ?? 0),
        format: "number" as const,
      },
    ];
  }
  if (category === "MEMBERSHIP") {
    addDateRange(dateConditions, values, "mp.approved_at", filters);
    const whereDate = dateConditions.length
      ? `AND ${dateConditions.join(" AND ")}`
      : "";
    const [rows] = await db.query<
      (RowDataPacket & {
        members: string | number;
        newMembers: string | number;
        associates: string | number;
        trueMembers: string | number;
        shareCapital: string | number;
      })[]
    >(
      `SELECT COUNT(DISTINCT CASE WHEN mp.approval_status = 'Approved' THEN mp.member_id END) AS members,
              COUNT(DISTINCT CASE WHEN mp.approval_status = 'Approved' ${whereDate} THEN mp.member_id END) AS newMembers,
              COUNT(DISTINCT CASE WHEN mp.approval_status = 'Approved' AND mp.membership_type = 'Associate' THEN mp.member_id END) AS associates,
              COUNT(DISTINCT CASE WHEN mp.approval_status = 'Approved' AND mp.membership_type = 'True Member' THEN mp.member_id END) AS trueMembers,
              COALESCE((SELECT SUM(amount) FROM share_capital_payments WHERE payment_status = 'Validated'), 0) AS shareCapital
         FROM member_profiles mp`,
      values,
    );
    return [
      {
        label: "Approved members",
        value: Number(rows[0]?.members ?? 0),
        format: "number" as const,
      },
      {
        label: "New in period",
        value: Number(rows[0]?.newMembers ?? 0),
        format: "number" as const,
      },
      {
        label: "Associate members",
        value: Number(rows[0]?.associates ?? 0),
        format: "number" as const,
      },
      {
        label: "True members",
        value: Number(rows[0]?.trueMembers ?? 0),
        format: "number" as const,
      },
      {
        label: "Validated share capital",
        value: Number(rows[0]?.shareCapital ?? 0),
        format: "currency" as const,
      },
    ];
  }
  if (category === "RENTAL") {
    const conditions = ["1 = 1"];
    addDateRange(conditions, values, "rb.start_datetime", filters);
    const [rows] = await db.query<
      (RowDataPacket & {
        bookings: string | number;
        completed: string | number;
      })[]
    >(
      `SELECT COUNT(*) AS bookings, SUM(rb.booking_status = 'Completed') AS completed
         FROM rental_bookings rb WHERE ${conditions.join(" AND ")}`,
      values,
    );
    const ledgerFilters = financialLedgerSpec(filters);
    const [ledgerRows] = await db.query<RowDataPacket[]>(
      `${ledgerFilters.sql.replace(
        "ORDER BY fr.record_date DESC, fr.financial_record_id DESC",
        "",
      )}`,
      ledgerFilters.values,
    );
    let income = 0;
    let expense = 0;
    for (const row of ledgerRows) {
      if (row.source !== "Rental") continue;
      if (row.recordType === "Income") income += Number(row.amount ?? 0);
      if (row.recordType === "Expense") expense += Number(row.amount ?? 0);
    }
    return [
      {
        label: "Bookings",
        value: Number(rows[0]?.bookings ?? 0),
        format: "number" as const,
      },
      {
        label: "Completed",
        value: Number(rows[0]?.completed ?? 0),
        format: "number" as const,
      },
      {
        label: "Confirmed rental income",
        value: income,
        format: "currency" as const,
      },
      {
        label: "Confirmed rental expense",
        value: expense,
        format: "currency" as const,
      },
      {
        label: "Net rental result",
        value: income - expense,
        format: "currency" as const,
      },
    ];
  }
  if (category === "DOCUMENTS") {
    const [rows] = await db.query<
      (RowDataPacket & {
        documents: string | number;
        archived: string | number;
        expiring: string | number;
      })[]
    >(
      `SELECT COUNT(*) AS documents,
              SUM(document_status = 'Archived') AS archived,
              SUM(document_status <> 'Archived' AND expiration_date BETWEEN CURRENT_DATE() AND DATE_ADD(CURRENT_DATE(), INTERVAL 30 DAY)) AS expiring
         FROM documents`,
    );
    return [
      {
        label: "Documents",
        value: Number(rows[0]?.documents ?? 0),
        format: "number" as const,
      },
      {
        label: "Archived",
        value: Number(rows[0]?.archived ?? 0),
        format: "number" as const,
      },
      {
        label: "Expiring soon",
        value: Number(rows[0]?.expiring ?? 0),
        format: "number" as const,
      },
    ];
  }
  return [];
}

function periodLabel(filters: ReportFilters) {
  if (filters.dateFrom || filters.dateTo) {
    return `${filters.dateFrom ?? "Beginning"} to ${filters.dateTo ?? "Present"}`;
  }
  if (filters.year && filters.month)
    return `${filters.year}-${filters.month.padStart(2, "0")}`;
  if (filters.year) return filters.year;
  return "All available records";
}

function legacyReportType(definition: ReportDefinition) {
  const map: Record<ReportCategory, string> = {
    FINANCIAL: "Financial Summary",
    MEMBERSHIP: "Member Master List",
    RENTAL: "Rental",
    SALES_INVENTORY: "POS Sales",
    DOCUMENTS: "Documents",
    AUDIT_ADMINISTRATION: "Audit Logs",
    AGENCY_COOPERATIVE: "Other",
  };
  return map[definition.category];
}

async function insertReportHistory(
  connection: PoolConnection,
  definition: ReportDefinition,
  filters: ReportFilters,
  summary: ReportResult["summary"],
  user: AuthorizedUser,
  outputFormat: string,
  metadata?: RequestMetadata,
) {
  const temporaryReference = `RPT-TMP-${randomUUID()}`;
  const [result] = await connection.query<ResultSetHeader>(
    `INSERT INTO reports (
      report_number, generated_by, report_type, report_key, report_title,
      report_category, report_period_start, report_period_end, report_period_label,
      filters_json, summary_json, output_format, generation_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Generated')`,
    [
      temporaryReference,
      user.numericId,
      legacyReportType(definition),
      definition.key,
      definition.name,
      definition.category,
      filters.dateFrom ?? null,
      filters.dateTo ?? null,
      periodLabel(filters),
      JSON.stringify(filters),
      JSON.stringify(summary),
      outputFormat,
    ],
  );
  const reference = `RPT-${new Date().getFullYear()}-${String(result.insertId).padStart(6, "0")}`;
  await connection.query(
    "UPDATE reports SET report_number = ? WHERE report_id = ?",
    [reference, result.insertId],
  );
  await connection.query(
    `INSERT INTO audit_logs
       (user_id, action, entity_table, record_id, description, new_values, ip_address, user_agent)
     VALUES (?, 'report.generated', 'reports', ?, 'A database-backed report was generated.', ?, ?, ?)`,
    [
      user.numericId,
      result.insertId,
      JSON.stringify({
        reportReference: reference,
        reportKey: definition.key,
        filters,
        outputFormat,
      }),
      metadata?.ipAddress ?? null,
      metadata?.userAgent?.slice(0, 500) ?? null,
    ],
  );
  return { id: String(result.insertId), reference };
}

export async function generateReport(
  reportKey: string,
  sourceFilters: ReportFilters,
  user: AuthorizedUser,
  options: {
    record?: boolean;
    outputFormat?: string;
    metadata?: RequestMetadata;
  } = {},
): Promise<ReportResult> {
  const definition = definitionFor(reportKey);
  ensureAuthorized(definition, user);
  const filters = validateFilters(definition, sourceFilters);
  const spec = reportQuery(definition, filters);
  const [sourceRows] = await db.query<RowDataPacket[]>(spec.sql, spec.values);
  const rows = mapRows(sourceRows, spec.columns);
  const summary = await categorySummary(definition.category, filters);
  let history = { id: "", reference: "" };
  if (options.record !== false) {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      history = await insertReportHistory(
        connection,
        definition,
        filters,
        summary,
        user,
        options.outputFormat ?? "PREVIEW",
        options.metadata,
      );
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
  return {
    reportId: history.id,
    reportReference: history.reference,
    reportKey: definition.key,
    reportName: definition.name,
    category: definition.category,
    generatedAt: new Date().toISOString(),
    generatedBy: user.displayName,
    periodLabel: periodLabel(filters),
    appliedFilters: filters,
    summary,
    columns: spec.columns,
    rows,
    total: rows.length,
  };
}

function formattedCell(
  value: string | number | null,
  format: ReportColumn["format"],
) {
  if (value === null || value === "") return "—";
  if (format === "currency") return currencyFormatter.format(Number(value));
  if (format === "number")
    return new Intl.NumberFormat("en-PH").format(Number(value));
  if (format === "date" || format === "datetime") {
    const date = new Date(String(value));
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat("en-PH", {
      dateStyle: "medium",
      ...(format === "datetime" ? { timeStyle: "short" as const } : {}),
      timeZone: "Asia/Manila",
    }).format(date);
  }
  return String(value);
}

function csvCell(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

export function reportToCsv(result: ReportResult) {
  const header = result.columns
    .map((column) => csvCell(column.label))
    .join(",");
  const rows = result.rows.map((row) =>
    result.columns
      .map((column) =>
        csvCell(formattedCell(row[column.key] ?? null, column.format)),
      )
      .join(","),
  );
  return `\uFEFF${header}\r\n${rows.join("\r\n")}`;
}

export async function reportToPdf(result: ReportResult) {
  const document = new PDFDocument({
    size: "A4",
    margin: 42,
    bufferPages: true,
  });
  const chunks: Buffer[] = [];
  document.on("data", (chunk: Buffer) => chunks.push(chunk));
  const completed = new Promise<Buffer>((resolve, reject) => {
    document.on("end", () => resolve(Buffer.concat(chunks)));
    document.on("error", reject);
  });

  document
    .fontSize(9)
    .fillColor("#365F4A")
    .text("Nasugbu Farmers and Fisherfolks Agriculture Cooperative", {
      align: "center",
    });
  document
    .fontSize(8)
    .text("TrackCOOP – System-Generated Report", { align: "center" });
  document.moveDown(0.6);
  document
    .fontSize(18)
    .fillColor("#123D2A")
    .text(result.reportName, { align: "center" });
  document
    .fontSize(9)
    .fillColor("#4A574F")
    .text(
      `${result.periodLabel} · Generated ${formattedCell(result.generatedAt, "datetime")} · ${result.generatedBy}`,
      { align: "center" },
    );
  if (result.reportReference) {
    document.text(`Report reference: ${result.reportReference}`, {
      align: "center",
    });
  }
  const appliedFilters = Object.entries(result.appliedFilters)
    .filter(([, value]) => Boolean(value))
    .map(([key, value]) => `${key}: ${value}`)
    .join("; ");
  document
    .fontSize(7)
    .text(`Applied filters: ${appliedFilters || "None"}`, { align: "center" });
  document.moveDown();
  for (const item of result.summary) {
    const value =
      item.format === "currency"
        ? currencyFormatter.format(Number(item.value))
        : new Intl.NumberFormat("en-PH").format(Number(item.value));
    document.fontSize(9).fillColor("#17211C").text(`${item.label}: ${value}`);
  }
  document.moveDown();

  const widths = result.columns.map(() =>
    Math.max(58, Math.floor(510 / Math.max(result.columns.length, 1))),
  );
  const tableWidth = widths.reduce((sum, width) => sum + width, 0);
  if (tableWidth > 510) {
    const scale = 510 / tableWidth;
    widths.forEach((width, index) => {
      widths[index] = Math.floor(width * scale);
    });
  }
  const drawHeader = () => {
    const y = document.y;
    let x = document.page.margins.left;
    document.rect(x, y, 510, 22).fill("#E7F2E4");
    result.columns.forEach((column, index) => {
      document
        .fillColor("#123D2A")
        .fontSize(6.5)
        .text(column.label, x + 3, y + 6, { width: widths[index] - 6 });
      x += widths[index];
    });
    document.y = y + 25;
  };
  drawHeader();
  for (const row of result.rows) {
    if (document.y > 748) {
      document.addPage();
      drawHeader();
    }
    const y = document.y;
    let x = document.page.margins.left;
    result.columns.forEach((column, index) => {
      document
        .fillColor("#17211C")
        .fontSize(6.5)
        .text(
          formattedCell(row[column.key] ?? null, column.format),
          x + 3,
          y + 3,
          {
            width: widths[index] - 6,
            height: 24,
            ellipsis: true,
          },
        );
      x += widths[index];
    });
    document
      .moveTo(document.page.margins.left, y + 28)
      .lineTo(document.page.margins.left + 510, y + 28)
      .strokeColor("#D9E1DC")
      .stroke();
    document.y = y + 31;
  }
  if (result.rows.length === 0) {
    document
      .fontSize(9)
      .fillColor("#5D6D63")
      .text("No data matched the selected filters.");
  }
  document.moveDown();
  document
    .fontSize(7)
    .fillColor("#6C7A70")
    .text(
      `${result.total} record(s). This TrackCOOP-generated report is not an audited financial statement.`,
    );
  const pages = document.bufferedPageRange();
  for (let index = pages.start; index < pages.start + pages.count; index += 1) {
    document.switchToPage(index);
    document
      .fontSize(7)
      .fillColor("#6C7A70")
      .text(
        `Page ${index - pages.start + 1} of ${pages.count} · ${result.reportReference || "Preview"} · System generated`,
        document.page.margins.left,
        document.page.height - 28,
        {
          width:
            document.page.width -
            document.page.margins.left -
            document.page.margins.right,
          align: "center",
          lineBreak: false,
        },
      );
  }
  document.end();
  return completed;
}

export async function listGeneratedReports(
  user: AuthorizedUser,
): Promise<GeneratedReportRecord[]> {
  const allowedCategories =
    user.role === "chairman"
      ? null
      : ["FINANCIAL", "RENTAL", "SALES_INVENTORY"];
  const [rows] = await db.query<ReportHistoryRow[]>(
    `SELECT CAST(r.report_id AS CHAR) AS id,
            r.report_number AS reference,
            r.report_key AS reportKey,
            r.report_title AS title,
            r.report_type AS legacyType,
            r.report_category AS category,
            r.report_period_label AS periodLabel,
            u.display_name AS generatedBy,
            r.generated_at AS generatedAt,
            r.output_format AS outputFormat,
            r.generation_status AS status,
            CAST(r.document_id AS CHAR) AS documentId,
            d.document_reference AS documentReference,
            r.filters_json AS filtersJson
       FROM reports r
       JOIN users u ON u.user_id = r.generated_by
       LEFT JOIN documents d ON d.document_id = r.document_id
      WHERE (? IS NULL OR FIND_IN_SET(r.report_category, ?) > 0)
      ORDER BY r.generated_at DESC, r.report_id DESC
      LIMIT 500`,
    [
      allowedCategories ? "restricted" : null,
      allowedCategories?.join(",") ?? "",
    ],
  );
  return rows.map((row) => ({
    id: row.id,
    reference: row.reference,
    reportKey: row.reportKey ?? "legacy-report",
    title: row.title ?? row.legacyType,
    category: row.category ?? "AUDIT_ADMINISTRATION",
    periodLabel: row.periodLabel,
    generatedBy: row.generatedBy,
    generatedAt: row.generatedAt,
    outputFormat: row.outputFormat ?? "PREVIEW",
    status: row.status,
    documentId: row.documentId,
    documentReference: row.documentReference,
    filters: parseStoredFilters(row.filtersJson),
  }));
}

function parseStoredFilters(value: string | null): ReportFilters {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      return {};
    return Object.fromEntries(
      Object.entries(parsed)
        .filter(
          (entry): entry is [string, string] => typeof entry[1] === "string",
        )
        .map(([key, filterValue]) => [key, filterValue.slice(0, 190)]),
    ) as ReportFilters;
  } catch {
    return {};
  }
}

export async function saveGeneratedReportToDocuments(
  reportId: string,
  accessLevel: DocumentAccessLevel,
  user: AuthorizedUser,
  metadata?: RequestMetadata,
) {
  if (!/^\d+$/.test(reportId)) {
    throw new RecordsError(
      "Generated report not found.",
      404,
      "REPORT_NOT_FOUND",
    );
  }
  if (
    !["PUBLIC", "MEMBER_ONLY", "ADMIN_ONLY", "BOOKKEEPER_ONLY"].includes(
      accessLevel,
    )
  ) {
    throw new RecordsError(
      "Select a valid document access level.",
      422,
      "INVALID_ACCESS",
    );
  }
  if (user.role === "bookkeeper" && accessLevel === "ADMIN_ONLY") {
    throw new RecordsError(
      "Bookkeepers cannot create admin-only documents.",
      403,
      "ACCESS_FORBIDDEN",
    );
  }
  const [storedRows] = await db.query<StoredReportRow[]>(
    `SELECT CAST(report_id AS CHAR) AS id, report_number AS reference,
            report_key AS reportKey, report_title AS title,
            report_category AS category, filters_json AS filtersJson,
            CAST(document_id AS CHAR) AS documentId
       FROM reports WHERE report_id = ? LIMIT 1`,
    [reportId],
  );
  const storedReport = storedRows[0];
  if (!storedReport?.reportKey) {
    throw new RecordsError(
      "Generated report not found.",
      404,
      "REPORT_NOT_FOUND",
    );
  }
  const definition = definitionFor(storedReport.reportKey);
  ensureAuthorized(definition, user);
  if (storedReport.documentId) {
    return { documentId: storedReport.documentId, alreadySaved: true };
  }
  const generated = await generateReport(
    definition.key,
    parseStoredFilters(storedReport.filtersJson),
    user,
    { record: false },
  );
  if (generated.rows.length === 0) {
    throw new RecordsError(
      "A report with no matching source data cannot be saved as a document.",
      409,
      "REPORT_HAS_NO_DATA",
    );
  }
  generated.reportId = reportId;
  generated.reportReference = storedReport.reference;
  const pdf = await reportToPdf(generated);
  const safeName = `${storedReport.reference}-${definition.key}.pdf`;
  const checksum = createHash("sha256").update(pdf).digest("hex");
  const stored = await storeProtectedDocument(
    {
      buffer: pdf,
      originalFileName: safeName,
      extension: "pdf",
      mimeType: "application/pdf",
      size: pdf.length,
      checksum,
    },
    "reports",
  );
  const databaseAccess: Record<DocumentAccessLevel, string> = {
    PUBLIC: "Public",
    MEMBER_ONLY: "Member-only",
    ADMIN_ONLY: "Admin-only",
    BOOKKEEPER_ONLY: "Bookkeeper-only",
  };
  const documentCategory: Record<ReportCategory, string> = {
    FINANCIAL: "FINANCIAL",
    MEMBERSHIP: "MEMBERSHIP",
    RENTAL: "RENTAL",
    SALES_INVENTORY: "POS_AND_SALES",
    DOCUMENTS: "AUDIT",
    AUDIT_ADMINISTRATION: "AUDIT",
    AGENCY_COOPERATIVE: "AGENCY_REPORT",
  };
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [locked] = await connection.query<StoredReportRow[]>(
      `SELECT CAST(report_id AS CHAR) AS id, report_number AS reference,
              report_key AS reportKey, report_title AS title,
              report_category AS category, filters_json AS filtersJson,
              CAST(document_id AS CHAR) AS documentId
         FROM reports WHERE report_id = ? FOR UPDATE`,
      [reportId],
    );
    if (!locked[0] || locked[0].documentId) {
      throw new RecordsError(
        locked[0]?.documentId
          ? "This report is already linked to a document."
          : "Generated report not found.",
        locked[0]?.documentId ? 409 : 404,
        locked[0]?.documentId ? "REPORT_ALREADY_SAVED" : "REPORT_NOT_FOUND",
      );
    }
    const [documentResult] = await connection.query<ResultSetHeader>(
      `INSERT INTO documents (
        document_reference, uploaded_by, title, category, document_type,
        access_level, document_status, file_path, original_file_name, mime_type,
        file_size_bytes, checksum_sha256, description, related_module,
        related_record_id, related_record_reference, relationship_type, document_date,
        current_version
      ) VALUES (?, ?, ?, ?, ?, ?, 'Active', ?, ?, 'application/pdf', ?, ?, ?,
                'REPORT', ?, ?, 'GENERATED_FROM', CURRENT_DATE(), 1)`,
      [
        `DOC-TMP-${randomUUID()}`,
        user.numericId,
        definition.name,
        documentCategory[definition.category],
        definition.category === "FINANCIAL"
          ? "Financial Document"
          : "Agency Report",
        databaseAccess[accessLevel],
        stored.storagePath,
        safeName,
        pdf.length,
        checksum,
        `System-generated ${definition.name}. ${generated.periodLabel}.`,
        reportId,
        storedReport.reference,
      ],
    );
    const documentReference = `DOC-${new Date().getFullYear()}-${String(documentResult.insertId).padStart(6, "0")}`;
    await connection.query(
      "UPDATE documents SET document_reference = ? WHERE document_id = ?",
      [documentReference, documentResult.insertId],
    );
    const [versionResult] = await connection.query<ResultSetHeader>(
      `INSERT INTO document_versions (
        document_id, version_number, original_file_name, stored_file_name,
        storage_path, mime_type, file_extension, file_size_bytes, checksum_sha256,
        change_note, uploaded_by
      ) VALUES (?, 1, ?, ?, ?, 'application/pdf', 'pdf', ?, ?,
                'Initial system-generated report version.', ?)`,
      [
        documentResult.insertId,
        safeName,
        stored.storedFileName,
        stored.storagePath,
        pdf.length,
        checksum,
        user.numericId,
      ],
    );
    await connection.query(
      `UPDATE reports
          SET document_id = ?, file_path = ?, output_format = 'PDF',
              summary_json = ?
        WHERE report_id = ?`,
      [
        documentResult.insertId,
        stored.storagePath,
        JSON.stringify(generated.summary),
        reportId,
      ],
    );
    await connection.query(
      `INSERT INTO document_access_logs
         (document_id, document_version_id, user_id, user_role, access_action, ip_address, user_agent)
       VALUES (?, ?, ?, ?, 'Upload', ?, ?)`,
      [
        documentResult.insertId,
        versionResult.insertId,
        user.numericId,
        user.role,
        metadata?.ipAddress ?? null,
        metadata?.userAgent?.slice(0, 500) ?? null,
      ],
    );
    await connection.query(
      `INSERT INTO audit_logs
         (user_id, action, entity_table, record_id, description, new_values, ip_address, user_agent)
       VALUES
         (?, 'report.saved_to_documents', 'reports', ?, 'A generated report was saved to protected Documents storage.', ?, ?, ?),
         (?, 'document.generated', 'documents', ?, 'A protected document was generated from a report.', ?, ?, ?)`,
      [
        user.numericId,
        reportId,
        JSON.stringify({
          documentId: documentResult.insertId,
          documentReference,
          accessLevel,
        }),
        metadata?.ipAddress ?? null,
        metadata?.userAgent?.slice(0, 500) ?? null,
        user.numericId,
        documentResult.insertId,
        JSON.stringify({ reportId, reportReference: storedReport.reference }),
        metadata?.ipAddress ?? null,
        metadata?.userAgent?.slice(0, 500) ?? null,
      ],
    );
    await connection.query(
      `INSERT INTO notifications
        (user_id, notification_type, title, message, related_entity_type, related_entity_id)
       SELECT u.user_id, 'Document', 'Report saved to Documents',
              CONCAT(?, ' is available in Documents.'), 'Document', ?
         FROM users u JOIN roles r ON r.role_id = u.role_id
        WHERE r.role_slug = 'chairman' AND u.account_status = 'Active'
          AND u.user_id <> ?`,
      [definition.name, documentResult.insertId, user.numericId],
    );
    await connection.commit();
    return {
      documentId: String(documentResult.insertId),
      documentReference,
      alreadySaved: false,
    };
  } catch (error) {
    await connection.rollback();
    await unlink(stored.absolutePath).catch(() => undefined);
    throw error;
  } finally {
    connection.release();
  }
}

export async function archiveGeneratedReport(
  reportId: string,
  reason: string,
  user: AuthorizedUser,
  metadata?: RequestMetadata,
) {
  if (!/^\d+$/.test(reportId) || reason.trim().length < 3) {
    throw new RecordsError(
      "Provide a valid archive reason.",
      422,
      "ARCHIVE_REASON_REQUIRED",
    );
  }
  const [rows] = await db.query<StoredReportRow[]>(
    `SELECT CAST(report_id AS CHAR) AS id, report_number AS reference,
            report_key AS reportKey, report_title AS title,
            report_category AS category, filters_json AS filtersJson,
            CAST(document_id AS CHAR) AS documentId
       FROM reports WHERE report_id = ? LIMIT 1`,
    [reportId],
  );
  if (!rows[0]?.reportKey) {
    throw new RecordsError(
      "Generated report not found.",
      404,
      "REPORT_NOT_FOUND",
    );
  }
  ensureAuthorized(definitionFor(rows[0].reportKey), user);
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query(
      `UPDATE reports SET generation_status = 'Archived',
          archived_at = NOW(), archive_reason = ? WHERE report_id = ?`,
      [reason.trim().slice(0, 5000), reportId],
    );
    await connection.query(
      `INSERT INTO audit_logs
         (user_id, action, entity_table, record_id, description, new_values, ip_address, user_agent)
       VALUES (?, 'report.archived', 'reports', ?, 'A generated report record was archived.', ?, ?, ?)`,
      [
        user.numericId,
        reportId,
        JSON.stringify({ reason: reason.trim().slice(0, 5000) }),
        metadata?.ipAddress ?? null,
        metadata?.userAgent?.slice(0, 500) ?? null,
      ],
    );
    await connection.commit();
    return { archived: true };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function recordReportAction(
  reportId: string,
  action: "report.exported" | "report.printed" | "report.sensitive_accessed",
  user: AuthorizedUser,
  metadata?: RequestMetadata,
) {
  if (!/^\d+$/.test(reportId)) {
    throw new RecordsError(
      "Generated report not found.",
      404,
      "REPORT_NOT_FOUND",
    );
  }
  const [rows] = await db.query<StoredReportRow[]>(
    `SELECT CAST(report_id AS CHAR) AS id, report_number AS reference,
            report_key AS reportKey, report_title AS title,
            report_category AS category, filters_json AS filtersJson,
            CAST(document_id AS CHAR) AS documentId
       FROM reports WHERE report_id = ? LIMIT 1`,
    [reportId],
  );
  if (!rows[0]?.reportKey) {
    throw new RecordsError(
      "Generated report not found.",
      404,
      "REPORT_NOT_FOUND",
    );
  }
  ensureAuthorized(definitionFor(rows[0].reportKey), user);
  await db.query(
    `INSERT INTO audit_logs
       (user_id, action, entity_table, record_id, description, ip_address, user_agent)
     VALUES (?, ?, 'reports', ?, ?, ?, ?)`,
    [
      user.numericId,
      action,
      reportId,
      action === "report.printed"
        ? "A generated report was printed."
        : action === "report.exported"
          ? "A generated report was exported."
          : "A sensitive generated report was accessed.",
      metadata?.ipAddress ?? null,
      metadata?.userAgent?.slice(0, 500) ?? null,
    ],
  );
  return { recorded: true };
}

export async function recordReportRegisterExport(
  user: AuthorizedUser,
  metadata?: RequestMetadata,
) {
  await db.query(
    `INSERT INTO audit_logs
       (user_id, action, entity_table, description, ip_address, user_agent)
     VALUES (?, 'report.register_exported', 'reports',
             'The generated report register was exported.', ?, ?)`,
    [
      user.numericId,
      metadata?.ipAddress ?? null,
      metadata?.userAgent?.slice(0, 500) ?? null,
    ],
  );
}

export function reportCatalogFor(user: AuthorizedUser) {
  return REPORT_CATALOG.filter((definition) =>
    definition.allowedRoles.includes(user.role),
  );
}

export function reportCatalogSummary(user: AuthorizedUser) {
  const catalog = reportCatalogFor(user);
  return {
    available: catalog.filter((item) => !item.configurationRequired).length,
    financial: catalog.filter((item) => item.category === "FINANCIAL").length,
    operational: catalog.filter((item) =>
      ["RENTAL", "SALES_INVENTORY", "DOCUMENTS"].includes(item.category),
    ).length,
    categoryLabels: REPORT_CATEGORY_LABELS,
  };
}

export async function getReportFilterOptions(
  user: AuthorizedUser,
): Promise<ReportFilterOptions> {
  const [
    barangays,
    sectors,
    paymentMethods,
    rentalAssets,
    products,
    productCategories,
    documentCategories,
    relatedModules,
    users,
    roles,
  ] = await Promise.all([
    db.query<(RowDataPacket & { value: string })[]>(
      "SELECT DISTINCT barangay AS value FROM member_profiles WHERE barangay IS NOT NULL AND barangay <> '' ORDER BY barangay",
    ),
    db.query<(RowDataPacket & { value: string })[]>(
      "SELECT DISTINCT sector AS value FROM member_profiles WHERE sector IS NOT NULL AND sector <> '' ORDER BY sector",
    ),
    db.query<(RowDataPacket & { value: string })[]>(
      "SELECT DISTINCT provider AS value FROM payment_references WHERE provider <> '' ORDER BY provider",
    ),
    db.query<(RowDataPacket & { id: string; label: string })[]>(
      "SELECT CAST(rental_asset_id AS CHAR) AS id, CONCAT(asset_code, ' · ', asset_name) AS label FROM rental_assets ORDER BY asset_name",
    ),
    db.query<(RowDataPacket & { id: string; label: string })[]>(
      "SELECT CAST(product_id AS CHAR) AS id, CONCAT(sku, ' · ', product_name) AS label FROM products ORDER BY product_name",
    ),
    db.query<(RowDataPacket & { value: string })[]>(
      "SELECT DISTINCT category AS value FROM products WHERE category IS NOT NULL AND category <> '' ORDER BY category",
    ),
    db.query<(RowDataPacket & { value: string })[]>(
      "SELECT DISTINCT category AS value FROM documents WHERE category IS NOT NULL AND category <> '' ORDER BY category",
    ),
    db.query<(RowDataPacket & { value: string })[]>(
      "SELECT DISTINCT related_module AS value FROM documents WHERE related_module IS NOT NULL AND related_module <> '' ORDER BY related_module",
    ),
    user.role === "chairman"
      ? db.query<(RowDataPacket & { id: string; label: string })[]>(
          "SELECT CAST(user_id AS CHAR) AS id, display_name AS label FROM users ORDER BY display_name",
        )
      : Promise.resolve([[], []] as unknown as [
          Array<RowDataPacket & { id: string; label: string }>,
          unknown,
        ]),
    user.role === "chairman"
      ? db.query<(RowDataPacket & { value: string; label: string })[]>(
          "SELECT role_slug AS value, role_name AS label FROM roles WHERE is_active = 1 ORDER BY role_id",
        )
      : Promise.resolve([[], []] as unknown as [
          Array<RowDataPacket & { value: string; label: string }>,
          unknown,
        ]),
  ]);
  return {
    barangays: barangays[0].map((row) => row.value),
    sectors: sectors[0].map((row) => row.value),
    paymentMethods: paymentMethods[0].map((row) => row.value),
    rentalAssets: rentalAssets[0],
    products: products[0],
    productCategories: productCategories[0].map((row) => row.value),
    documentCategories: documentCategories[0].map((row) => row.value),
    relatedModules: relatedModules[0].map((row) => row.value),
    users: users[0],
    roles: roles[0],
  };
}
