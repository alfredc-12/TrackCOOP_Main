import { Router } from "express";
import { createAuthenticate } from "../../middleware/authenticate";
import { requireRoles } from "../../middleware/authorize";
import { createAuthService, type AuthService } from "../auth/auth.service";
import { createMemberIndicatorController } from "./member-indicator.controller";
import { createRfmWorkspaceRouter } from "./member-indicator.workspace-routes";
import type { RfmWorkspaceRepository } from "./member-indicator.workspace-repository";
import {
  createMemberIndicatorService,
  type MemberIndicatorService,
} from "./member-indicator.service";

export function createMemberIndicatorRouter(
  authService: AuthService = createAuthService(),
  memberIndicatorService: MemberIndicatorService = createMemberIndicatorService(),
  workspaceRepository?: RfmWorkspaceRepository,
) {
  const router = Router();
  const controller = createMemberIndicatorController(memberIndicatorService);
  const chairmanOnly = [createAuthenticate(authService), requireRoles("chairman")];
  router.use("/member-indicators/workspace", ...chairmanOnly, createRfmWorkspaceRouter(workspaceRepository));

  router.get("/member-indicators", ...chairmanOnly, controller.list);
  router.get("/member-indicators/summary", ...chairmanOnly, controller.summary);
  router.post(
    "/member-indicators/recalculate",
    ...chairmanOnly,
    controller.recalculate,
  );
  router.get(
    "/member-indicators/:memberId/history",
    ...chairmanOnly,
    controller.history,
  );
  router.get(
    "/member-indicators/:memberId",
    ...chairmanOnly,
    controller.detail,
  );

  return router;
}
