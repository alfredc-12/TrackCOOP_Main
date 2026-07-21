import path from "node:path";
import { AppError } from "../utils/app-error";

export const protectedUploadRoot = path.resolve(process.cwd(), "storage", "uploads");

export function normalizeProtectedStoragePath(filePath: string) {
  const trimmed = filePath.trim().replaceAll("\\", "/");

  if (!trimmed) {
    throw new AppError("File path is required", 400, "FILE_PATH_REQUIRED");
  }

  const relativePath = trimmed.startsWith("storage/uploads/")
    ? trimmed.slice("storage/uploads/".length)
    : trimmed;
  const normalized = path.posix.normalize(relativePath);

  if (
    normalized.startsWith("../") ||
    normalized === ".." ||
    path.isAbsolute(normalized)
  ) {
    throw new AppError("File path must stay inside protected storage", 400, "INVALID_FILE_PATH");
  }

  return `storage/uploads/${normalized}`;
}

