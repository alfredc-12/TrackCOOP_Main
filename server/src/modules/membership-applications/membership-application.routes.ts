import { Router, type RequestHandler } from "express";
import rateLimit from "express-rate-limit";
import multer from "multer";
import { createAuthenticate } from "../../middleware/authenticate";
import { requireRoles } from "../../middleware/authorize";
import { AppError } from "../../utils/app-error";
import { createAuthService, type AuthService } from "../auth/auth.service";
import { createMembershipApplicationController } from "./membership-application.controller";
import { createPublicMembershipApplicationStatusHandler } from "./membership-application.public-payment.controller";
import {
  createPublicMembershipPaymentService,
  type PublicMembershipPaymentService,
} from "./membership-application.public-payment.service";
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
  authService: AuthService = createAuthService(),
  membershipApplicationService?: MembershipApplicationService,
  publicPaymentService?: PublicMembershipPaymentService,
) {
  const router = Router();
  const applicationService = membershipApplicationService
    ?? createMembershipApplicationService();
  const controller = createMembershipApplicationController(applicationService);
  const paymentService = publicPaymentService
    ?? (membershipApplicationService ? null : createPublicMembershipPaymentService());
  const publicStatus = paymentService
    ? createPublicMembershipApplicationStatusHandler(applicationService, paymentService)
    : controller.publicStatus;
  const publicLimiter = createPublicLimiter();
  const chairmanOnly = [createAuthenticate(authService), requireRoles("chairman")];

  router.post(
    "/membership-applications/public",
    publicLimiter,
    controller.submitPublic,
  );
  router.get(
    "/membership-applications/public/:applicationCode/status",
    publicLimiter,
    publicStatus,
  );
  router.post(
    "/membership-applications/public/:applicationCode/documents",
    publicLimiter,
    documentUploadMiddleware,
    controller.uploadPublicDocument,
  );

  router.get("/membership-applications/summary", ...chairmanOnly, controller.summary);
  router.get("/membership-applications", ...chairmanOnly, controller.list);
  router.post("/membership-applications", ...chairmanOnly, controller.createChairman);
  router.get("/membership-applications/:id", ...chairmanOnly, controller.detail);
  router.patch("/membership-applications/:id", ...chairmanOnly, controller.update);
  router.post(
    "/membership-applications/:id/beneficiaries",
    ...chairmanOnly,
    controller.createBeneficiary,
  );
  router.patch(
    "/membership-application-beneficiaries/:id",
    ...chairmanOnly,
    controller.updateBeneficiary,
  );
  router.delete(
    "/membership-application-beneficiaries/:id",
    ...chairmanOnly,
    controller.deleteBeneficiary,
  );
  router.post(
    "/membership-applications/:id/documents",
    ...chairmanOnly,
    documentUploadMiddleware,
    controller.uploadChairmanDocument,
  );
  router.delete(
    "/membership-application-documents/:id",
    ...chairmanOnly,
    controller.deleteDocument,
  );
  router.post(
    "/membership-applications/:id/requirements",
    ...chairmanOnly,
    controller.createRequirement,
  );
  router.patch(
    "/membership-application-requirements/:id",
    ...chairmanOnly,
    controller.updateRequirement,
  );
  router.get("/membership-applications/:id/history", ...chairmanOnly, controller.history);
  router.post(
    "/membership-applications/:id/start-review",
    ...chairmanOnly,
    controller.startReview,
  );
  router.post(
    "/membership-applications/:id/request-information",
    ...chairmanOnly,
    controller.requestInformation,
  );
  router.post("/membership-applications/:id/reject", ...chairmanOnly, controller.reject);
  router.post("/membership-applications/:id/withdraw", ...chairmanOnly, controller.withdraw);
  router.post("/membership-applications/:id/approve", ...chairmanOnly, controller.approve);
  router.get("/membership-applications/:id/print", ...chairmanOnly, controller.print);

  return router;
}
