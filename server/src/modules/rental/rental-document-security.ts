import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
import {
  normalizeProtectedStoragePath,
  readProtectedFile,
  protectedUploadRoot,
} from "../../storage/protected-storage";
import { storageProvider } from "../../storage";

const MAX_DOCUMENT_FILE_SIZE = 10 * 1024 * 1024;

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
  jfif: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  bmp: "image/bmp",
  tif: "image/tiff",
  tiff: "image/tiff",
  avif: "image/avif",
  heic: "image/heic",
  heif: "image/heif",
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
  if (extension === "webp") {
    return (
      buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
      buffer.subarray(8, 12).toString("ascii") === "WEBP"
    );
  }
  if (extension === "gif") {
    const header = buffer.subarray(0, 6).toString("ascii");
    return header === "GIF87a" || header === "GIF89a";
  }
  if (extension === "bmp") {
    return buffer.subarray(0, 2).toString("ascii") === "BM";
  }
  if (extension === "tif" || extension === "tiff") {
    return (
      beginsWith(buffer, [0x49, 0x49, 0x2a, 0x00]) ||
      beginsWith(buffer, [0x4d, 0x4d, 0x00, 0x2a])
    );
  }
  if (extension === "avif" || extension === "heic" || extension === "heif") {
    if (buffer.subarray(4, 8).toString("ascii") !== "ftyp") return false;
    const brand = buffer.subarray(8, 12).toString("ascii");
    if (extension === "avif") return ["avif", "avis"].includes(brand);
    return ["heic", "heix", "hevc", "hevx", "mif1", "msf1"].includes(brand);
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

function detectedFileType(buffer: Buffer) {
  if (hasExpectedSignature("pdf", buffer)) {
    return { extension: "pdf", mimeType: extensionMimeTypes.pdf };
  }
  if (hasExpectedSignature("png", buffer)) {
    return { extension: "png", mimeType: extensionMimeTypes.png };
  }
  if (hasExpectedSignature("jpg", buffer)) {
    return { extension: "jpg", mimeType: extensionMimeTypes.jpg };
  }
  if (hasExpectedSignature("webp", buffer)) {
    return { extension: "webp", mimeType: extensionMimeTypes.webp };
  }
  if (hasExpectedSignature("gif", buffer)) {
    return { extension: "gif", mimeType: extensionMimeTypes.gif };
  }
  if (hasExpectedSignature("bmp", buffer)) {
    return { extension: "bmp", mimeType: extensionMimeTypes.bmp };
  }
  if (hasExpectedSignature("tiff", buffer)) {
    return { extension: "tiff", mimeType: extensionMimeTypes.tiff };
  }
  if (hasExpectedSignature("avif", buffer)) {
    return { extension: "avif", mimeType: extensionMimeTypes.avif };
  }
  if (hasExpectedSignature("heic", buffer)) {
    return { extension: "heic", mimeType: extensionMimeTypes.heic };
  }
  return undefined;
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
  const expectedMimeType = extensionMimeTypes[extension];

  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.length !== file.size || buffer.length === 0) {
    throw new Error("The uploaded file is empty or incomplete.");
  }
  const detectedType = detectedFileType(buffer);
  const signatureMatchesExtension = Boolean(
    expectedMimeType && hasExpectedSignature(extension, buffer),
  );
  if (!signatureMatchesExtension && !detectedType) {
    throw new Error("Use a real image file or PDF. The selected file could not be read as an image.");
  }
  const safeExtension = signatureMatchesExtension ? extension : detectedType?.extension;
  const safeMimeType = signatureMatchesExtension ? expectedMimeType : detectedType?.mimeType;
  if (!safeExtension || !safeMimeType) {
    throw new Error("The file contents do not match the selected file type.");
  }

  return {
    buffer,
    originalFileName,
    extension: safeExtension,
    mimeType: safeMimeType,
    size: buffer.length,
    checksum: createHash("sha256").update(buffer).digest("hex"),
  };
}

export async function storeProtectedDocument(
  file: ValidatedDocumentFile,
  folder = "documents",
) {
  const year = String(new Date().getFullYear());
  const storedFileName = `${randomUUID()}.${file.extension}`;
  const key = `${folder}/${year}/${storedFileName}`;
  await storageProvider().put({
    key,
    visibility: "protected",
    body: file.buffer,
    contentType: file.mimeType,
  });
  return {
    absolutePath: path.join(protectedUploadRoot, key),
    storedFileName,
    storagePath: normalizeProtectedStoragePath(key),
  };
}

export function resolveProtectedDocumentPath(storagePath: string) {
  const normalized = normalizeProtectedStoragePath(storagePath);
  const relativePath = normalized.slice("public/uploads/".length);
  const absolutePath = path.resolve(protectedUploadRoot, relativePath);
  const allowedRoot = `${path.resolve(protectedUploadRoot)}${path.sep}`;
  if (!absolutePath.startsWith(allowedRoot)) {
    throw new Error("The protected document path is invalid.");
  }
  return absolutePath;
}

export async function readProtectedDocument(storagePath: string) {
  return readProtectedFile(storagePath);
}
