import type { RequestHandler } from "express";
import { env } from "../config/env";
import type { AuthService } from "../modules/auth/auth.service";
import { AppError } from "../utils/app-error";
import { asyncHandler } from "../utils/async-handler";

export function createAuthenticate(authService: AuthService): RequestHandler {
  return asyncHandler(async (request, _response, next) => {
    const value = request.cookies?.[env.SESSION_COOKIE_NAME];
    const rawToken = typeof value === "string" ? value : undefined;
    request.auth = await authService.authenticate(rawToken);
    next();
  });
}

export function createOptionalAuthenticate(authService: AuthService): RequestHandler {
  return asyncHandler(async (request, _response, next) => {
    const value = request.cookies?.[env.SESSION_COOKIE_NAME];
    const rawToken = typeof value === "string" ? value : undefined;

    if (!rawToken) {
      next();
      return;
    }

    try {
      request.auth = await authService.authenticate(rawToken);
    } catch (error) {
      if (!(error instanceof AppError) || error.code !== "UNAUTHENTICATED") {
        throw error;
      }
    }

    next();
  });
}
