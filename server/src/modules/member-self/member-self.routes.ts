import { Router } from "express";
import { createAuthenticate } from "../../middleware/authenticate";
import { requireRoles } from "../../middleware/authorize";
import { createAuthService, type AuthService } from "../auth/auth.service";
import { createMemberSelfController } from "./member-self.controller";
import {
  createMemberSelfService,
  type MemberSelfService,
} from "./member-self.service";

export function createMemberSelfRouter(
  authService: AuthService = createAuthService(),
  memberSelfService: MemberSelfService = createMemberSelfService(),
) {
  const router = Router();
  const controller = createMemberSelfController(memberSelfService);
  const memberOnly = [createAuthenticate(authService), requireRoles("member")];

  router.get("/members/me/dashboard", ...memberOnly, controller.dashboard);
  router.get("/members/me/activity", ...memberOnly, controller.activity);
  router.get("/members/me/profile", ...memberOnly, controller.profile);
  router.put("/members/me/profile", ...memberOnly, controller.updateProfile);
  router.put("/members/me/password", ...memberOnly, controller.updatePassword);
  router.get("/members/me/support", ...memberOnly, controller.listSupportTickets);
  router.post("/members/me/support", ...memberOnly, controller.createSupportTicket);

  return router;
}
