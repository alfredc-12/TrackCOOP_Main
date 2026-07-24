import { Router, type RequestHandler } from "express";
import rateLimit from "express-rate-limit";
import multer from "multer";
import { AppError } from "../../utils/app-error";
import { createMembershipApplicationController } from "./membership-application.controller";
import {
  createMembershipApplicationService,
  isAllowedMembershipDocumentExtension,
  isAllowedMembershipDocumentMimeType,
  type MembershipApplicationService,
} from "./membership-application.service";

const maxDocumentSizeBytes = 5 * 1024 * 1024;

function createPublicLimiter() {
  return rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 5,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
      success: false,
      message: "Too many membership application requests. Please try again later.",
      errors: [
        {
          code: "MEMBERSHIP_APPLICATION_RATE_LIMITED",
          message: "Too many membership application requests. Please try again later.",
        },
      ],
    },
  });
}

const documentUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: maxDocumentSizeBytes,
    files: 1,
  },
  fileFilter(_request, file, callback) {
    if (
      !isAllowedMembershipDocumentMimeType(file.mimetype) ||
      !isAllowedMembershipDocumentExtension(file.originalname, file.mimetype)
    ) {
      callback(
        new AppError(
          "Document file type is not allowed",
          400,
          "MEMBERSHIP_DOCUMENT_TYPE_INVALID",
        ),
      );
      return;
    }

    callback(null, true);
  },
}).single("document");

const documentUploadMiddleware: RequestHandler = (request, response, next) => {
  documentUpload(request, response, (error) => {
    if (!error) {
      next();
      return;
    }

    if (error instanceof AppError) {
      next(error);
      return;
    }

    if (error instanceof multer.MulterError) {
      next(
        new AppError(
          "Document upload is invalid",
          400,
          "MEMBERSHIP_DOCUMENT_UPLOAD_INVALID",
          [{ code: error.code, message: error.message }],
        ),
      );
      return;
    }

    next(
      new AppError(
        "Document upload failed",
        400,
        "MEMBERSHIP_DOCUMENT_UPLOAD_FAILED",
      ),
    );
  });
};

export function createMembershipApplicationRouter(
  membershipApplicationService: MembershipApplicationService = createMembershipApplicationService(),
) {
  const router = Router();
  const controller = createMembershipApplicationController(membershipApplicationService);
  const publicLimiter = createPublicLimiter();

  router.post(
    "/membership-applications/public",
    publicLimiter,
    controller.submitPublic,
  );
  router.get(
    "/membership-applications/public/:applicationCode/status",
    publicLimiter,
    controller.publicStatus,
  );
  router.post(
    "/membership-applications/public/:applicationCode/documents",
    publicLimiter,
    documentUploadMiddleware,
    controller.uploadPublicDocument,
  );

  return router;
}
