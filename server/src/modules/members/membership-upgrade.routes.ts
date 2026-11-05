import { Router } from "express";
import type { Pool } from "mysql2/promise";
import { createAuthenticate } from "../../middleware/authenticate";
import { requireRoles } from "../../middleware/authorize";
import { asyncHandler } from "../../utils/async-handler";
import { AppError } from "../../utils/app-error";
import { createAuthService, type AuthService } from "../auth/auth.service";
import { createMembershipUpgradeService } from "./membership-upgrade.service";

export function createMembershipUpgradeRouter(authService: AuthService = createAuthService(), pool?: Pool) {
  const router = Router();
  const service = createMembershipUpgradeService(pool);
  const member = [createAuthenticate(authService), requireRoles("member")];
  const chairman = [createAuthenticate(authService), requireRoles("chairman")];
  router.get("/members/me/true-membership", ...member, asyncHandler(async (req, res) => res.json(await service.status(req.auth!))));
  router.post("/members/me/true-membership", ...member, asyncHandler(async (req, res) => res.status(201).json(await service.apply(req.auth!, req.body?.message))));
  router.get("/membership-upgrades", ...chairman, asyncHandler(async (_req, res) => res.json(await service.list())));
  router.post("/membership-upgrades/:id/decision", ...chairman, asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    if (!/^\d+$/.test(id)) throw new AppError("Invalid application ID", 400, "UPGRADE_ID_INVALID");
    res.json(await service.decide(req.auth!, id, req.body?.decision, req.body?.reason));
  }));
  return router;
}
