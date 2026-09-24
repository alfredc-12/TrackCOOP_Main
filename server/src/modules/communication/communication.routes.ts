import { Router } from "express";
import multer from "multer";
import path from "node:path";
import crypto from "node:crypto";
import { createAuthenticate, createOptionalAuthenticate } from "../../middleware/authenticate";
import { requireRoles } from "../../middleware/authorize";
import { storageProvider } from "../../storage";
import { createAuthService, type AuthService } from "../auth/auth.service";
import { createCommunicationController } from "./communication.controller";
import { createCommunicationService, type CommunicationService } from "./communication.service";

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

export function createCommunicationRouter(
  authService: AuthService = createAuthService(),
  communicationService: CommunicationService = createCommunicationService(),
) {
  const router = Router();
  const controller = createCommunicationController(communicationService);
  const optionalAuthenticated = createOptionalAuthenticate(authService);
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

  router.get("/announcements", optionalAuthenticated, controller.listAnnouncements);
  
  router.post("/announcements/upload-image", ...chairmanOnly, upload.fields([
    { name: "images", maxCount: 12 },
    { name: "image", maxCount: 1 },
  ]), async (req, res, next) => {
    const filesByField = req.files as Record<string, Express.Multer.File[]> | undefined;
    const files = [
      ...(filesByField?.images ?? []),
      ...(filesByField?.image ?? []),
    ];

    if (files.length === 0) {
      res.status(400).json({ success: false, message: "No images provided", errors: [] });
      return;
    }

    try {
      const urls = await Promise.all(files.map(async (file) => {
        const ext = path.extname(file.originalname) || ".bin";
        const stored = await storageProvider().put({
          key: `announcements/${crypto.randomBytes(16).toString("hex")}${ext}`,
          visibility: "public",
          body: file.buffer,
          contentType: file.mimetype,
        });
        return stored.url ?? stored.path;
      }));
      res.json({ success: true, data: { url: urls[0], urls }, message: "Success", meta: {} });
    } catch (error) {
      next(error);
    }
  });

  router.post("/announcements", ...chairmanOnly, controller.createAnnouncement);
  router.patch("/announcements/:id", ...chairmanOnly, controller.updateAnnouncement);
  router.post("/announcements/:id/publish", ...chairmanOnly, controller.publishAnnouncement);
  router.post("/announcements/:id/archive", ...chairmanOnly, controller.archiveAnnouncement);
  router.post("/announcements/:id/acknowledge", ...authenticated, controller.acknowledgeAnnouncement);
  router.get("/announcements/:id/acknowledgments", ...chairmanOnly, controller.getAnnouncementAcknowledgments);

  router.get("/requests", ...authenticated, controller.listRequests);
  router.get("/requests/track/:code", controller.trackPublicRequest);
  router.post("/requests/track/:code/reply", controller.addPublicRequestReply);
  router.post("/requests/public", controller.createPublicRequest);
  router.post("/requests", ...authenticated, controller.createAuthenticatedRequest);
  router.get("/requests/:id", ...authenticated, controller.detailRequest);
  router.patch("/requests/:id/status", ...staff, controller.updateRequestStatus);
  router.post("/requests/:id/reply", ...authenticated, controller.addRequestReply);

  router.get("/notifications", ...authenticated, controller.listNotifications);
  router.post("/notifications/read-all", ...authenticated, controller.markAllNotificationsRead);
  router.patch("/notifications/:id/read", ...authenticated, controller.markNotificationRead);

  return router;
}
