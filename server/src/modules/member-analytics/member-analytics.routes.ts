import { Router } from "express";
import { z } from "zod";
import { createAuthenticate } from "../../middleware/authenticate";
import { requireRoles } from "../../middleware/authorize";
import { createAuthService, type AuthService } from "../auth/auth.service";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess } from "../../utils/response";
import { AppError } from "../../utils/app-error";
import { listMembersQuerySchema } from "../members/member.schema";
import { parseAnalyticsFilters } from "./member-analytics.filters";
import { createMemberAnalyticsService, type MemberAnalyticsService } from "./member-analytics.service";
import { exportAnalyticsWorkbook } from "./member-analytics.export";

export function createMemberAnalyticsRouter(auth: AuthService = createAuthService(), service: MemberAnalyticsService = createMemberAnalyticsService()) {
  const router = Router();
  const access = [createAuthenticate(auth), requireRoles("chairman")];
  router.get("/chairman/member-analytics", ...access, asyncHandler(async (req, res) => {
    res.setHeader("Cache-Control", "private, no-store");
    return sendSuccess(res, await service.report(parseAnalyticsFilters(req.query)));
  }));
  router.get("/chairman/member-analytics/export", ...access, asyncHandler(async (req, res) => {
    const report = await service.report(parseAnalyticsFilters(req.query));
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="member-analytics-${report.filters.asOf}.xlsx"`);
    res.send(await exportAnalyticsWorkbook(report));
  }));
  router.get("/chairman/member-analytics/matching-members", ...access, asyncHandler(async (req, res) => {
    const parsed = listMembersQuerySchema.safeParse({ ...req.query, membershipType: req.query.directoryMembershipType, barangay: req.query.directoryBarangay, approvalStatus: req.query.directoryApprovalStatus, officialMemberStatus: req.query.directoryOfficialStatus });
    const selection = z.object({ kind: z.enum(["attention", "new", "overdue", "deadline", "engagement", "capital", "sector", "month", "barangay"]).optional(), value: z.string().max(120).optional(), sector: z.string().max(120).optional() }).safeParse({ kind: req.query.selection, value: req.query.value, sector: req.query.cellSector });
    if (!parsed.success || !selection.success) throw new AppError("Invalid matching-member query", 400, "VALIDATION_ERROR");
    const result = await service.matching(parseAnalyticsFilters(req.query), selection.data, parsed.data);
    res.setHeader("Cache-Control", "private, no-store");
    return sendSuccess(res, result.members, { meta: { total: result.total, page: result.page, pageSize: result.pageSize } });
  }));
  return router;
}
