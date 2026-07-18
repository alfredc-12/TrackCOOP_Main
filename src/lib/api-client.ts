import { env } from "@/config/env";

type ApiSuccess<T> = {
  success: true;
  data: T;
  message: string;
  meta: Record<string, unknown>;
};

type ApiFailure = {
  success: false;
  message: string;
  errors: Array<{ code?: string; field?: string; message: string }>;
};

export class ApiClientError extends Error {
  readonly status: number;
  readonly errors: ApiFailure["errors"];

  constructor(message: string, status: number, errors: ApiFailure["errors"] = []) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.errors = errors;
  }
}

export async function apiRequest<T>(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);

  if (init.body && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  let response: Response;

  try {
    response = await fetch(`${env.apiUrl}${path}`, {
      ...init,
      credentials: "include",
      headers,
    });
  } catch {
    throw new ApiClientError(
      "TrackCOOP could not reach the server. Please try again.",
      0,
    );
  }

  const payload = (await response.json().catch(() => null)) as
    | ApiSuccess<T>
    | ApiFailure
    | null;

  if (!response.ok || !payload?.success) {
    const failure = payload && !payload.success ? payload : null;
    throw new ApiClientError(
      failure?.message ?? "The request could not be completed",
      response.status,
      failure?.errors,
    );
  }

  return payload.data;
}
