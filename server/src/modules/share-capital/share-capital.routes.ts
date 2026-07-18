import { Router } from "express";
import { createAuthenticate } from "../../middleware/authenticate";
import { requireRoles } from "../../middleware/authorize";
import { createAuthService, type AuthService } from "../auth/auth.service";
import { createShareCapitalController } from "./share-capital.controller";
import {
  createShareCapitalService,
  type ShareCapitalService,
} from "./share-capital.service";

export function createShareCapitalRouter(
  authService: AuthService = createAuthService(),
  shareCapitalService: ShareCapitalService = createShareCapitalService(),
) {
  const router = Router();
  const controller = createShareCapitalController(shareCapitalService);
  const staff = [createAuthenticate(authService), requireRoles("chairman", "bookkeeper")];
  const bookkeeperOnly = [createAuthenticate(authService), requireRoles("bookkeeper")];

  router.get("/share-capital", ...staff, controller.list);
  router.post("/share-capital", ...bookkeeperOnly, controller.create);
  router.get("/share-capital/summary", ...staff, controller.summary);
  router.get("/share-capital/member/:memberId", ...staff, controller.memberProgress);
  router.get("/share-capital/:id", ...staff, controller.detail);
  router.patch("/share-capital/:id", ...bookkeeperOnly, controller.update);

  return router;
}
