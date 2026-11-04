import type { Request, Response, NextFunction } from "express";
import { AppError } from "../../utils/app-error";
import { Router } from "express";
import { z } from "zod";
import { createAuthenticate } from "../../middleware/authenticate";
import { requireRoles } from "../../middleware/authorize";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess } from "../../utils/response";
import type { AuthService } from "../auth/auth.service";
import {
  createGalleryPlacementRepository,
  type GalleryPlacementRepository,
} from "./gallery-placement.repository";
import {
  librarySchema,
  parse,
  placementSchema,
} from "./gallery-placement.policy";
export function createGalleryPlacementRouter(
  auth: AuthService,
  repo: GalleryPlacementRepository = createGalleryPlacementRepository(),
) {
  const router = Router();
  const access = [createAuthenticate(auth), requireRoles("chairman")];
  router.use(
    ["/landing/gallery-library", "/landing/gallery-placement"],
    (_r, res, next) => {
      res.setHeader("Cache-Control", "private, no-store");
      next();
    },
  );
  router.get(
    "/landing/gallery-library",
    ...access,
    asyncHandler(async (req, res) =>
      sendSuccess(res, await repo.groups(parse(librarySchema, req.query))),
    ),
  );
  router.get(
    "/landing/gallery-library/:source/:id",
    ...access,
    asyncHandler(async (req, res) => {
      const p = parse(
        z.object({
          source: z.enum(["gallery", "announcement"]),
          id: z.string().regex(/^[1-9]\d{0,19}$/),
        }),
        req.params,
      );
      const q = parse(
        z.object({
          page: z.coerce.number().int().min(1).max(100000).default(1),
        }),
        req.query,
      );
      return sendSuccess(res, await repo.groupPhotos(p.source, p.id, q.page));
    }),
  );
  router.get(
    "/landing/gallery-placement",
    ...access,
    asyncHandler(async (_req, res) => sendSuccess(res, await repo.snapshot())),
  );
  router.post(
    "/landing/gallery-placement/proposal",
    ...access,
    asyncHandler(async (req, res) =>
      sendSuccess(
        res,
        await repo.proposal(
          parse(
            z
              .object({
                excluded: z
                  .array(z.string().regex(/^(gallery|announcement):[1-9]\d*$/))
                  .max(500)
                  .default([]),
              })
              .default({ excluded: [] }),
            req.body,
          ).excluded,
        ),
      ),
    ),
  );
  router.put(
    "/landing/gallery-placement",
    ...access,
    asyncHandler(async (req, res) =>
      sendSuccess(
        res,
        await repo.publish(parse(placementSchema, req.body), req.auth!.user.id),
      ),
    ),
  );
  router.use(
    (error: unknown, _req: Request, _res: Response, next: NextFunction) => {
      if (
        ["ER_NO_SUCH_TABLE", "ER_BAD_FIELD_ERROR"].includes(
          String((error as { code?: string })?.code),
        )
      )
        return next(
          new AppError(
            "Homepage photo placement is not ready yet. Ask your system administrator to complete the gallery setup.",
            503,
            "GALLERY_SETUP_REQUIRED",
          ),
        );
      next(error);
    },
  );
  return router;
}
