import { Router } from "express";
import { createAuthenticate } from "../../middleware/authenticate";
import { requireRoles } from "../../middleware/authorize";
import { createAuthService, type AuthService } from "../auth/auth.service";
import { createMemberController } from "./member.controller";
import { createMemberService, type MemberService } from "./member.service";

export function createMemberRouter(
  authService: AuthService = createAuthService(),
  memberService: MemberService = createMemberService(),
) {
  const router = Router();
  const controller = createMemberController(memberService);
  const chairmanOnly = [createAuthenticate(authService), requireRoles("chairman")];

  router.get("/members/summary", ...chairmanOnly, controller.summary);
  router.get(
    "/members/distribution/barangay",
    ...chairmanOnly,
    controller.barangayDistribution,
  );
  router.get("/members", ...chairmanOnly, controller.list);
  router.post("/members", ...chairmanOnly, controller.create);
  router.get("/members/:id", ...chairmanOnly, controller.detail);
  router.patch("/members/:id", ...chairmanOnly, controller.update);
  router.patch("/members/:id/approval", ...chairmanOnly, controller.approval);
  router.patch("/members/:id/status", ...chairmanOnly, controller.status);
  router.get("/members/:id/status-history", ...chairmanOnly, controller.history);

  return router;
}
