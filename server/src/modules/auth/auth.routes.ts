import { Router } from "express";
import rateLimit from "express-rate-limit";
import { env } from "../../config/env";
import { createAuthenticate } from "../../middleware/authenticate";
import { AppError } from "../../utils/app-error";
import { createAuthController } from "./auth.controller";
import { createAuthService, type AuthService } from "./auth.service";

type AuthRouterOptions = {
  loginRateLimit?: {
    limit: number;
    windowMinutes: number;
  };
};

export function createAuthRouter(
  authService: AuthService = createAuthService(),
  options: AuthRouterOptions = {},
) {
  const router = Router();
  const controller = createAuthController(authService);
  const authenticate = createAuthenticate(authService);
  const loginRateLimit = options.loginRateLimit ?? {
    limit: env.AUTH_LOGIN_RATE_LIMIT,
    windowMinutes: env.AUTH_LOGIN_RATE_WINDOW_MINUTES,
  };
  const loginLimiter = rateLimit({
    windowMs: loginRateLimit.windowMinutes * 60 * 1000,
    limit: loginRateLimit.limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler(_request, _response, next) {
      next(
        new AppError(
          "Too many sign-in attempts. Try again later.",
          429,
          "LOGIN_RATE_LIMITED",
        ),
      );
    },
  });

  router.post("/login", loginLimiter, controller.login);
  router.post("/logout", authenticate, controller.logout);
  router.get("/me", authenticate, controller.me);
  router.get("/sessions", authenticate, controller.sessions);
  router.delete("/sessions/:id", authenticate, controller.revokeSession);

  return router;
}
