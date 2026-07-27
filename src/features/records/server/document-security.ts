import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  normalizeProtectedStoragePath,
  protectedUploadRoot,
} from "../../../../server/src/storage/protected-storage";
import { MAX_DOCUMENT_FILE_SIZE } from "../record-constants";

export type UploadedFileLike = {
  name: string;
  size: number;
  type: string;
  arrayBuffer(): Promise<ArrayBuffer>;
};

export type ValidatedDocumentFile = {
  buffer: Buffer;
  originalFileName: string;
  extension: string;
  mimeType: string;
  size: number;
  checksum: string;
};

const extensionMimeTypes: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
};

function beginsWith(buffer: Buffer, bytes: number[]) {
  return bytes.every((byte, index) => buffer[index] === byte);
}

function hasExpectedSignature(extension: string, buffer: Buffer) {
  if (extension === "pdf") return buffer.subarray(0, 5).toString() === "%PDF-";
  if (extension === "png") {
    return beginsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  }
  if (extension === "jpg" || extension === "jpeg") {
    return beginsWith(buffer, [0xff, 0xd8, 0xff]);
  }
  if (extension === "doc" || extension === "xls") {
    return beginsWith(buffer, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
  }
  if (extension === "docx" || extension === "xlsx") {
    return beginsWith(buffer, [0x50, 0x4b, 0x03, 0x04]);
  }
  if (extension === "csv") {
    if (buffer.includes(0)) return false;
    const sample = buffer
      .subarray(0, Math.min(buffer.length, 4096))
      .toString("utf8");
    return !sample.includes("\uFFFD");
  }
  return false;
}

export function safeOriginalFileName(value: string) {
  const normalized = path
    .basename(value.normalize("NFKC"))
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized || normalized === "." || normalized === "..") {
    throw new Error("The file name is invalid.");
  }
  return normalized.slice(0, 255);
}

export async function validateDocumentFile(
  file: UploadedFileLike,
): Promise<ValidatedDocumentFile> {
  if (!file.name || file.size <= 0) {
    throw new Error("Choose a non-empty document file.");
  }
  if (file.size > MAX_DOCUMENT_FILE_SIZE) {
    throw new Error("Document files must be 10 MB or smaller.");
  }
  const originalFileName = safeOriginalFileName(file.name);
  const extension = path.extname(originalFileName).slice(1).toLowerCase();
  const mimeType = extensionMimeTypes[extension];
  if (!mimeType) {
    throw new Error(
      "Use a PDF, DOC, DOCX, XLS, XLSX, CSV, JPG, JPEG, or PNG file.",
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.length !== file.size || buffer.length === 0) {
    throw new Error("The uploaded file is empty or incomplete.");
  }
  if (!hasExpectedSignature(extension, buffer)) {
    throw new Error("The file contents do not match the selected file type.");
  }

  return {
    buffer,
    originalFileName,
    extension,
    mimeType,
    size: buffer.length,
    checksum: createHash("sha256").update(buffer).digest("hex"),
  };
}

export async function storeProtectedDocument(
  file: ValidatedDocumentFile,
  folder = "documents",
) {
  const year = String(new Date().getFullYear());
  const directory = path.join(
    /* turbopackIgnore: true */ protectedUploadRoot,
    folder,
    year,
  );
  await mkdir(/* turbopackIgnore: true */ directory, { recursive: true });
  const storedFileName = `${randomUUID()}.${file.extension}`;
  const absolutePath = path.join(directory, storedFileName);
  await writeFile(/* turbopackIgnore: true */ absolutePath, file.buffer, {
    flag: "wx",
  });
  return {
    absolutePath,
    storedFileName,
    storagePath: normalizeProtectedStoragePath(
      `${folder}/${year}/${storedFileName}`,
    ),
  };
}

export function resolveProtectedDocumentPath(storagePath: string) {
  const normalized = normalizeProtectedStoragePath(storagePath);
  const relativePath = normalized.slice("storage/uploads/".length);
  const absolutePath = path.resolve(
    /* turbopackIgnore: true */ protectedUploadRoot,
    relativePath,
  );
  const allowedRoot = `${path.resolve(protectedUploadRoot)}${path.sep}`;
  if (!absolutePath.startsWith(allowedRoot)) {
    throw new Error("The protected document path is invalid.");
  }
  return absolutePath;
}
