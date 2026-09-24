import { Router } from "express";
import { createAuthenticate } from "../../middleware/authenticate";
import { requireRoles } from "../../middleware/authorize";
import { createAuthService, type AuthService } from "../auth/auth.service";
import { createInventoryController } from "./inventory.controller";
import { createInventoryService, type InventoryService } from "./inventory.service";

export function createInventoryRouter(
  authService: AuthService = createAuthService(),
  inventoryService: InventoryService = createInventoryService(),
) {
  const router = Router();
  const controller = createInventoryController(inventoryService);
  const staff = [createAuthenticate(authService), requireRoles("chairman", "bookkeeper")];
  const readable = [createAuthenticate(authService), requireRoles("chairman", "bookkeeper", "member")];

  router.get("/inventory", ...readable, controller.listProducts);
  router.post("/inventory", ...staff, controller.createProduct);
  router.get("/inventory/history", ...staff, controller.listHistory);
  router.put("/inventory/:id", ...staff, controller.updateProduct);
  router.delete("/inventory/:id", ...staff, controller.archiveProduct);
  router.post("/inventory/:id/stock", ...staff, controller.updateStock);
  router.get("/public/store-products", controller.listPublicProducts);

  return router;
}
