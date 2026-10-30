import { Router } from "express";
import { z } from "zod";
import { createAuthenticate } from "../../middleware/authenticate";
import { requireRoles } from "../../middleware/authorize";
import { AppError } from "../../utils/app-error";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess } from "../../utils/response";
import { createAuthService, type AuthService } from "../auth/auth.service";
import { createPatronageCapitalRepository, type PatronageCapitalRepository } from "./patronage-capital.repository";

export const patronageCapitalRequestSchema = z.object({
  allocationId: z.string().regex(/^\d+$/),
  amount: z.number().positive().max(999_999_999_999.99).refine((amount) => Math.abs(amount * 100 - Math.round(amount * 100)) < 0.000001, "Use no more than two decimal places."),
  requestKey: z.uuid(),
});
const decisionSchema = z.object({ decision: z.enum(["Approve", "Reject"]), notes: z.string().trim().max(500).nullable().optional() });

function requireAuth(auth: Express.Request["auth"]) {
  if (!auth) throw new AppError("Authentication is required.", 401, "UNAUTHENTICATED");
  return auth;
}

export function createPatronageCapitalRouter(
  authService: AuthService = createAuthService(),
  repository: PatronageCapitalRepository = createPatronageCapitalRepository(),
) {
  const router = Router();
  const member = [createAuthenticate(authService), requireRoles("member")];
  const staff = [createAuthenticate(authService), requireRoles("chairman", "bookkeeper")];
  const bookkeeper = [createAuthenticate(authService), requireRoles("bookkeeper")];
  router.get("/members/me/patronage-capital", ...member, asyncHandler(async (request, response) => {
    return sendSuccess(response, await repository.overview(requireAuth(request.auth)));
  }));
  router.post("/members/me/patronage-capital", ...member, asyncHandler(async (request, response) => {
    const parsed = patronageCapitalRequestSchema.safeParse(request.body);
    if (!parsed.success) throw new AppError("Choose a refund and enter a valid amount with up to two decimal places.", 400, "VALIDATION_ERROR");
    return sendSuccess(response, await repository.request(parsed.data, requireAuth(request.auth)), { statusCode: 201, message: "Request sent to the Bookkeeper. Your Share Capital will change after approval." });
  }));
  router.get("/patronage/capital-transfers", ...staff, asyncHandler(async (_request, response) => {
    return sendSuccess(response, await repository.list());
  }));
  router.post("/patronage/capital-transfers/:id/decision", ...bookkeeper, asyncHandler(async (request, response) => {
    const parsed = decisionSchema.safeParse(request.body);
    const id = z.string().regex(/^\d+$/).safeParse(request.params.id);
    if (!parsed.success || !id.success) throw new AppError("The transfer decision is invalid.", 400, "VALIDATION_ERROR");
    return sendSuccess(response, await repository.decide(id.data, parsed.data, requireAuth(request.auth)));
  }));
  return router;
}
