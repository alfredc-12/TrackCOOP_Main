import { Router } from "express";
import crypto from "node:crypto";
import path from "node:path";
import multer from "multer";
import { createAuthenticate } from "../../middleware/authenticate";
import { requireRoles } from "../../middleware/authorize";
import { storageProvider } from "../../storage";
import { createAuthService, type AuthService } from "../auth/auth.service";
import { createLandingController } from "./landing.controller";
import { createLandingService, type LandingService } from "./landing.service";

const partnerFileUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/") || file.mimetype === "application/pdf") {
      cb(null, true);
      return;
    }
    cb(new Error("Only image and PDF files are allowed."));
  },
});

const galleryFileUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
      return;
    }
    cb(new Error("Only image files are allowed."));
  },
});

export function createLandingRouter(
  authService: AuthService = createAuthService(),
  landingService: LandingService = createLandingService(),
) {
  const router = Router();
  const controller = createLandingController(landingService);
  const chairmanOnly = [createAuthenticate(authService), requireRoles("chairman")];

  router.get("/public/landing", controller.publicLanding);
  router.post("/landing/partners/upload", ...chairmanOnly, partnerFileUpload.single("file"), async (req, res, next) => {
    if (!req.file) {
      res.status(400).json({ success: false, message: "No file provided", errors: [] });
      return;
    }

    try {
      const ext = path.extname(req.file.originalname) || ".bin";
      const stored = await storageProvider().put({
        key: `partners-certifications/${crypto.randomBytes(16).toString("hex")}${ext}`,
        visibility: "public",
        body: req.file.buffer,
        contentType: req.file.mimetype,
      });
      res.json({
        success: true,
        data: {
          url: stored.url ?? stored.path,
          originalName: req.file.originalname,
          mimeType: req.file.mimetype,
        },
        message: "File uploaded",
        meta: {},
      });
    } catch (error) {
      next(error);
    }
  });
  router.post("/landing/gallery/upload", ...chairmanOnly, galleryFileUpload.array("images", 24), async (req, res, next) => {
    const files = Array.isArray(req.files) ? req.files : [];

    if (files.length === 0) {
      res.status(400).json({ success: false, message: "No images provided", errors: [] });
      return;
    }

    try {
      const uploaded = await Promise.all(files.map(async (file) => {
        const ext = path.extname(file.originalname) || ".bin";
        const stored = await storageProvider().put({
          key: `gallery/${crypto.randomBytes(16).toString("hex")}${ext}`,
          visibility: "public",
          body: file.buffer,
          contentType: file.mimetype,
        });
        return {
          url: stored.url ?? stored.path,
          originalName: file.originalname,
          mimeType: file.mimetype,
        };
      }));
      res.json({
        success: true,
        data: {
          url: uploaded[0]?.url,
          urls: uploaded.map((file) => file.url),
          files: uploaded,
        },
        message: "Gallery images uploaded",
        meta: {},
      });
    } catch (error) {
      next(error);
    }
  });
  router.put("/landing/gallery-slots/:slotKey", ...chairmanOnly, controller.updateGallerySlot);
  router.get("/landing/:collection", ...chairmanOnly, controller.list);
  router.post("/landing/:collection", ...chairmanOnly, controller.create);
  router.patch("/landing/:collection/:id", ...chairmanOnly, controller.update);
  router.get("/system-settings", ...chairmanOnly, controller.listSettings);
  router.put("/system-settings", ...chairmanOnly, controller.upsertSetting);
  router.get("/audit-logs", ...chairmanOnly, controller.listAuditLogs);

  return router;
}
