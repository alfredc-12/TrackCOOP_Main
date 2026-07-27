import { createHash, randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { PoolConnection } from "mysql2/promise";
import PDFDocument from "pdfkit";
import {
  normalizeProtectedStoragePath,
  protectedUploadRoot,
} from "../storage/protected-storage";
import {
  createCentralDocument,
  type CentralDocumentInput,
} from "./central-document";

type GeneratedPdfDocumentInput = Omit<
  CentralDocumentInput,
  "storagePath" | "originalFileName" | "mimeType" | "fileSizeBytes" | "checksum"
> & {
  fileBaseName: string;
  heading: string;
  lines: Array<{ label: string; value: string | number | null | undefined }>;
  notice?: string;
};

function safeBaseName(value: string) {
  const normalized = value
    .normalize("NFKC")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
  return normalized || "trackcoop-document";
}

async function renderPdf(input: GeneratedPdfDocumentInput) {
  const document = new PDFDocument({ size: "A4", margin: 52 });
  const chunks: Buffer[] = [];
  document.on("data", (chunk: Buffer) => chunks.push(chunk));
  const complete = new Promise<Buffer>((resolve, reject) => {
    document.on("end", () => resolve(Buffer.concat(chunks)));
    document.on("error", reject);
  });

  document
    .fillColor("#174a32")
    .fontSize(11)
    .text("Nasugbu Farmers and Fisherfolks Agriculture Cooperative");
  document.fillColor("#52675a").fontSize(9).text("TrackCOOP Records System");
  document.moveDown(1.25);
  document.fillColor("#173d2c").fontSize(20).text(input.heading);
  document.moveDown(1);

  for (const line of input.lines) {
    const value =
      line.value === null || line.value === undefined || line.value === ""
        ? "Not recorded"
        : String(line.value);
    document.fillColor("#52675a").fontSize(9).text(line.label.toUpperCase());
    document.fillColor("#17251d").fontSize(11).text(value);
    document.moveDown(0.65);
  }

  document.moveDown(1);
  document
    .fillColor("#6b766f")
    .fontSize(8)
    .text(
      input.notice ??
        "This system-generated document reflects the source record stored in TrackCOOP.",
    );
  document.text(`Generated ${new Date().toISOString()}`);
  document.end();
  return complete;
}

export async function createGeneratedPdfDocument(
  connection: PoolConnection,
  input: GeneratedPdfDocumentInput,
) {
  const buffer = await renderPdf(input);
  const year = String(new Date().getUTCFullYear());
  const storedFileName = `${randomUUID()}.pdf`;
  const directory = path.join(protectedUploadRoot, "generated", year);
  const absolutePath = path.join(directory, storedFileName);
  await mkdir(directory, { recursive: true });
  await writeFile(absolutePath, buffer, { flag: "wx" });

  try {
    return await createCentralDocument(connection, {
      ...input,
      storagePath: normalizeProtectedStoragePath(
        `generated/${year}/${storedFileName}`,
      ),
      originalFileName: `${safeBaseName(input.fileBaseName)}.pdf`,
      mimeType: "application/pdf",
      fileSizeBytes: buffer.length,
      checksum: createHash("sha256").update(buffer).digest("hex"),
    });
  } catch (error) {
    await unlink(absolutePath).catch(() => undefined);
    throw error;
  }
}
