import type { Pool, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { getPool } from "../../db/pool";
import { limitOffsetSql } from "../../db/pagination";
import { withTransaction } from "../../db/transaction";
import { AppError } from "../../utils/app-error";
import type { AuthContext } from "../auth/auth.types";
import type {
  ApprovalStatus,
  BarangayDistribution,
  MemberDetail,
  MemberLatestIndicator,
  MemberListQuery,
  MemberListResult,
  MemberPaymentActivity,
  MemberPosActivity,
  MemberProfile,
  MemberProfileInput,
  MemberRentalActivity,
  MemberStatusHistoryEntry,
  MemberSummary,
  MembershipType,
  OfficialMemberStatus,
  ShareCapitalProgress,
  UpdateMemberProfileInput,
  UpdateMemberStatusInput,
  UnifiedStatusHistoryEntry,
} from "./member.types";

type MemberRow = RowDataPacket & {
  id: string;
  userId: string | null;
  linkedUserEmail: string | null;
  linkedUserUsername: string | null;
  linkedUserStatus: string | null;
  linkedUserRole: string | null;
  memberCode: string;
  fullName: string;
  contactNumber: string | null;
  email: string | null;
  barangay: string | null;
  municipality: string;
  province: string;
  sector: string | null;
  membershipType: MembershipType;
  approvalStatus: ApprovalStatus;
  officialMemberStatus: OfficialMemberStatus;
  applicationDate: Date | null;
  approvedBy: string | null;
  approvedAt: Date | null;
  trueMemberSince: Date | null;
  shareCapitalDeadline: Date | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type HistoryRow = RowDataPacket & {
  id: string;
  memberId: string;
  oldMembershipType: MembershipType | null;
  newMembershipType: MembershipType | null;
  oldOfficialStatus: OfficialMemberStatus | null;
  newOfficialStatus: OfficialMemberStatus | null;
  reason: string | null;
  changedBy: string;
  changedAt: Date;
};

type CountRow = RowDataPacket & { total: number };
type SummaryRow = RowDataPacket & MemberSummary;
type ShareCapitalRow = RowDataPacket & {
  validatedTotal: string | number | null;
  pendingTotal: string | number | null;
  validatedPayments: number | null;
};
type PaymentActivityRow = RowDataPacket & MemberPaymentActivity;
type PosActivityRow = RowDataPacket & MemberPosActivity;
type RentalActivityRow = RowDataPacket & MemberRentalActivity;
type LatestIndicatorRow = RowDataPacket & MemberLatestIndicator;
type UnifiedHistoryRow = RowDataPacket & UnifiedStatusHistoryEntry;

const FULL_SHARE_CAPITAL = 3000;
const MAX_SHARE_CAPITAL = 15000;

const sortColumns: Record<MemberListQuery["sortBy"], string> = {
  fullName: "m.full_name",
  memberCode: "m.member_code",
  createdAt: "m.created_at",
  applicationDate: "m.application_date",
};

export interface MemberRepository {
  list(query: MemberListQuery): Promise<MemberListResult>;
  findById(memberId: string): Promise<MemberDetail | null>;
  create(input: MemberProfileInput, auth: AuthContext): Promise<MemberProfile>;
  update(memberId: string, input: UpdateMemberProfileInput, auth: AuthContext): Promise<MemberProfile>;
  updateApproval(memberId: string, approvalStatus: ApprovalStatus, reason: string | null | undefined, auth: AuthContext): Promise<MemberProfile>;
  updateStatus(memberId: string, input: UpdateMemberStatusInput, auth: AuthContext): Promise<MemberProfile>;
  history(memberId: string): Promise<MemberStatusHistoryEntry[]>;
  unifiedStatusHistory(query: { search?: string; sourceModule?: string; page: number; pageSize: number }): Promise<{ entries: UnifiedStatusHistoryEntry[]; total: number; page: number; pageSize: number }>;
  summary(): Promise<MemberSummary>;
  barangayDistribution(): Promise<BarangayDistribution[]>;
  shareCapitalProgress(memberId: string): Promise<ShareCapitalProgress>;
}

function memberSelect() {
  return `SELECT CAST(m.member_id AS CHAR) AS id,
                 CAST(m.user_id AS CHAR) AS userId,
                 u.email AS linkedUserEmail,
                 u.username AS linkedUserUsername,
                 u.account_status AS linkedUserStatus,
                 r.role_slug AS linkedUserRole,
                 m.member_code AS memberCode,
                 m.full_name AS fullName,
                 m.contact_number AS contactNumber,
                 m.email,
                 m.barangay,
                 m.municipality,
                 m.province,
                 m.sector,
                 m.membership_type AS membershipType,
                 m.approval_status AS approvalStatus,
                 m.official_member_status AS officialMemberStatus,
                 m.application_date AS applicationDate,
                 CAST(m.approved_by AS CHAR) AS approvedBy,
                 m.approved_at AS approvedAt,
                 m.true_member_since AS trueMemberSince,
                 m.share_capital_deadline AS shareCapitalDeadline,
                 m.notes,
                 m.created_at AS createdAt,
                 m.updated_at AS updatedAt
            FROM member_profiles m
            LEFT JOIN users u ON u.user_id = m.user_id
            LEFT JOIN roles r ON r.role_id = u.role_id`;
}

function mapMember(row: MemberRow): MemberProfile {
  return { ...row };
}

function dateOrNull(value: string | null | undefined) {
  return value ?? null;
}

export function createMemberRepository(pool?: Pool): MemberRepository {
  const databasePool = () => pool ?? getPool();

  async function shareCapitalProgress(memberId: string): Promise<ShareCapitalProgress> {
    const [rows] = await databasePool().execute<ShareCapitalRow[]>(
      `SELECT COALESCE(SUM(CASE WHEN payment_status = 'Validated' THEN amount ELSE 0 END), 0) AS validatedTotal,
              COALESCE(SUM(CASE WHEN payment_status = 'Pending' THEN amount ELSE 0 END), 0) AS pendingTotal,
              SUM(payment_status = 'Validated') AS validatedPayments
         FROM share_capital_payments
        WHERE member_id = ?`,
      [memberId],
    );
    const row = rows[0];
    const validatedTotal = Number(row?.validatedTotal ?? 0);
    const pendingTotal = Number(row?.pendingTotal ?? 0);

    return {
      validatedTotal,
      pendingTotal,
      validatedPayments: Number(row?.validatedPayments ?? 0),
      fullRequirement: FULL_SHARE_CAPITAL,
      maximumAllowed: MAX_SHARE_CAPITAL,
      remainingToFull: Math.max(0, FULL_SHARE_CAPITAL - validatedTotal),
      remainingAllowed: Math.max(0, MAX_SHARE_CAPITAL - validatedTotal),
      fullRequirementMet: validatedTotal >= FULL_SHARE_CAPITAL,
    };
  }

  async function recentPayments(memberId: string) {
    const [rows] = await databasePool().execute<PaymentActivityRow[]>(
      `SELECT CAST(payment_reference_id AS CHAR) AS id,
              reference_number AS referenceNumber,
              payment_purpose AS paymentPurpose,
              amount,
              validation_status AS validationStatus,
              submitted_at AS submittedAt
         FROM payment_references
        WHERE member_id = ?
        ORDER BY submitted_at DESC, payment_reference_id DESC
        LIMIT 5`,
      [memberId],
    );
    return rows.map((row) => ({ ...row, amount: Number(row.amount) }));
  }

  async function recentPosActivity(memberId: string) {
    const [rows] = await databasePool().execute<PosActivityRow[]>(
      `SELECT CAST(pos_sale_id AS CHAR) AS id,
              sale_number AS saleNumber,
              sale_status AS saleStatus,
              payment_status AS paymentStatus,
              total_amount AS totalAmount,
              sale_date AS saleDate
         FROM pos_sales
        WHERE member_id = ?
        ORDER BY sale_date DESC, pos_sale_id DESC
        LIMIT 5`,
      [memberId],
    );
    return rows.map((row) => ({ ...row, totalAmount: Number(row.totalAmount) }));
  }

  async function recentRentalActivity(memberId: string) {
    const [rows] = await databasePool().execute<RentalActivityRow[]>(
      `SELECT CAST(rb.rental_booking_id AS CHAR) AS id,
              rb.booking_number AS bookingNumber,
              ra.asset_name AS assetName,
              rb.booking_status AS bookingStatus,
              rb.payment_status AS paymentStatus,
              rb.total_amount AS totalAmount,
              rb.start_datetime AS startDatetime
         FROM rental_bookings rb
         JOIN rental_assets ra ON ra.rental_asset_id = rb.rental_asset_id
        WHERE rb.member_id = ?
        ORDER BY rb.start_datetime DESC, rb.rental_booking_id DESC
        LIMIT 5`,
      [memberId],
    );
    return rows.map((row) => ({ ...row, totalAmount: Number(row.totalAmount) }));
  }

  async function latestIndicator(memberId: string) {
    const [rows] = await databasePool().execute<LatestIndicatorRow[]>(
      `SELECT CAST(indicator_id AS CHAR) AS id,
              status_label AS statusLabel,
              total_score AS totalScore,
              computed_at AS computedAt,
              basis_summary AS basisSummary
         FROM member_status_indicators
        WHERE member_id = ?
        ORDER BY computed_at DESC, indicator_id DESC
        LIMIT 1`,
      [memberId],
    );
    const row = rows[0];
    return row ? { ...row, totalScore: Number(row.totalScore) } : null;
  }

  return {
    async list(query) {
      const where: string[] = [];
      const values: Array<string | number> = [];

      if (query.search) {
        where.push("(m.full_name LIKE ? OR m.member_code LIKE ? OR m.email LIKE ?)");
        const search = `%${query.search}%`;
        values.push(search, search, search);
      }
      if (query.approvalStatus) {
        where.push("m.approval_status = ?");
        values.push(query.approvalStatus);
      }
      if (query.officialMemberStatus) {
        where.push("m.official_member_status = ?");
        values.push(query.officialMemberStatus);
      }
      if (query.membershipType) {
        where.push("m.membership_type = ?");
        values.push(query.membershipType);
      }
      if (query.barangay) {
        where.push("m.barangay = ?");
        values.push(query.barangay);
      }

      const whereSql = where.length ? ` WHERE ${where.join(" AND ")}` : "";
      const orderDirection = query.sortDirection === "asc" ? "ASC" : "DESC";
      const offset = (query.page - 1) * query.pageSize;

      const [rows] = await databasePool().execute<MemberRow[]>(
        `${memberSelect()}
         ${whereSql}
         ORDER BY ${sortColumns[query.sortBy]} ${orderDirection}, m.member_id DESC
         ${limitOffsetSql(query.pageSize, offset)}`,
        values,
      );
      const [countRows] = await databasePool().execute<CountRow[]>(
        `SELECT COUNT(*) AS total FROM member_profiles m${whereSql}`,
        values,
      );

      return {
        members: rows.map(mapMember),
        total: countRows[0]?.total ?? 0,
        page: query.page,
        pageSize: query.pageSize,
      };
    },

    async findById(memberId) {
      const [rows] = await databasePool().execute<MemberRow[]>(
        `${memberSelect()} WHERE m.member_id = ? LIMIT 1`,
        [memberId],
      );

      const row = rows[0];
      if (!row) return null;

      const [
        capital,
        payments,
        posActivity,
        rentalActivity,
        indicator,
        statusHistory,
      ] = await Promise.all([
        shareCapitalProgress(memberId),
        recentPayments(memberId),
        recentPosActivity(memberId),
        recentRentalActivity(memberId),
        latestIndicator(memberId),
        this.history(memberId),
      ]);

      return {
        ...mapMember(row),
        shareCapital: capital,
        recentPayments: payments,
        recentPosActivity: posActivity,
        recentRentalActivity: rentalActivity,
        latestIndicator: indicator,
        statusHistory,
      };
    },

    async create(input, auth) {
      return withTransaction(async (connection) => {
        const [result] = await connection.execute<ResultSetHeader>(
          `INSERT INTO member_profiles
             (user_id, member_code, full_name, contact_number, email, barangay, municipality, province, sector,
              membership_type, approval_status, official_member_status, application_date, true_member_since,
              share_capital_deadline, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            input.userId ?? null,
            input.memberCode,
            input.fullName,
            input.contactNumber ?? null,
            input.email ?? null,
            input.barangay ?? null,
            input.municipality ?? "Nasugbu",
            input.province ?? "Batangas",
            input.sector ?? null,
            input.membershipType ?? "Associate",
            input.approvalStatus ?? "Pending",
            input.officialMemberStatus ?? "Pending",
            dateOrNull(input.applicationDate),
            dateOrNull(input.trueMemberSince),
            dateOrNull(input.shareCapitalDeadline),
            input.notes ?? null,
          ],
        );
        const memberId = String(result.insertId);

        await connection.execute(
          `INSERT INTO audit_logs
             (user_id, action, entity_table, record_id, description, new_values)
           VALUES (?, 'member.created', 'member_profiles', ?, 'A member profile was created.', JSON_OBJECT('memberCode', ?, 'fullName', ?))`,
          [auth.user.id, memberId, input.memberCode, input.fullName],
        );

        const [rows] = await connection.execute<MemberRow[]>(
          `${memberSelect()} WHERE m.member_id = ? LIMIT 1`,
          [memberId],
        );
        return mapMember(rows[0]);
      }, databasePool());
    },

    async update(memberId, input, auth) {
      return withTransaction(async (connection) => {
        const existing = await this.findById(memberId);
        if (!existing) throw new AppError("Member was not found", 404, "MEMBER_NOT_FOUND");

        await connection.execute(
          `UPDATE member_profiles
              SET user_id = ?,
                  member_code = COALESCE(?, member_code),
                  full_name = COALESCE(?, full_name),
                  contact_number = ?,
                  email = ?,
                  barangay = ?,
                  municipality = COALESCE(?, municipality),
                  province = COALESCE(?, province),
                  sector = ?,
                  application_date = ?,
                  true_member_since = ?,
                  share_capital_deadline = ?,
                  notes = ?
            WHERE member_id = ?`,
          [
            Object.prototype.hasOwnProperty.call(input, "userId")
              ? input.userId ?? null
              : existing.userId,
            input.memberCode ?? null,
            input.fullName ?? null,
            Object.prototype.hasOwnProperty.call(input, "contactNumber")
              ? input.contactNumber ?? null
              : existing.contactNumber,
            Object.prototype.hasOwnProperty.call(input, "email")
              ? input.email ?? null
              : existing.email,
            Object.prototype.hasOwnProperty.call(input, "barangay")
              ? input.barangay ?? null
              : existing.barangay,
            input.municipality ?? null,
            input.province ?? null,
            Object.prototype.hasOwnProperty.call(input, "sector")
              ? input.sector ?? null
              : existing.sector,
            Object.prototype.hasOwnProperty.call(input, "applicationDate")
              ? dateOrNull(input.applicationDate)
              : existing.applicationDate,
            Object.prototype.hasOwnProperty.call(input, "trueMemberSince")
              ? dateOrNull(input.trueMemberSince)
              : existing.trueMemberSince,
            Object.prototype.hasOwnProperty.call(input, "shareCapitalDeadline")
              ? dateOrNull(input.shareCapitalDeadline)
              : existing.shareCapitalDeadline,
            Object.prototype.hasOwnProperty.call(input, "notes")
              ? input.notes ?? null
              : existing.notes,
            memberId,
          ],
        );
        await connection.execute(
          `INSERT INTO audit_logs
             (user_id, action, entity_table, record_id, description, new_values)
           VALUES (?, 'member.updated', 'member_profiles', ?, 'A member profile was updated.', ?)`,
          [auth.user.id, memberId, JSON.stringify(input)],
        );

        const updated = await this.findById(memberId);
        if (!updated) throw new AppError("Member was not found", 404, "MEMBER_NOT_FOUND");
        return updated;
      }, databasePool());
    },

    async updateApproval(memberId, approvalStatus, reason, auth) {
      return withTransaction(async (connection) => {
        const existing = await this.findById(memberId);
        if (!existing) throw new AppError("Member was not found", 404, "MEMBER_NOT_FOUND");

        await connection.execute(
          `UPDATE member_profiles
              SET approval_status = ?,
                  approved_by = CASE WHEN ? = 'Approved' THEN ? ELSE approved_by END,
                  approved_at = CASE WHEN ? = 'Approved' THEN UTC_TIMESTAMP() ELSE approved_at END
            WHERE member_id = ?`,
          [approvalStatus, approvalStatus, auth.user.id, approvalStatus, memberId],
        );
        await connection.execute(
          `INSERT INTO audit_logs
             (user_id, action, entity_table, record_id, description, old_values, new_values)
           VALUES (?, 'member.approval_changed', 'member_profiles', ?, ?, JSON_OBJECT('approvalStatus', ?), JSON_OBJECT('approvalStatus', ?))`,
          [
            auth.user.id,
            memberId,
            reason ?? "A member approval status was changed.",
            existing.approvalStatus,
            approvalStatus,
          ],
        );

        const updated = await this.findById(memberId);
        if (!updated) throw new AppError("Member was not found", 404, "MEMBER_NOT_FOUND");
        return updated;
      }, databasePool());
    },

    async updateStatus(memberId, input, auth) {
      return withTransaction(async (connection) => {
        const existing = await this.findById(memberId);
        if (!existing) throw new AppError("Member was not found", 404, "MEMBER_NOT_FOUND");

        const nextMembershipType = input.membershipType ?? existing.membershipType;
        const nextOfficialStatus =
          input.officialMemberStatus ?? existing.officialMemberStatus;

        if (existing.membershipType !== "True Member" && nextMembershipType === "True Member") {
          const capital = existing.shareCapital;
          if (capital.validatedTotal > capital.maximumAllowed) {
            throw new AppError(
              "Validated share capital is above the PHP 15,000 maximum allowed",
              409,
              "SHARE_CAPITAL_LIMIT_EXCEEDED",
            );
          }
          if (!capital.fullRequirementMet) {
            throw new AppError(
              "True Member promotion requires at least PHP 3,000 validated share capital",
              409,
              "TRUE_MEMBER_CAPITAL_REQUIREMENT_NOT_MET",
            );
          }
        }

        await connection.execute(
          `UPDATE member_profiles
              SET membership_type = ?,
                  official_member_status = ?,
                  true_member_since = CASE
                    WHEN ? = 'True Member' AND true_member_since IS NULL THEN CURRENT_DATE()
                    ELSE true_member_since
                  END
            WHERE member_id = ?`,
          [nextMembershipType, nextOfficialStatus, nextMembershipType, memberId],
        );
        await connection.execute(
          `INSERT INTO member_status_history
             (member_id, old_membership_type, new_membership_type, old_official_status, new_official_status, reason, changed_by)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            memberId,
            existing.membershipType,
            nextMembershipType,
            existing.officialMemberStatus,
            nextOfficialStatus,
            input.reason,
            auth.user.id,
          ],
        );
        await connection.execute(
          `INSERT INTO audit_logs
             (user_id, action, entity_table, record_id, description, old_values, new_values)
           VALUES (?, 'member.status_changed', 'member_profiles', ?, ?, JSON_OBJECT('membershipType', ?, 'officialStatus', ?), JSON_OBJECT('membershipType', ?, 'officialStatus', ?))`,
          [
            auth.user.id,
            memberId,
            input.reason,
            existing.membershipType,
            existing.officialMemberStatus,
            nextMembershipType,
            nextOfficialStatus,
          ],
        );

        const updated = await this.findById(memberId);
        if (!updated) throw new AppError("Member was not found", 404, "MEMBER_NOT_FOUND");
        return updated;
      }, databasePool());
    },

    async history(memberId) {
      const [rows] = await databasePool().execute<HistoryRow[]>(
        `SELECT CAST(member_status_history_id AS CHAR) AS id,
                CAST(member_id AS CHAR) AS memberId,
                old_membership_type AS oldMembershipType,
                new_membership_type AS newMembershipType,
                old_official_status AS oldOfficialStatus,
                new_official_status AS newOfficialStatus,
                reason,
                CAST(changed_by AS CHAR) AS changedBy,
                changed_at AS changedAt
           FROM member_status_history
          WHERE member_id = ?
          ORDER BY changed_at DESC, member_status_history_id DESC`,
        [memberId],
      );
      return rows;
    },

    async unifiedStatusHistory(query) {
      const searchValues: string[] = [];
      let outerWhere = "";

      if (query.search) {
        outerWhere = `WHERE subjectName LIKE ? OR subjectCode LIKE ? OR newStatus LIKE ? OR oldStatus LIKE ?`;
        const search = `%${query.search}%`;
        searchValues.push(search, search, search, search);
      }

      if (query.sourceModule && query.sourceModule !== "All") {
        outerWhere = outerWhere
          ? `${outerWhere} AND sourceModule = ?`
          : "WHERE sourceModule = ?";
        searchValues.push(query.sourceModule);
      }

      const unionSql = `
        SELECT CONCAT('application-', h.membership_application_status_history_id) AS id,
               'Application' AS sourceModule,
               CAST(a.membership_application_id AS CHAR) AS subjectId,
               a.application_code AS subjectCode,
               TRIM(CONCAT_WS(' ', a.first_name, NULLIF(a.middle_name, ''), a.last_name, NULLIF(a.suffix, ''))) AS subjectName,
               h.old_status AS oldStatus,
               h.new_status AS newStatus,
               COALESCE(h.internal_note, h.applicant_message) AS reason,
               actor.display_name AS actor,
               h.changed_at AS changedAt
          FROM membership_application_status_history h
          JOIN membership_applications a ON a.membership_application_id = h.membership_application_id
          LEFT JOIN users actor ON actor.user_id = h.changed_by
        UNION ALL
        SELECT CONCAT('member-', h.member_status_history_id) AS id,
               'Member' AS sourceModule,
               CAST(m.member_id AS CHAR) AS subjectId,
               m.member_code AS subjectCode,
               m.full_name AS subjectName,
               CONCAT_WS(' / ', h.old_membership_type, h.old_official_status) AS oldStatus,
               CONCAT_WS(' / ', h.new_membership_type, h.new_official_status) AS newStatus,
               h.reason,
               actor.display_name AS actor,
               h.changed_at AS changedAt
          FROM member_status_history h
          JOIN member_profiles m ON m.member_id = h.member_id
          LEFT JOIN users actor ON actor.user_id = h.changed_by
        UNION ALL
        SELECT CONCAT('account-', a.audit_log_id) AS id,
               'Account' AS sourceModule,
               CAST(m.member_id AS CHAR) AS subjectId,
               m.member_code AS subjectCode,
               m.full_name AS subjectName,
               COALESCE(
                 JSON_UNQUOTE(JSON_EXTRACT(a.old_values, '$.accountStatus')),
                 JSON_UNQUOTE(JSON_EXTRACT(a.old_values, '$.role'))
               ) AS oldStatus,
               COALESCE(
                 JSON_UNQUOTE(JSON_EXTRACT(a.new_values, '$.accountStatus')),
                 JSON_UNQUOTE(JSON_EXTRACT(a.new_values, '$.role'))
               ) AS newStatus,
               a.description AS reason,
               actor.display_name AS actor,
               a.action_time AS changedAt
          FROM audit_logs a
          JOIN member_profiles m ON m.user_id = a.record_id
          LEFT JOIN users actor ON actor.user_id = a.user_id
         WHERE a.entity_table = 'users'
           AND a.action IN ('user.status_changed', 'user.role_changed')`;
      const offset = (query.page - 1) * query.pageSize;
      const [rows] = await databasePool().execute<UnifiedHistoryRow[]>(
        `SELECT *
           FROM (${unionSql}) history
          ${outerWhere}
          ORDER BY changedAt DESC, id DESC
          ${limitOffsetSql(query.pageSize, offset)}`,
        searchValues,
      );
      const [countRows] = await databasePool().execute<CountRow[]>(
        `SELECT COUNT(*) AS total FROM (${unionSql}) history ${outerWhere}`,
        searchValues,
      );

      return {
        entries: rows,
        total: countRows[0]?.total ?? 0,
        page: query.page,
        pageSize: query.pageSize,
      };
    },

    async summary() {
      const [rows] = await databasePool().execute<SummaryRow[]>(
        `SELECT COUNT(*) AS total,
                SUM(approval_status = 'Pending') AS pendingApproval,
                SUM(approval_status = 'Approved') AS approved,
                SUM(membership_type = 'Associate') AS associate,
                SUM(membership_type = 'True Member') AS trueMember,
                SUM(official_member_status = 'Active') AS active,
                SUM(official_member_status = 'Inactive') AS inactive,
                SUM(official_member_status = 'Suspended') AS suspended
           FROM member_profiles`,
      );

      const row = rows[0];
      return {
        total: Number(row?.total ?? 0),
        pendingApproval: Number(row?.pendingApproval ?? 0),
        approved: Number(row?.approved ?? 0),
        associate: Number(row?.associate ?? 0),
        trueMember: Number(row?.trueMember ?? 0),
        active: Number(row?.active ?? 0),
        inactive: Number(row?.inactive ?? 0),
        suspended: Number(row?.suspended ?? 0),
      };
    },

    async barangayDistribution() {
      const [rows] = await databasePool().execute<
        (RowDataPacket & { barangay: string | null; total: number })[]
      >(
        `SELECT COALESCE(NULLIF(barangay, ''), 'Unspecified') AS barangay,
                COUNT(*) AS total
           FROM member_profiles
          GROUP BY COALESCE(NULLIF(barangay, ''), 'Unspecified')
          ORDER BY total DESC, barangay ASC`,
      );

      return rows.map((row) => ({
        barangay: row.barangay ?? "Unspecified",
        total: Number(row.total),
      }));
    },

    shareCapitalProgress,
  };
}
