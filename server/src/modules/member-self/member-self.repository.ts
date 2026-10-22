import bcrypt from "bcryptjs";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import { getPool } from "../../db/pool";
import { AppError } from "../../utils/app-error";
import type { AuthContext } from "../auth/auth.types";
import { getFinancialTransparency } from "../finance/financial-transparency";
import { calculateReferralRewardCredits, loadReferralRewardPolicy } from "../referrals/referral-policy";
import type {
  MemberActivityQuery,
  MemberDashboardQuery,
  MemberPasswordInput,
  MemberProfileInput,
  MemberSupportInput,
} from "./member-self.types";

type MemberProfileRow = RowDataPacket & {
  member_id: number | string;
  member_code?: string | null;
  referral_code?: string | null;
  application_date?: Date | string | null;
  approved_at?: Date | string | null;
  true_member_since?: Date | string | null;
  created_at?: Date | string | null;
  share_capital_deadline?: Date | string | null;
  contact_number?: string | null;
  email?: string | null;
  barangay?: string | null;
  municipality?: string | null;
  province?: string | null;
};

type CountRow = RowDataPacket & { count?: number | string; total?: number | string };
type PasswordRow = RowDataPacket & { password_hash: string };

function mysqlErrorCode(error: unknown) {
  return typeof error === "object" && error && "code" in error
    ? String((error as { code?: unknown }).code)
    : "";
}

function numericUserId(auth: AuthContext) {
  const userId = Number(auth.user.id);
  if (!Number.isInteger(userId) || userId <= 0) {
    throw new AppError("Authenticated user is not linked to a valid account.", 403, "INVALID_AUTH_USER");
  }
  return userId;
}

function pagination(query: MemberActivityQuery) {
  const page = parseInt(String(query.page || "1"), 10);
  const pageSize = parseInt(String(query.pageSize || "10"), 10);
  return { page, pageSize, offset: (page - 1) * pageSize };
}

function generatedReferralCode(memberCode: string | null | undefined, memberId: string | number) {
  const base = memberCode?.trim() || `MEMBER-${memberId}`;
  return `REF-${base}`.slice(0, 40).toUpperCase();
}

async function selectMemberDividendActivities(
  connection: Pool | PoolConnection,
  memberId: string | number,
) {
  const [rows] = await connection.execute<RowDataPacket[]>(
    `SELECT CAST(md.member_dividend_id AS CHAR) AS id,
            COALESCE(md.processed_at, md.decided_at, md.updated_at, md.created_at) AS date,
            md.dividend_amount AS amount,
            md.dividend_status AS status,
            CASE WHEN md.member_decision = 'Withdraw'
                 THEN 'Dividend Withdrawal'
                 ELSE 'Share Capital Addition'
            END AS type
       FROM member_dividends md
      WHERE md.member_id = ?
        AND md.member_decision IN ('Withdraw', 'Add to Share Capital')
        AND md.dividend_status IN ('Withdrawal Requested', 'Capitalization Requested', 'Withdrawn')
      ORDER BY COALESCE(md.processed_at, md.decided_at, md.updated_at, md.created_at) DESC,
               md.member_dividend_id DESC
      LIMIT 5`,
    [memberId],
  );
  return rows;
}

export interface MemberSelfRepository {
  dashboard(auth: AuthContext, query?: MemberDashboardQuery): Promise<Record<string, unknown>>;
  activity(auth: AuthContext, query: MemberActivityQuery): Promise<Record<string, unknown>>;
  profile(auth: AuthContext): Promise<Record<string, unknown>>;
  updateProfile(auth: AuthContext, input: MemberProfileInput): Promise<{ success: true; message: string }>;
  updatePassword(auth: AuthContext, input: MemberPasswordInput): Promise<{ success: true; message: string }>;
  listSupportTickets(auth: AuthContext): Promise<unknown[]>;
  createSupportTicket(auth: AuthContext, input: MemberSupportInput): Promise<{ success: true; message: string }>;
}

