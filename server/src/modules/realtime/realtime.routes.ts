import { Router } from "express";
import { createAuthenticate } from "../../middleware/authenticate";
import { requireRoles } from "../../middleware/authorize";
import { AppError } from "../../utils/app-error";
import { asyncHandler } from "../../utils/async-handler";
import { createAuthService, type AuthService } from "../auth/auth.service";
import { subscribeRealtimeClient } from "./realtime.events";

export function createRealtimeRouter(authService: AuthService = createAuthService()) {
  const router = Router();

  router.get(
    "/events",
    createAuthenticate(authService),
    requireRoles("chairman", "bookkeeper", "member"),
    asyncHandler(async (request, response) => {
      if (!request.auth) {
        throw new AppError("Authentication is required", 401, "UNAUTHENTICATED");
      }

      subscribeRealtimeClient({
        auth: request.auth,
        response,
        onClose: (handler) => request.on("close", handler),
      });
    }),
  );

  return router;
}
