import { Router } from "express";
import rateLimit from "express-rate-limit";
import { createAuthenticate } from "../../middleware/authenticate";
import { AppError } from "../../utils/app-error";
import { createAuthController } from "./auth.controller";
import { createAuthService, type AuthService } from "./auth.service";

export function createAuthRouter(authService: AuthService = createAuthService()) {
  const router = Router();
  const controller = createAuthController(authService);
  const authenticate = createAuthenticate(authService);
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
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