export function createMemberSelfRepository(pool?: Pool): MemberSelfRepository {
  const databasePool = () => pool ?? getPool();

  async function getMemberForUser(userId: string | number) {
    const [members] = await databasePool().execute<MemberProfileRow[]>(
      "SELECT member_id FROM member_profiles WHERE user_id = ?",
      [userId],
    );
    return members[0] ?? null;
  }

  async function requireMemberForUser(userId: string | number) {
    const member = await getMemberForUser(userId);
    if (!member) throw new AppError("Member profile not found", 404, "MEMBER_PROFILE_NOT_FOUND");
    return member;
  }

  return {
    async dashboard(auth, query = {}) {
      let members: MemberProfileRow[];
      try {
        [members] = await databasePool().execute<MemberProfileRow[]>(
          `SELECT member_id, member_code, referral_code, application_date, approved_at, true_member_since, created_at,
                  share_capital_deadline, contact_number, email, barangay, municipality, province
             FROM member_profiles
            WHERE user_id = ?`,
          [auth.user.id],
        );
      } catch {
        // Keep the dashboard available while the referral migration is still pending.
        [members] = await databasePool().execute<MemberProfileRow[]>(
          `SELECT member_id, member_code, application_date, approved_at, true_member_since, created_at,
                  share_capital_deadline, contact_number, email, barangay, municipality, province
             FROM member_profiles
            WHERE user_id = ?`,
          [auth.user.id],
        );
      }

      const member = members[0];
      if (!member) {
        return { isLinked: false };
      }

      const referralCode = member.referral_code || generatedReferralCode(member.member_code, member.member_id);
      if (!member.referral_code) {
        await databasePool().execute(
          `UPDATE member_profiles
              SET referral_code = ?
            WHERE member_id = ?
              AND referral_code IS NULL`,
          [referralCode, member.member_id],
        ).catch(() => undefined);
      }

      const [shareCapitalRows] = await databasePool().execute<RowDataPacket[]>(
        `SELECT COALESCE(
                  (SELECT current_balance
                     FROM share_capital_accounts
                    WHERE member_id = ?
                    LIMIT 1),
                  (SELECT SUM(amount)
                     FROM share_capital_payments
                    WHERE member_id = ? AND payment_status = 'Validated'),
                  0
                ) AS validatedTotal`,
        [member.member_id, member.member_id],
      );
      const validatedShareCapital = Number(shareCapitalRows[0]?.validatedTotal || 0);

      const [sales] = await databasePool().execute<RowDataPacket[]>(
        `SELECT pos_sale_id as id,
                sale_date as date,
                total_amount as amount,
                CASE WHEN sale_status = 'Completed' THEN 'Paid' ELSE sale_status END as status,
                'Coop Store Purchase' as type
           FROM pos_sales
          WHERE member_id = ?
          ORDER BY sale_date DESC
          LIMIT 5`,
        [member.member_id],
      );

      const [deposits] = await databasePool().execute<RowDataPacket[]>(
        `SELECT CAST(ledger_tx.share_capital_transaction_id AS CHAR) AS id,
                ledger_tx.transaction_date AS date,
                ledger_tx.amount,
                'Validated' AS status,
                CASE WHEN ledger_tx.transaction_type = 'Dividend Added to Share Capital'
                     THEN 'Dividend Added to Share Capital'
                     ELSE 'Share Capital Deposit'
                END AS type
           FROM share_capital_transactions ledger_tx
          WHERE ledger_tx.member_id = ?
            AND ledger_tx.transaction_status = 'Posted'
          ORDER BY ledger_tx.transaction_date DESC,
                   ledger_tx.share_capital_transaction_id DESC
          LIMIT 5`,
        [member.member_id],
      );
      const [unledgeredDividendAdditions] = await databasePool().execute<RowDataPacket[]>(
        `SELECT CONCAT('DIV-CAP-', dividend.member_dividend_id) AS id,
               COALESCE(dividend.processed_at, dividend.decided_at, dividend.updated_at, dividend.created_at) AS date,
               dividend.dividend_amount AS amount,
               dividend.dividend_status AS status,
               'Dividend Added to Share Capital' AS type
          FROM member_dividends dividend
         WHERE dividend.member_id = ?
           AND dividend.dividend_status = 'Added to Share Capital'
           AND dividend.share_capital_transaction_id IS NULL
          ORDER BY COALESCE(dividend.processed_at, dividend.decided_at, dividend.updated_at, dividend.created_at) DESC,
                   dividend.member_dividend_id DESC
          LIMIT 5`,
        [member.member_id],
      );

      const [pendingDeposits] = await databasePool().execute<RowDataPacket[]>(
        `SELECT payment_reference_id as id,
                submitted_at as date,
                amount,
                validation_status as status,
                'Share Capital Deposit' as type
           FROM payment_references
          WHERE related_entity_id = ?
            AND payment_purpose = 'Share Capital'
            AND validation_status = 'Pending'
          ORDER BY submitted_at DESC
          LIMIT 5`,
        [member.member_id],
      );
      const [rentals] = await databasePool().execute<RowDataPacket[]>(
        `SELECT rental_booking_id as id,
                start_datetime as date,
                total_amount as amount,
                booking_status as status,
                'Rental Booking' as type
           FROM rental_bookings
          WHERE member_id = ?
          ORDER BY start_datetime DESC
          LIMIT 5`,
        [member.member_id],
      );

      const [announcements] = await databasePool().execute<RowDataPacket[]>(
        `SELECT announcement_id as id,
                created_at as date,
                NULL as amount,
                CASE WHEN EXISTS (
                  SELECT 1 FROM announcement_acknowledgments ack
                   WHERE ack.announcement_id = announcements.announcement_id
                     AND ack.user_id = ?
                ) THEN 'Acknowledged' ELSE 'Not Acknowledged' END as status,
                CONCAT('Announcement: ', title) as type
           FROM announcements
          WHERE announcement_status = 'Published'
          ORDER BY created_at DESC
          LIMIT 5`,
        [auth.user.id],
      );
      const financialTransparency = await getFinancialTransparency(databasePool(), query);
      const dividendActivities = await selectMemberDividendActivities(databasePool(), member.member_id);

      const recentActivity = [...sales, ...deposits, ...pendingDeposits, ...dividendActivities, ...rentals, ...announcements]
        .sort((a, b) => new Date(b.date as string).getTime() - new Date(a.date as string).getTime())
        .slice(0, 5);
      const recentCapitalContributions = [...deposits, ...unledgeredDividendAdditions]
        .sort((a, b) => new Date(b.date as string).getTime() - new Date(a.date as string).getTime())
        .slice(0, 5);

      const [allAnnouncements] = await databasePool().execute<CountRow[]>(
        "SELECT COUNT(*) as count FROM announcements WHERE announcement_status = 'Published'",
      );
      const [purchaseCount] = await databasePool().execute<CountRow[]>(
        "SELECT COUNT(*) as count FROM pos_sales WHERE member_id = ?",
        [member.member_id],
      );
      const [depositCount] = await databasePool().execute<CountRow[]>(
        "SELECT COUNT(*) as count FROM share_capital_transactions WHERE member_id = ? AND transaction_status = 'Posted'",
        [member.member_id],
      );
      const [rentalCount] = await databasePool().execute<CountRow[]>(
        "SELECT COUNT(*) as count FROM rental_bookings WHERE member_id = ?",
        [member.member_id],
      );
      const referralRewardPolicy = await loadReferralRewardPolicy(databasePool());
      const [referralCounts] = await databasePool().execute<RowDataPacket[]>(
        `SELECT COUNT(*) AS total,
                SUM(CASE WHEN referral_status = 'Pending' THEN 1 ELSE 0 END) AS pending,
                SUM(CASE WHEN referral_status = 'Successful' THEN 1 ELSE 0 END) AS successful
           FROM member_referrals
          WHERE referrer_member_id = ?`,
        [member.member_id],
      ).catch(() => [[] as RowDataPacket[]]);
      const [referralItems] = await databasePool().execute<RowDataPacket[]>(
        `SELECT CAST(r.member_referral_id AS CHAR) AS id,
                r.referral_status AS status,
                r.created_at AS createdAt,
                r.qualified_at AS qualifiedAt,
                a.application_code AS applicationCode,
                a.application_status AS applicationStatus,
                a.updated_at AS applicationUpdatedAt,
                CONCAT(LEFT(a.first_name, 1), '. ', a.last_name) AS applicantName,
                a.barangay
           FROM member_referrals r
           JOIN membership_applications a
             ON a.membership_application_id = r.membership_application_id
          WHERE r.referrer_member_id = ?
          ORDER BY r.created_at DESC, r.member_referral_id DESC
          LIMIT 10`,
        [member.member_id],
      ).catch(() => [[] as RowDataPacket[]]);

      return {
        isLinked: true,
        shareCapital: {
          total: validatedShareCapital,
          deadline: member.share_capital_deadline,
        },
        recentActivity,
        recentCapitalContributions,
        financialTransparency: {
          ...financialTransparency,
          scope: "Posted cooperative records. Share Capital contributions are shown separately.",
        },
        stats: {
          announcements: allAnnouncements[0]?.count || 0,
          purchases: purchaseCount[0]?.count || 0,
          deposits: depositCount[0]?.count || 0,
          rentals: rentalCount[0]?.count || 0,
        },
        referrals: {
          code: referralCode,
          total: Number(referralCounts[0]?.total || 0),
          pending: Number(referralCounts[0]?.pending || 0),
          successful: Number(referralCounts[0]?.successful || 0),
          rewardCredits: calculateReferralRewardCredits(Number(referralCounts[0]?.successful || 0), referralRewardPolicy),
          rewardLabel: referralRewardPolicy.label,
          rewardPolicyEnabled: referralRewardPolicy.enabled,
          rewardPerSuccessfulReferral: referralRewardPolicy.creditsPerSuccessfulReferral,
          items: referralItems,
        },
        member: {
          code: member.member_code,
          memberSince: member.true_member_since ?? member.approved_at ?? member.application_date ?? member.created_at ?? null,
          contact_number: member.contact_number,
          email: member.email,
          barangay: member.barangay,
          municipality: member.municipality,
          province: member.province,
        },
      };
    },

    async activity(auth, query) {
      const member = await requireMemberForUser(auth.user.id);
      const { page, pageSize, offset } = pagination(query);
      const search = query.search || "";
      const [sales] = await databasePool().execute<RowDataPacket[]>(
        `SELECT pos_sale_id as id, sale_date as date, total_amount as amount,
                CASE WHEN sale_status = 'Completed' THEN 'Paid' ELSE sale_status END as status,
                'Coop Store Purchase' as type
           FROM pos_sales
          WHERE member_id = ?`,
        [member.member_id],
      );
      const [deposits] = await databasePool().execute<RowDataPacket[]>(
        `SELECT CAST(ledger_tx.share_capital_transaction_id AS CHAR) AS id,
                ledger_tx.transaction_date AS date,
                ledger_tx.amount,
                'Validated' AS status,
                CASE WHEN ledger_tx.transaction_type = 'Dividend Added to Share Capital'
                     THEN 'Dividend Added to Share Capital'
                     ELSE 'Share Capital Deposit'
                END AS type
           FROM share_capital_transactions ledger_tx
          WHERE ledger_tx.member_id = ?
            AND ledger_tx.transaction_status = 'Posted'`,
        [member.member_id],
      );
      const [pendingDeposits] = await databasePool().execute<RowDataPacket[]>(
        `SELECT payment_reference_id as id, submitted_at as date, amount,
                validation_status as status, 'Share Capital Deposit' as type
           FROM payment_references
          WHERE related_entity_id = ?
            AND payment_purpose = 'Share Capital'
            AND validation_status = 'Pending'`,
        [member.member_id],
      );
      const [rentals] = await databasePool().execute<RowDataPacket[]>(
        `SELECT rental_booking_id as id, start_datetime as date, total_amount as amount,
                booking_status as status, 'Rental Booking' as type
           FROM rental_bookings
          WHERE member_id = ?`,
        [member.member_id],
      );
      const [announcements] = await databasePool().execute<RowDataPacket[]>(
        `SELECT announcement_id as id, created_at as date, NULL as amount,
                'Published' as status, CONCAT('Announcement: ', title) as type
           FROM announcements
          WHERE announcement_status = 'Published'`,
      );
      const dividendActivities = await selectMemberDividendActivities(databasePool(), member.member_id);
      const searchPattern = search.trim().toLowerCase();
      const allRecords = [...sales, ...deposits, ...pendingDeposits, ...dividendActivities, ...rentals, ...announcements]
        .filter((record) => !searchPattern || `${record.type} ${record.status}`.toLowerCase().includes(searchPattern))
        .sort((a, b) => new Date(b.date as string).getTime() - new Date(a.date as string).getTime());
      const total = allRecords.length;
      const records = allRecords.slice(offset, offset + pageSize);

      return {
        records,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      };
    },

    async profile(auth) {
      const [members] = await databasePool().execute<RowDataPacket[]>(
        "SELECT contact_number, email, barangay, municipality, province FROM member_profiles WHERE user_id = ?",
        [auth.user.id],
      );
      const member = members[0];
      if (!member) throw new AppError("Member profile not found", 404, "MEMBER_PROFILE_NOT_FOUND");
      return member;
    },

    async updateProfile(auth, input) {
      const member = await requireMemberForUser(auth.user.id);
      await databasePool().execute(
        `UPDATE member_profiles
            SET contact_number = ?,
                email = ?,
                barangay = ?,
                municipality = ?,
                province = ?,
                updated_at = NOW()
          WHERE member_id = ?`,
        [
          input.contact_number ?? null,
          input.email ?? null,
          input.barangay ?? null,
          input.municipality ?? null,
          input.province ?? null,
          member.member_id,
        ],
      );

      if (input.email) {
        await databasePool().execute(
          "UPDATE users SET email = ?, updated_at = NOW() WHERE user_id = ?",
          [input.email, auth.user.id],
        );
      }

      return { success: true, message: "Profile updated successfully" };
    },

    async updatePassword(auth, input) {
      if (!input.currentPassword || !input.newPassword) {
        throw new AppError("Missing required fields", 400, "PASSWORD_FIELDS_REQUIRED");
      }

      const [users] = await databasePool().execute<PasswordRow[]>(
        "SELECT password_hash FROM users WHERE user_id = ?",
        [auth.user.id],
      );
      const user = users[0];
      if (!user) throw new AppError("User not found", 404, "USER_NOT_FOUND");

      const isMatch = await bcrypt.compare(input.currentPassword, user.password_hash);
      if (!isMatch) throw new AppError("Incorrect current password", 400, "PASSWORD_INCORRECT");

      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(input.newPassword, salt);
      await databasePool().execute(
        "UPDATE users SET password_hash = ?, updated_at = NOW() WHERE user_id = ?",
        [hashedPassword, numericUserId(auth)],
      );

      return { success: true, message: "Password updated successfully" };
    },

    async listSupportTickets(auth) {
      try {
        const member = await requireMemberForUser(auth.user.id);
        const [tickets] = await databasePool().execute<RowDataPacket[]>(
          `SELECT ticket_id, subject, message, status, created_at
             FROM support_tickets
            WHERE member_id = ?
            ORDER BY created_at DESC`,
          [member.member_id],
        );
        return tickets;
      } catch (error) {
        if (mysqlErrorCode(error) === "ER_NO_SUCH_TABLE") return [];
        throw error;
      }
    },

    async createSupportTicket(auth, input) {
      if (!input.subject || !input.message) {
        throw new AppError("Subject and message are required", 400, "SUPPORT_FIELDS_REQUIRED");
      }

      try {
        const member = await requireMemberForUser(auth.user.id);
        await databasePool().execute(
          `INSERT INTO support_tickets (member_id, subject, message, status, created_at)
           VALUES (?, ?, ?, 'Pending', NOW())`,
          [member.member_id, input.subject, input.message],
        );
        return { success: true, message: "Support ticket submitted successfully" };
      } catch (error) {
        if (mysqlErrorCode(error) === "ER_NO_SUCH_TABLE") {
          throw new AppError(
            "Support module is not fully setup yet. Please contact admin directly.",
            503,
            "SUPPORT_TABLE_MISSING",
          );
        }
        throw error;
      }
    },
  };
}
