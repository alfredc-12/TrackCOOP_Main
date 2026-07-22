import type { RequestHandler } from "express";
import { AppError } from "../utils/app-error";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function validateOrigin(allowedOrigin: string): RequestHandler {
  return (request, _response, next) => {
    if (SAFE_METHODS.has(request.method)) {
      next();
      return;
    }

    const origin = request.get("origin");

    // Non-browser clients may omit Origin. Browser mutation requests may not
    // use an origin other than the configured frontend.
    if (!origin || origin === allowedOrigin) {
      next();
      return;
    }

    next(new AppError("Request origin is not allowed", 403, "ORIGIN_NOT_ALLOWED"));
  };
}
