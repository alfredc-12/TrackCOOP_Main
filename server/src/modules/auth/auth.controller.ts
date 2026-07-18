import type { CookieOptions, RequestHandler } from "express";
import { env } from "../../config/env";
import { asyncHandler } from "../../utils/async-handler";
import { AppError } from "../../utils/app-error";
import { sendSuccess } from "../../utils/response";
import { loginSchema, sessionIdSchema } from "./auth.schema";
import type { AuthService } from "./auth.service";

function cookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    path: "/",
  };
}

function validationError(issues: { path: PropertyKey[]; message: string }[]) {
  return new AppError(
    "Please correct the highlighted fields",
    400,
    "VALIDATION_ERROR",
    issues.map((issue) => ({
      code: "INVALID_FIELD",
      field: issue.path.join("."),
      message: issue.message,
    })),
  );
}

function requestContext(request: Parameters<RequestHandler>[0]) {
  return {
    ipAddress: request.ip || request.socket.remoteAddress || null,
    userAgent: request.get("user-agent")?.slice(0, 500) ?? null,
  };
}

export function createAuthController(authService: AuthService) {
  return {
    login: asyncHandler(async (request, response) => {
      const parsed = loginSchema.safeParse(request.body);

      if (!parsed.success) {
        throw validationError(parsed.error.issues);
      }

      const result = await authService.login(parsed.data, requestContext(request));
      response.cookie(env.SESSION_COOKIE_NAME, result.rawToken, {
        ...cookieOptions(),
        expires: result.expiresAt,
      });

      return sendSuccess(response, result.user, {
        message: "Signed in successfully",
      });
    }),

    logout: asyncHandler(async (request, response) => {
      await authService.logout(request.auth!);
      response.clearCookie(env.SESSION_COOKIE_NAME, cookieOptions());

      return sendSuccess(response, null, { message: "Signed out successfully" });
    }),

    me: asyncHandler(async (request, response) =>
      sendSuccess(response, request.auth!.user, {
        message: "Authenticated user retrieved",
      }),
    ),

    sessions: asyncHandler(async (request, response) => {
      const sessions = await authService.listSessions(request.auth!);
      return sendSuccess(response, sessions, {
        message: "Active sessions retrieved",
      });
    }),

    revokeSession: asyncHandler(async (request, response) => {
      const parsed = sessionIdSchema.safeParse(request.params);

      if (!parsed.success) {
        throw validationError(parsed.error.issues);
      }

      const isCurrent = request.auth!.sessionId === parsed.data.id;
      await authService.revokeSession(request.auth!, parsed.data.id);

      if (isCurrent) {
        response.clearCookie(env.SESSION_COOKIE_NAME, cookieOptions());
      }

      return sendSuccess(
        response,
        { revokedSessionId: parsed.data.id },
        { message: "Session revoked" },
      );
    }),
  };
}
