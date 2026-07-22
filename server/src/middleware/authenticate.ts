import type { RequestHandler } from "express";
import { env } from "../config/env";
import type { AuthService } from "../modules/auth/auth.service";
import { asyncHandler } from "../utils/async-handler";

export function createAuthenticate(authService: AuthService): RequestHandler {
  return asyncHandler(async (request, _response, next) => {
    const value = request.cookies?.[env.SESSION_COOKIE_NAME];
    const rawToken = typeof value === "string" ? value : undefined;
    request.auth = await authService.authenticate(rawToken);
    next();
  });
}
