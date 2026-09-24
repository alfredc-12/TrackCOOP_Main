import path from "node:path";
import { AppError } from "../utils/app-error";
import type { StorageVisibility } from "./storage-provider";

const uploadPrefixes = [
  "public/uploads/",
  "storage/uploads/",
  "/uploads/",
  "uploads/",
];

export function normalizeObjectKey(value: string) {
  const trimmed = value.trim().replaceAll("\\", "/");
  let candidate = trimmed;

  for (const prefix of uploadPrefixes) {
    if (candidate.startsWith(prefix)) {
      candidate = candidate.slice(prefix.length);
      break;
    }
  }

  const normalized = path.posix.normalize(candidate);
  if (
    !normalized ||
    normalized === "." ||
    normalized === ".." ||
    normalized.startsWith("../") ||
    path.posix.isAbsolute(normalized) ||
    normalized.includes("\0")
  ) {
    throw new AppError("Storage key must stay inside configured storage", 400, "INVALID_STORAGE_KEY");
  }

  return normalized;
}

export function storagePrefix(visibility: StorageVisibility) {
  return visibility === "public" ? "public" : "protected";
}

export function providerObjectKey(key: string, visibility: StorageVisibility) {
  const normalized = normalizeObjectKey(key);
  return `${storagePrefix(visibility)}/${normalized}`;
}

export function publicUrlPath(key: string) {
  return `/uploads/${normalizeObjectKey(key)}`;
}

export function protectedDatabasePath(key: string) {
  return `public/uploads/${normalizeObjectKey(key)}`;
}

