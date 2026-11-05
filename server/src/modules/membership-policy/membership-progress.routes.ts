import { Router } from "express";
import type { Pool, RowDataPacket } from "mysql2/promise";
import { z } from "zod";
import { getPool } from "../../db/pool";
import { createAuthenticate } from "../../middleware/authenticate";
import { requireRoles } from "../../middleware/authorize";
import { createAuthService, type AuthService } from "../auth/auth.service";
import { asyncHandler } from "../../utils/async-handler";
import { AppError } from "../../utils/app-error";
import { withTransaction } from "../../db/transaction";
import {
  capitalCases,
  caseProgress,
  monthlyCapitalProgress,
} from "./membership-progress.repository";
import { readSectors, saveSectors, SECTORS } from "./membership-sectors";
import { manilaDate } from "./membership-policy";
function parseQuery<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success)
    throw new AppError(
      "Invalid membership query",
      400,
      "MEMBERSHIP_QUERY_INVALID",
    );
  return result.data;
}
const pageSchema = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
});
export function createMembershipProgressRouter(
  authService: AuthService = createAuthService(),
  pool?: Pool,
) {
  const db = () => pool ?? getPool();
  const router = Router();
  const member = [createAuthenticate(authService), requireRoles("member")];
  const staff = [
    createAuthenticate(authService),
    requireRoles("chairman", "bookkeeper"),
  ];
  async function ownMember(userId: string) {
    const [rows] = await db().execute<RowDataPacket[]>(
      "SELECT CAST(member_id AS CHAR) AS id,membership_type AS membershipType,DATE_FORMAT(share_capital_deadline,'%Y-%m-%d') AS deadline FROM member_profiles WHERE user_id=? LIMIT 1",
      [userId],
    );
    if (!rows[0])
      throw new AppError(
        "Member profile not found",
        404,
        "MEMBER_PROFILE_NOT_FOUND",
      );
    return rows[0];
  }
  const success = (data: unknown) => ({
    success: true,
    data,
    message: "Membership records loaded",
    meta: {},
  });
  router.get(
    "/members/me/membership-progress",
    ...member,
    asyncHandler(async (req, res) => {
      const m = await ownMember(req.auth!.user.id);
      const cases = await capitalCases(
        db(),
        "c.member_id=? AND c.closed_at IS NULL",
        [m.id],
      );
      const [totals] = await db().execute<RowDataPacket[]>(
        `SELECT COALESCE((SELECT current_balance FROM share_capital_accounts WHERE member_id=?),
   (SELECT COALESCE(SUM(amount),0) FROM share_capital_payments WHERE member_id=? AND payment_status='Validated')) AS validated`,
        [m.id, m.id],
      );
      res.json(
        success({
          membershipType: m.membershipType,
          sectors: await readSectors(db(), "member", m.id),
          capital: cases[0] ? await caseProgress(db(), cases[0]) : null,
          validatedCapital: Number(totals[0]?.validated ?? 0),
          legacyReviewRequired: !cases[0],
          legacyDeadline: m.deadline ?? null,
        }),
      );
    }),
  );
  router.put(
    "/members/me/membership-sectors",
    ...member,
    asyncHandler(async (req, res) => {
      const input = parseQuery(
        z.object({
          sectors: z
            .array(z.enum(SECTORS))
            .min(1)
            .max(6)
            .refine((s) => new Set(s).size === s.length),
        }),
        req.body,
      );
      const m = await ownMember(req.auth!.user.id);
      await withTransaction(async (connection) => {
        await connection.execute(
          "SELECT member_id FROM member_profiles WHERE member_id=? FOR UPDATE",
          [m.id],
        );
        await saveSectors(connection, "member", m.id, input.sectors);
        await connection.execute(
          "UPDATE member_profiles SET sector=? WHERE member_id=?",
          [input.sectors[0], m.id],
        );
        await connection.execute(
          "INSERT INTO audit_logs(user_id,action,entity_table,record_id,description,new_values) VALUES(?,'member.sectors_updated','member_profiles',?,'Member updated agricultural sectors.',?)",
          [req.auth!.user.id, m.id, JSON.stringify(input)],
        );
      }, db());
      res.json(success(input));
    }),
  );
  router.get(
    "/members/me/referrals",
    ...member,
    asyncHandler(async (req, res) => {
      const m = await ownMember(req.auth!.user.id);
      const { page, pageSize } = parseQuery(pageSchema, req.query);
      const [counts] = await db().execute<RowDataPacket[]>(
        "SELECT COUNT(*) AS total FROM member_referrals WHERE referrer_member_id=?",
        [m.id],
      );
      const [items] = await db().execute<RowDataPacket[]>(
        `SELECT CAST(r.member_referral_id AS CHAR) AS id,r.referral_status AS status,
   a.application_code AS applicationCode,CONCAT(LEFT(a.first_name,1),'. ',a.last_name) AS applicantName,
   r.created_at AS createdAt,r.qualified_at AS qualifiedAt FROM member_referrals r
   JOIN membership_applications a ON a.membership_application_id=r.membership_application_id
   WHERE r.referrer_member_id=? ORDER BY r.created_at DESC,r.member_referral_id DESC LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`,
        [m.id],
      );
      res.json(
        success({
          items,
          total: Number(counts[0]?.total ?? 0),
          page,
          pageSize,
        }),
      );
    }),
  );
  router.get(
    "/members/me/membership-payments",
    ...member,
    asyncHandler(async (req, res) => {
      const m = await ownMember(req.auth!.user.id);
      const { page, pageSize } = parseQuery(pageSchema, req.query);
      const ownership = `(p.member_id=? OR (p.related_entity_type='membership_application' AND EXISTS(SELECT 1 FROM membership_applications a WHERE a.membership_application_id=p.related_entity_id AND a.converted_member_id=?)))`;
      const [counts] = await db().execute<RowDataPacket[]>(
        `SELECT COUNT(*) AS total FROM payment_references p WHERE ${ownership}`,
        [m.id, m.id],
      );
      const [items] = await db().execute<RowDataPacket[]>(
        `SELECT p.reference_number AS reference,p.payment_purpose AS purpose,p.amount,p.validation_status AS status,p.submitted_at AS submittedAt FROM payment_references p WHERE ${ownership} ORDER BY p.submitted_at DESC,p.payment_reference_id DESC LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`,
        [m.id, m.id],
      );
      res.json(
        success({
          items: items.map((i) => ({ ...i, amount: Number(i.amount) })),
          total: Number(counts[0]?.total ?? 0),
          page,
          pageSize,
        }),
      );
    }),
  );
  router.get(
    "/membership-applications/:id/capital-progress",
    ...staff,
    asyncHandler(async (req, res) => {
      const id = parseQuery(z.string().regex(/^\d+$/), req.params.id);
      const cases = await capitalCases(db(), "c.membership_application_id=?", [
        id,
      ]);
      const [referral] = await db().execute<RowDataPacket[]>(
        "SELECT m.member_code AS memberCode,m.full_name AS referrerName,r.referral_status AS status FROM member_referrals r JOIN member_profiles m ON m.member_id=r.referrer_member_id WHERE r.membership_application_id=?",
        [id],
      );
      res.json(
        success({
          capital: cases[0] ? await caseProgress(db(), cases[0]) : null,
          legacyReviewRequired: !cases[0],
          referral: referral[0] ?? null,
        }),
      );
    }),
  );
  router.get(
    "/chairman/membership-capital/monthly",
    createAuthenticate(authService),
    requireRoles("chairman"),
    asyncHandler(async (req, res) => {
      const today = manilaDate();
      const input = parseQuery(
        z.object({
          start: z.iso.date().default(today.slice(0, 4) + "-01-01"),
          end: z.iso.date().default(today),
          membershipType: z.enum(["", "Associate", "True Member"]).default(""),
          sectors: z.string().max(600).optional(),
          barangays: z.string().max(4000).optional(),
        }),
        req.query,
      );
      if (
        input.start > input.end || input.end > today ||
        Date.parse(input.end) - Date.parse(input.start) > 732 * 86400000
      )
        throw new AppError(
          "Select a reporting period of up to two years",
          400,
          "CAPITAL_PERIOD_INVALID",
        );
      res.json(
        success({
          months: await monthlyCapitalProgress(db(), input.start, input.end, {
            membershipType: input.membershipType,
            sectors: input.sectors?.split(",").filter(Boolean),
            barangays: input.barangays?.split(",").filter(Boolean),
          }),
          scope:
            "New-policy applications and upgrade requests; legacy obligations require review.",
        }),
      );
    }),
  );
  return router;
}
