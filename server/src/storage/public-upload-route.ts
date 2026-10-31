import type { RequestHandler } from "express";
import { AppError } from "../utils/app-error";
import { env } from "../config/env";
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

// Historic public announcement images are bundled with the frontend.
// Only these known files may fall back when an object is absent from storage.
const bundledAnnouncementImages = new Set([
  "announcements/189624d50c425759ab35eee56d8a3b19.jpg",
  "announcements/3849ddfb711fb8ab164b3e0530e17081.jpg",
  "announcements/49b41ee122ee21e89be846a124f74012.jpg",
  "announcements/5aa6000dfcd15130a9521649144b95f6.jpg",
  "announcements/66b67128768b0dfc02e49d970421c914.jpg",
  "announcements/99b4c6e10dbde7d926e92121fc880bf5.jpg",
  "announcements/9b8f7415d05f59b0e4d461560036d775.jpg",
  "announcements/a72bca5f29a10f85cea05807aa3bebee.jpg",
  "announcements/bd8fda35a7096dcb983ee73d1817e9bc.jpg",
  "announcements/be81a9ab1754abab2b30e253c79ef9a7.jpg",
  "announcements/c87cb49c2c49082b86d6b6628ed159ff.jpg",
  "announcements/cb4f488bef862cec26940ce28a81b2ff.jpg",
  "announcements/cc0710eb2ac48754fcccaea2eaf610b2.jpg",
  "announcements/d2d35a4e151ed2168d71b84b67098b5d.jpg",
  "announcements/da238afe1881ed6e880197a997766829.jpg",
  "announcements/eac5527e610f8f8e7ae76b4fa9dfe9fc.jpg",
  "announcements/f08d9fefdc1ef555e48b5fbc919aac9e.jpg",
  "announcements/f8868c3fe8c4d5d43d55109854e99c53.jpg",
]);

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
        if (bundledAnnouncementImages.has(key)) {
          response.redirect(302, `${env.FRONTEND_URL.replace(/\/$/, "")}/uploads/${key}`);
          return;
        }
        next();
        return;
      }
      next(error);
    }
  };
}
