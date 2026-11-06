import { Router } from "express";
import { z, ZodError } from "zod";
import { createAuthenticate } from "../../middleware/authenticate";
import { requireRoles } from "../../middleware/authorize";
import { createAuthService, type AuthService } from "../auth/auth.service";
import { asyncHandler } from "../../utils/async-handler";
import { AppError } from "../../utils/app-error";
import { sendSuccess } from "../../utils/response";
import { assessConfiguration, policyKind, validateConfig } from "./financial-policy.model";
import { createFinancialPolicyRepository, type FinancialPolicyRepository } from "./financial-policy.repository";

const version = z.number().int().min(0).max(4294967294);
const draft = z.object({ expectedVersion: version, configuration: z.unknown() }).strict();
const approve = z.object({ expectedVersion: version, effectiveAt: z.string().datetime({ offset: true }) }).strict();
function parse<T>(fn: () => T): T {
  try { return fn(); } catch (error) {
    if (error instanceof ZodError) throw new AppError("Invalid policy configuration.", 422, "INVALID_POLICY_CONFIGURATION");
    throw error;
  }
}
export function createFinancialPolicyRouter(auth: AuthService = createAuthService(), repository: FinancialPolicyRepository = createFinancialPolicyRepository()) {
  const router = Router();
  router.use("/financial-policy", (_req, res, next) => { res.setHeader("Cache-Control", "private, no-store"); next(); });
  const chairman = [createAuthenticate(auth), requireRoles("chairman")];
  router.get("/financial-policy", ...chairman, asyncHandler(async (_req, res) => {
    const [threshold, restrictions] = await Promise.all([repository.history("threshold"), repository.history("restrictions")]);
    return sendSuccess(res, { threshold, restrictions, assessment: assessConfiguration(threshold[0] ?? null, restrictions[0] ?? null, new Date()) });
  }));
  router.post("/financial-policy/:kind/drafts", ...chairman, asyncHandler(async (req, res) => {
    const kind = parse(() => policyKind.parse(req.params.kind));
    const body = parse(() => draft.parse(req.body));
    const configuration = parse(() => validateConfig(kind, body.configuration));
    return sendSuccess(res, await repository.save(kind, body.expectedVersion, req.auth!.user.id, { type: "draft", config: configuration }), { statusCode: 201 });
  }));
  router.post("/financial-policy/:kind/approve", ...chairman, asyncHandler(async (req, res) => {
    const kind = parse(() => policyKind.parse(req.params.kind));
    const body = parse(() => approve.parse(req.body));
    if (!Number.isFinite(Date.parse(body.effectiveAt))) throw new AppError("Invalid effective timestamp.", 422, "INVALID_POLICY_CONFIGURATION");
    return sendSuccess(res, await repository.save(kind, body.expectedVersion, req.auth!.user.id, { type: "approve", effectiveAt: body.effectiveAt }), { statusCode: 201 });
  }));
  return router;
}
