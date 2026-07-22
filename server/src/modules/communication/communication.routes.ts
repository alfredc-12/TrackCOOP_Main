import { Router } from "express";
import { createAuthenticate } from "../../middleware/authenticate";
import { requireRoles } from "../../middleware/authorize";
import { createAuthService, type AuthService } from "../auth/auth.service";
import { createCommunicationController } from "./communication.controller";
import { createCommunicationService, type CommunicationService } from "./communication.service";

export function createCommunicationRouter(
  authService: AuthService = createAuthService(),
  communicationService: CommunicationService = createCommunicationService(),
) {
  const router = Router();
  const controller = createCommunicationController(communicationService);
  const authenticated = [createAuthenticate(authService), requireRoles("chairman", "bookkeeper", "member")];
  const staff = [createAuthenticate(authService), requireRoles("chairman", "bookkeeper")];
  const chairmanOnly = [createAuthenticate(authService), requireRoles("chairman")];

  router.get("/documents", ...authenticated, controller.listDocuments);
  router.post("/documents", ...staff, controller.createDocument);
  router.get("/documents/:id", ...authenticated, controller.detailDocument);
  router.patch("/documents/:id", ...staff, controller.updateDocument);
  router.post("/documents/:id/access-log", ...authenticated, controller.logDocumentAccess);

  router.get("/reports", ...staff, controller.listReports);
  router.post("/reports", ...staff, controller.createReport);
  router.post("/reports/:id/archive", ...staff, controller.archiveReport);

  router.get("/announcements", ...authenticated, controller.listAnnouncements);
  router.post("/announcements", ...chairmanOnly, controller.createAnnouncement);
  router.patch("/announcements/:id", ...chairmanOnly, controller.updateAnnouncement);
  router.post("/announcements/:id/publish", ...chairmanOnly, controller.publishAnnouncement);
  router.post("/announcements/:id/archive", ...chairmanOnly, controller.archiveAnnouncement);

  router.get("/requests", ...authenticated, controller.listRequests);
  router.post("/requests/public", controller.createPublicRequest);
  router.post("/requests", ...authenticated, controller.createAuthenticatedRequest);
  router.get("/requests/:id", ...authenticated, controller.detailRequest);
  router.patch("/requests/:id/status", ...staff, controller.updateRequestStatus);

  router.get("/notifications", ...authenticated, controller.listNotifications);
  router.post("/notifications/read-all", ...authenticated, controller.markAllNotificationsRead);
  router.patch("/notifications/:id/read", ...authenticated, controller.markNotificationRead);

  return router;
}
