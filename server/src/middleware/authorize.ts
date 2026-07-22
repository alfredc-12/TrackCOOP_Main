import type { RequestHandler } from "express";
import type { RoleSlug } from "../modules/auth/auth.types";
import { AppError } from "../utils/app-error";

export function requireRoles(...allowedRoles: RoleSlug[]): RequestHandler {
  const allowed = new Set<RoleSlug>(allowedRoles);

  return (request, _response, next) => {
    if (!request.auth) {
      next(new AppError("Authentication is required", 401, "UNAUTHENTICATED"));
      return;
    }

    if (!allowed.has(request.auth.user.role)) {
      next(
        new AppError(
          "You do not have permission to perform this action",
          403,
          "FORBIDDEN",
        ),
      );
      return;
    }

    next();
  };
}
