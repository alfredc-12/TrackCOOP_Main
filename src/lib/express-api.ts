import { env } from "@/config/env";

export function expressApiUrl(path: string) {
  return `${env.apiUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

export function expressFetch(path: string, init: RequestInit = {}) {
  return fetch(expressApiUrl(path), {
    ...init,
    credentials: init.credentials ?? "include",
  });
}
