import { Router } from "express";
import crypto from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";
import multer from "multer";
import { createAuthenticate } from "../../middleware/authenticate";
import { requireRoles } from "../../middleware/authorize";
import { createAuthService, type AuthService } from "../auth/auth.service";
import { createLandingController } from "./landing.controller";
import { createLandingService, type LandingService } from "./landing.service";

const partnerFileStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const destination = path.join(process.cwd(), "public", "uploads", "partners-certifications");
    mkdirSync(destination, { recursive: true });
    cb(null, destination);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || ".bin";
    cb(null, `${crypto.randomBytes(16).toString("hex")}${ext}`);
  },
});

const partnerFileUpload = multer({
  storage: partnerFileStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/") || file.mimetype === "application/pdf") {
      cb(null, true);
      return;
    }
    cb(new Error("Only image and PDF files are allowed."));
  },
});

const galleryFileStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const destination = path.join(process.cwd(), "public", "uploads", "gallery");
    mkdirSync(destination, { recursive: true });
    cb(null, destination);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || ".bin";
    cb(null, `${crypto.randomBytes(16).toString("hex")}${ext}`);
  },
});

const galleryFileUpload = multer({
  storage: galleryFileStorage,
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
  router.post("/landing/partners/upload", ...chairmanOnly, partnerFileUpload.single("file"), (req, res) => {
    if (!req.file) {
      res.status(400).json({ success: false, message: "No file provided", errors: [] });
      return;
    }

    res.json({
      success: true,
      data: {
        url: `/uploads/partners-certifications/${req.file.filename}`,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
      },
      message: "File uploaded",
      meta: {},
    });
  });
  router.post("/landing/gallery/upload", ...chairmanOnly, galleryFileUpload.array("images", 24), (req, res) => {
    const files = Array.isArray(req.files) ? req.files : [];

    if (files.length === 0) {
      res.status(400).json({ success: false, message: "No images provided", errors: [] });
      return;
    }

    const urls = files.map((file) => `/uploads/gallery/${file.filename}`);
    res.json({
      success: true,
      data: {
        url: urls[0],
        urls,
        files: files.map((file, index) => ({
          url: urls[index],
          originalName: file.originalname,
          mimeType: file.mimetype,
        })),
      },
      message: "Gallery images uploaded",
      meta: {},
    });
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
