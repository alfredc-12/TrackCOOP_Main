import { Router, type RequestHandler } from "express";
import rateLimit from "express-rate-limit";
import multer from "multer";
import { createAuthenticate } from "../../middleware/authenticate";
import { requireRoles } from "../../middleware/authorize";
import { env } from "../../config/env";
import { AppError } from "../../utils/app-error";
import { createAuthService, type AuthService } from "../auth/auth.service";
import { createMembershipApplicationController } from "./membership-application.controller";
import { createMembershipApprovalController } from "./membership-application.approval.controller";
import {
  createMembershipApprovalConversionService,
  type MembershipApprovalConversionService,
} from "./membership-application.approval-conversion";
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

function frameAncestorSources() {
  return [
    "'self'",
    ...new Set(
      [env.FRONTEND_URL, ...env.CORS_ALLOWED_ORIGINS]
        .map((origin) => {
          try {
            return new URL(origin).origin;
          } catch {
            return null;
          }
        })
        .filter((origin): origin is string => Boolean(origin)),
    ),
  ].join(" ");
}

const allowDocumentPreviewFrame: RequestHandler = (_request, response, next) => {
  response.removeHeader("X-Frame-Options");
  response.setHeader(
    "Content-Security-Policy",
    `default-src 'none'; img-src 'self' data: blob:; style-src 'unsafe-inline'; frame-ancestors ${frameAncestorSources()}`,
  );
  next();
};

function createPublicLimiter(input: {
  windowMs: number;
  limit: number;
  message: string;
}) {
  return rateLimit({
    windowMs: input.windowMs,
    limit: input.limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
      success: false,
      message: input.message,
      errors: [
        {
          code: "MEMBERSHIP_APPLICATION_RATE_LIMITED",
          message: input.message,
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
  membershipApprovalService?: MembershipApprovalConversionService,
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
  const approvalService = membershipApprovalService
    ?? (membershipApplicationService ? null : createMembershipApprovalConversionService());
  const approvalController = approvalService
    ? createMembershipApprovalController(approvalService)
    : null;
  const publicSubmissionLimiter = createPublicLimiter({
    windowMs: 60 * 60 * 1000,
    limit: 5,
    message: "Too many membership application submissions. Please try again later.",
  });
  const publicStatusLimiter = createPublicLimiter({
    windowMs: 15 * 60 * 1000,
    limit: 60,
    message: "Too many status checks. Please wait a few minutes before trying again.",
  });
  const publicDocumentLimiter = createPublicLimiter({
    windowMs: 60 * 60 * 1000,
    limit: 20,
    message: "Too many document upload requests. Please try again later.",
  });
  const chairmanOnly = [createAuthenticate(authService), requireRoles("chairman")];

  router.post(
    "/membership-applications/public",
    publicSubmissionLimiter,
    controller.submitPublic,
  );
  router.get(
    "/membership-applications/public/:applicationCode/status",
    publicStatusLimiter,
    publicStatus,
  );
  router.post(
    "/membership-applications/public/:applicationCode/activation-link",
    publicStatusLimiter,
    controller.issuePublicActivationLink,
  );
  router.post(
    "/membership-applications/public/:applicationCode/documents",
    publicDocumentLimiter,
    documentUploadMiddleware,
    controller.uploadPublicDocument,
  );
  router.get(
    "/membership-applications/public/:applicationCode/documents/:documentId/view",
    publicStatusLimiter,
    allowDocumentPreviewFrame,
    controller.viewPublicDocument,
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
  router.get(
    "/membership-application-documents/:id/view",
    allowDocumentPreviewFrame,
    ...chairmanOnly,
    controller.viewDocument,
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
  router.delete(
    "/membership-application-requirements/:id",
    ...chairmanOnly,
    controller.deleteRequirement,
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
  router.post(
    "/membership-applications/:id/approve-for-payment",
    ...chairmanOnly,
    controller.approveForPayment,
  );
  router.post("/membership-applications/:id/reject", ...chairmanOnly, controller.reject);
  router.post("/membership-applications/:id/withdraw", ...chairmanOnly, controller.withdraw);
  router.post(
    "/membership-applications/:id/approve",
    ...chairmanOnly,
    approvalController?.approve ?? controller.approve,
  );
  if (approvalController) {
    router.post(
      "/membership-applications/:id/reconcile-capital",
      ...chairmanOnly,
      approvalController.reconcileCapital,
    );
  }
  router.get("/membership-applications/:id/print", ...chairmanOnly, controller.print);

  return router;
}
