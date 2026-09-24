import type { RequestHandler } from "express";
import { AppError } from "../utils/app-error";
import { storageProvider } from "./index";
import { normalizeObjectKey } from "./storage-paths";
import type { StorageProvider } from "./storage-provider";

const publicContentTypes: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".avif": "image/avif",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
};

const protectedPublicRoutePrefixes = [
  "documents/",
  "generated/",
  "membership-applications/",
  "membership-payments/",
  "payment-proofs/",
  "rental-payments/",
  "rental-valid-ids/",
  "receipts/",
  "records/",
];

function requestUploadKey(request: Parameters<RequestHandler>[0]) {
  const captured = request.params[0];
  if (typeof captured === "string") {
    return captured;
  }

  const originalPath = request.originalUrl.split("?")[0] ?? "";
  const withoutMount = originalPath.replace(/^\/uploads\/?/, "");

  try {
    return decodeURIComponent(withoutMount);
  } catch {
    throw new AppError("Storage key must stay inside configured storage", 400, "INVALID_STORAGE_KEY");
  }
}

function contentTypeForKey(key: string) {
  const lower = key.toLowerCase();
  const extension = Object.keys(publicContentTypes)
    .find((candidate) => lower.endsWith(candidate));
  return extension ? publicContentTypes[extension] : "application/octet-stream";
}

function isMissingObject(error: unknown) {
  if (error && typeof error === "object") {
    const code = "code" in error ? String(error.code) : "";
    const name = "name" in error ? String(error.name) : "";
    const metadata = "$metadata" in error
      ? (error as { $metadata?: { httpStatusCode?: number } }).$metadata
      : undefined;

    return (
      code === "ENOENT" ||
      code === "NoSuchKey" ||
      name === "NoSuchKey" ||
      name === "NotFound" ||
      metadata?.httpStatusCode === 404
    );
  }

  return false;
}

export function createPublicUploadHandler(
  provider: StorageProvider = storageProvider(),
): RequestHandler {
  return async (request, response, next) => {
    let key: string;
    try {
      key = normalizeObjectKey(requestUploadKey(request));
    } catch (error) {
      next(error);
      return;
    }

    if (protectedPublicRoutePrefixes.some((prefix) => key.startsWith(prefix))) {
      next(new AppError("Upload was not found", 404, "PUBLIC_UPLOAD_NOT_FOUND"));
      return;
    }

    try {
      const contents = await provider.get({ key, visibility: "public" });
      response.setHeader("Content-Type", contentTypeForKey(key));
      response.setHeader("X-Content-Type-Options", "nosniff");
      response.setHeader("Cache-Control", "public, max-age=86400");
      response.send(contents);
    } catch (error) {
      if (isMissingObject(error)) {
        next();
        return;
      }
      next(error);
    }
  };
}
