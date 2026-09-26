import { env } from "@/config/env";

const LOCAL_IMAGE_PREFIX = "/images/";
function apiUrl(path: string) {
  const base = env.apiUrl.replace(/\/+$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  return `${base}${normalizedPath}`;
}

export function firstUploadPath(value: string | null | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) return "";

  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed) && typeof parsed[0] === "string") {
        return parsed[0].trim();
      }
    } catch {
      return trimmed;
    }
  }

  return trimmed;
}

export function resolveUploadUrl(value: string | null | undefined) {
  const path = firstUploadPath(value);
  if (!path) return "";

  if (/^(?:https?:|data:|blob:)/i.test(path)) return path;
  if (path.startsWith(LOCAL_IMAGE_PREFIX)) return path;

  const relativePath = path.replace(/^\/+/, "");
  if (relativePath.startsWith("uploads/")) return apiUrl(`/${relativePath}`);
  if (relativePath.startsWith("public/uploads/")) return apiUrl(`/${relativePath.slice("public/".length)}`);
  if (relativePath.startsWith("storage/uploads/")) return apiUrl(`/${relativePath.slice("storage/".length)}`);

  return path.startsWith("/") ? path : apiUrl(path);
}

export function cssUploadUrl(value: string | null | undefined) {
  const resolved = resolveUploadUrl(value);
  if (!resolved) return undefined;

  return `url("${resolved.replaceAll('"', "%22")}")`;
}
