import { Router } from "express";
import { createAuthenticate } from "../../middleware/authenticate";
import { requireRoles } from "../../middleware/authorize";
import { createAuthService, type AuthService } from "../auth/auth.service";
import { createUserController } from "./user.controller";
import { createUserService, type UserService } from "./user.service";

export function createUserRouter(
  authService: AuthService = createAuthService(),
  userService: UserService = createUserService(),
) {
  const router = Router();
  const controller = createUserController(userService);
  const chairmanOnly = [createAuthenticate(authService), requireRoles("chairman")];

  router.get("/roles", ...chairmanOnly, controller.roles);
  router.get("/users", ...chairmanOnly, controller.list);
  router.post("/users", ...chairmanOnly, controller.create);
  router.get("/users/:id", ...chairmanOnly, controller.detail);
  router.patch("/users/:id", ...chairmanOnly, controller.update);
  router.patch("/users/:id/status", ...chairmanOnly, controller.status);
  router.patch("/users/:id/role", ...chairmanOnly, controller.role);

  return router;
}
