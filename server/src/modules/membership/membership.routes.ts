import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { Router } from "express";
import multer from "multer";
import { createAuthenticate } from "../../middleware/authenticate";
import { requireRoles } from "../../middleware/authorize";
import { protectedUploadRoot } from "../../storage/protected-storage";
import type { AuthService } from "../auth/auth.service";
import { createAuthService } from "../auth/auth.service";
import { createMembershipController } from "./membership.controller";
import {
  createMembershipService,
  type MembershipService,
} from "./membership.service";

const allowedMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "application/pdf",
]);

function createUpload(folder: string) {
  const destination = path.join(protectedUploadRoot, folder);
  mkdirSync(destination, { recursive: true });
  return multer({
    storage: multer.diskStorage({
      destination,
      filename: (_request, file, callback) => {
        const extension =
          file.mimetype === "application/pdf"
            ? ".pdf"
            : file.mimetype === "image/png"
              ? ".png"
              : ".jpg";
        callback(null, `${randomUUID()}${extension}`);
      },
    }),
    limits: { fileSize: 5 * 1024 * 1024, files: 5 },
    fileFilter: (_request, file, callback) => {
      callback(null, allowedMimeTypes.has(file.mimetype));
    },
  });
}

export function createMembershipRouter(
  authService: AuthService = createAuthService(),
  membershipService: MembershipService = createMembershipService(),
) {
  const router = Router();
  const controller = createMembershipController(membershipService);
  const authenticate = createAuthenticate(authService);
  const chairmanOnly = [authenticate, requireRoles("chairman")];
  const bookkeeperOnly = [authenticate, requireRoles("bookkeeper")];
  const documentUpload = createUpload("membership-applications");
  const paymentUpload = createUpload("membership-payments");

  router.post(
    "/public/membership/applications",
    documentUpload.array("documents", 5),
    controller.submit,
  );
  router.post("/public/membership/application-status", controller.lookup);
  router.post(
    "/public/membership/applications/additional-information",
    documentUpload.array("documents", 5),
    controller.additionalInformation,
  );
  router.post(
    "/public/membership/payments",
    paymentUpload.single("proof"),
    controller.payment,
  );
  router.post("/public/membership/activate", controller.activate);

  router.get("/membership/applications", ...chairmanOnly, controller.list);
  router.get(
    "/membership/applications/:id",
    ...chairmanOnly,
    controller.detail,
  );
  router.get(
    "/membership/applications/:id/documents/:documentId",
    ...chairmanOnly,
    controller.document,
  );
  router.post(
    "/membership/applications/:id/review",
    ...chairmanOnly,
    controller.review,
  );
  router.post(
    "/membership/applications/:id/account",
    ...chairmanOnly,
    controller.createAccount,
  );

  router.get("/membership/payments", ...bookkeeperOnly, controller.payments);
  router.get(
    "/membership/payments/:id/proof",
    ...bookkeeperOnly,
    controller.paymentProof,
  );
  router.post(
    "/membership/payments/:id/validate",
    ...bookkeeperOnly,
    controller.validatePayment,
  );

  return router;
}
