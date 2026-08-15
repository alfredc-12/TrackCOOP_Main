import type { RowDataPacket } from "mysql2/promise";
import { db } from "../src/lib/db";
import type { AuthorizedUser } from "../src/lib/next-api-auth";
import {
  getDocumentDetail,
  getDocumentFile,
  listDocuments,
  setDocumentArchived,
  uploadDocument,
} from "../src/features/records/server/document-service";
import { RecordsError } from "../src/features/records/server/records-error";
import {
  generateReport,
  saveGeneratedReportToDocuments,
} from "../src/features/records/server/report-service";

type UserRow = RowDataPacket & {
  id: string;
  displayName: string;
  email: string;
  username: string | null;
  role: "chairman" | "bookkeeper" | "member";
};

function file(name: string, content: string) {
  const buffer = Buffer.from(`%PDF-1.4\n${content}\n%%EOF`);
  return {
    name,
    size: buffer.length,
    type: "application/pdf",
    async arrayBuffer() {
      return buffer.buffer.slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.byteLength,
      ) as ArrayBuffer;
    },
  };
}

async function userFor(role: UserRow["role"]): Promise<AuthorizedUser> {
  const [rows] = await db.query<UserRow[]>(
    `SELECT CAST(u.user_id AS CHAR) AS id, u.display_name AS displayName,
            u.email, u.username, r.role_slug AS role
       FROM users u JOIN roles r ON r.role_id = u.role_id
      WHERE r.role_slug = ? AND u.account_status = 'Active'
      ORDER BY u.user_id LIMIT 1`,
    [role],
  );
  if (!rows[0])
    throw new Error(`An active ${role} account is required for verification.`);
  return { ...rows[0], numericId: Number(rows[0].id) };
}

async function verify() {
  const chairman = await userFor("chairman");
  const bookkeeper = await userFor("bookkeeper");
  const member = await userFor("member");
  const stamp = new Date()
    .toISOString()
    .replaceAll(/[-:.TZ]/g, "")
    .slice(0, 14);
  const uploaded = await uploadDocument(
    {
      title: `Records Module Verification ${stamp}`,
      description:
        "Verification artifact for protected upload, versioning, access, archive, and restore flows.",
      category: "AUDIT",
      documentType: "Other",
      accessLevel: "ADMIN_ONLY",
      file: file(
        `records-verification-${stamp}.pdf`,
        `Initial verification ${stamp}`,
      ),
    },
    chairman,
    { ipAddress: "127.0.0.1", userAgent: "TrackCOOP records verification" },
  );
  await getDocumentFile(uploaded.id, chairman, "Download", {
    ipAddress: "127.0.0.1",
    userAgent: "TrackCOOP records verification",
  });

  const denied: string[] = [];
  for (const actor of [bookkeeper, member]) {
    try {
      await getDocumentFile(uploaded.id, actor, "Preview");
    } catch (error) {
      if (error instanceof RecordsError && error.status === 404) {
        denied.push(actor.role);
      } else {
        throw error;
      }
    }
  }

  await setDocumentArchived(
    uploaded.id,
    true,
    "Controlled archive and restore verification.",
    chairman,
  );
  const archived = await getDocumentDetail(uploaded.id, chairman);
  await setDocumentArchived(uploaded.id, false, undefined, chairman);
  const restored = await getDocumentDetail(uploaded.id, chairman);
  const receiptDocuments = await listDocuments(
    {
      category: "RECEIPT",
      page: 1,
      pageSize: 100,
    },
    chairman,
  );
  const generatedReceipt = receiptDocuments.documents[0];
  const generatedReceiptFile = generatedReceipt
    ? await getDocumentFile(generatedReceipt.id, chairman, "Preview")
    : null;

  const financial = await generateReport("financial-summary", {}, chairman, {
    outputFormat: "PREVIEW",
  });
  const membership = await generateReport("member-directory", {}, chairman, {
    record: false,
  });
  const rental = await generateReport("rental-income", {}, chairman, {
    record: false,
  });
  const saved = await saveGeneratedReportToDocuments(
    financial.reportId,
    "ADMIN_ONLY",
    chairman,
  );
  const savedDocument = await getDocumentDetail(saved.documentId, chairman);

  console.log(
    JSON.stringify(
      {
        uploadedDocument: {
          id: uploaded.id,
          reference: uploaded.reference,
          archivedStatus: archived.status,
          restoredStatus: restored.status,
          recordedDownloads: restored.accessHistory.filter(
            (activity) => activity.action === "Download",
          ).length,
        },
        restrictedAccessDeniedTo: denied,
        financialReport: {
          reference: financial.reportReference,
          records: financial.total,
          summary: financial.summary,
        },
        membershipReportRecords: membership.total,
        rentalIncomeRecords: rental.total,
        savedReportDocument: {
          id: saved.documentId,
          reference: savedDocument.reference,
        },
        generatedReceiptDocument: generatedReceipt
          ? {
              reference: generatedReceipt.reference,
              accessLevel: generatedReceipt.accessLevel,
              fileBytes: generatedReceiptFile?.contents.length ?? 0,
            }
          : null,
      },
      null,
      2,
    ),
  );
  await db.end();
}

verify().catch(async (error) => {
  console.error("Records verification failed:", error);
  await db.end().catch(() => undefined);
  process.exitCode = 1;
});
