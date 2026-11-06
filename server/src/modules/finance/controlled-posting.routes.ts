import { Router } from "express";
import { z, ZodError } from "zod";
import { createAuthenticate } from "../../middleware/authenticate";
import { requireRoles } from "../../middleware/authorize";
import { createAuthService, type AuthService } from "../auth/auth.service";
import { AppError } from "../../utils/app-error";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess } from "../../utils/response";
import { controlledDraftSchema, controlledDraftEditSchema } from "./controlled-posting.schema";
import { createControlledPostingRepository, type ControlledPostingRepository } from "./controlled-posting.repository";
const id = z.string().regex(/^[1-9]\d{0,19}$/);
const create = z.object({ recordId: id, idempotencyKey: z.string().regex(/^[a-f0-9]{64}$/) }).strict();
const expected = z.object({ expectedVersion: z.number().int().positive().max(4294967294) }).strict();
const posting = expected.extend({ idempotencyKey: z.string().regex(/^[a-f0-9]{64}$/) }).strict();
const decision = expected.extend({ reason: z.string().trim().min(1).max(2000) }).strict();
function parse<T>(fn: () => T): T { try { return fn(); } catch (error) { if (error instanceof ZodError) throw new AppError("Invalid controlled finance request",422,"INVALID_CONTROLLED_REQUEST"); throw error; } }
export function createControlledPostingRouter(auth: AuthService = createAuthService(), repository: ControlledPostingRepository = createControlledPostingRepository()) {
  const router = Router();
  const staff = [createAuthenticate(auth), requireRoles("chairman","bookkeeper")];
  const maker = [createAuthenticate(auth), requireRoles("bookkeeper")];
  const checker = [createAuthenticate(auth), requireRoles("chairman")];
  router.use("/finance/controlled-operations", (_req,res,next) => { res.setHeader("Cache-Control","private, no-store"); next(); });
  router.post("/finance/controlled-operations/corrections", ...maker, asyncHandler(async (req,res) => {
    const body=parse(() => z.object({recordId:id,idempotencyKey:z.string().regex(/^[a-f0-9]{64}$/),reason:z.string().trim().min(1).max(2000)}).strict().parse(req.body));
    return sendSuccess(res,await repository.requestLegacyCorrection(body.recordId,body.idempotencyKey,body.reason,req.auth!),{statusCode:201});
  }));
  router.post("/finance/controlled-operations/drafts", ...maker, asyncHandler(async (req,res) => {
    const body = parse(() => controlledDraftSchema.parse(req.body));
    return sendSuccess(res,await repository.createDraft(body,req.auth!),{ statusCode: 201 });
  }));
  router.post("/finance/controlled-operations", ...maker, asyncHandler(async (req,res) => {
    const body = parse(() => create.parse(req.body));
    return sendSuccess(res,await repository.create(body.recordId,body.idempotencyKey,req.auth!),{ statusCode: 201 });
  }));
  router.patch("/finance/controlled-operations/:id", ...maker, asyncHandler(async (req,res) => {
    const body=parse(() => z.object({ expectedVersion:z.number().int().positive().max(4294967294), draft:controlledDraftEditSchema }).strict().parse(req.body));
    return sendSuccess(res,await repository.editDraft(parse(() => id.parse(req.params.id)),body.expectedVersion,body.draft,req.auth!));
  }));
  router.get("/finance/controlled-operations/:id", ...staff, asyncHandler(async (req,res) => sendSuccess(res,await repository.get(parse(() => id.parse(req.params.id)),req.auth!))));
  router.post("/finance/controlled-operations/:id/evaluate", ...maker, asyncHandler(async (req,res) => {
    const body = parse(() => expected.parse(req.body));
    return sendSuccess(res,await repository.refresh(parse(() => id.parse(req.params.id)),body.expectedVersion,req.auth!));
  }));
  for (const action of ["approve","reject"] as const) router.post(`/finance/controlled-operations/:id/${action}`, ...checker, asyncHandler(async (req,res) => {
    const body = parse(() => decision.parse(req.body));
    return sendSuccess(res,await repository.decide(parse(() => id.parse(req.params.id)),body.expectedVersion,action,body.reason,req.auth!));
  }));
  router.post("/finance/controlled-operations/:id/request-correction", ...maker, asyncHandler(async (req,res) => {
    const body = parse(() => decision.parse(req.body));
    return sendSuccess(res,await repository.requestCorrection(parse(() => id.parse(req.params.id)),body.expectedVersion,body.reason,req.auth!));
  }));
  router.post("/finance/controlled-operations/:id/post", ...maker, asyncHandler(async (req,res) => {
    const body = parse(() => posting.parse(req.body));
    const result = await repository.post(parse(() => id.parse(req.params.id)),body.expectedVersion,body.idempotencyKey,req.auth!);
    if ("blocked" in result && result.blocked) throw new AppError("Controlled budget check blocked posting", result.state === "BUDGET_UNAVAILABLE" ? 503 : 409, result.state);
    return sendSuccess(res,result);
  }));
  return router;
}
