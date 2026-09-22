import path from "node:path";
import { AppError } from "../utils/app-error";

export const protectedUploadRoot = path.join(
  process.cwd(),
  "public",
  "uploads",
);

const storagePrefixes = [
  "storage/uploads/",
  "public/uploads/",
  "/uploads/",
  "uploads/",
];

function uploadRelativePath(filePath: string) {
  const trimmed = filePath.trim().replaceAll("\\", "/");
  const absoluteRoot = path.resolve(protectedUploadRoot).replaceAll("\\", "/");

  if (path.isAbsolute(filePath)) {
    const absoluteFilePath = path.resolve(filePath).replaceAll("\\", "/");
    if (absoluteFilePath === absoluteRoot) {
      return "";
    }
    if (absoluteFilePath.startsWith(`${absoluteRoot}/`)) {
      return absoluteFilePath.slice(absoluteRoot.length + 1);
    }
  }

  for (const prefix of storagePrefixes) {
    if (trimmed.startsWith(prefix)) {
      return trimmed.slice(prefix.length);
    }
  }

  return trimmed;
}

export function normalizeProtectedStoragePath(filePath: string) {
  if (!filePath.trim()) {
    throw new AppError("File path is required", 400, "FILE_PATH_REQUIRED");
  }

  const relativePath = uploadRelativePath(filePath);
  if (!relativePath) {
    throw new AppError("File path is required", 400, "FILE_PATH_REQUIRED");
  }
  const normalized = path.posix.normalize(relativePath);

  if (
    normalized.startsWith("../") ||
    normalized === ".." ||
    path.isAbsolute(normalized)
  ) {
    throw new AppError("File path must stay inside protected storage", 400, "INVALID_FILE_PATH");
  }

  return `public/uploads/${normalized}`;
}

