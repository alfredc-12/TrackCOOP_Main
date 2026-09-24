import bcrypt from "bcryptjs";
import type { Pool, RowDataPacket } from "mysql2/promise";
import { getPool } from "../../db/pool";
import { AppError } from "../../utils/app-error";
import type { AuthContext } from "../auth/auth.types";
import type {
  MemberActivityQuery,
  MemberPasswordInput,
  MemberProfileInput,
  MemberSupportInput,
} from "./member-self.types";

type MemberProfileRow = RowDataPacket & {
  member_id: number | string;
  member_code?: string | null;
  share_capital_deadline?: Date | string | null;
  contact_number?: string | null;
  email?: string | null;
  barangay?: string | null;
  municipality?: string | null;
  province?: string | null;
};

type CountRow = RowDataPacket & { count?: number | string; total?: number | string };
type PasswordRow = RowDataPacket & { password_hash: string };
type SqlValue = string | number | boolean | Date | null;

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

export interface MemberSelfRepository {
  dashboard(auth: AuthContext): Promise<Record<string, unknown>>;
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
    async dashboard(auth) {
      const [members] = await databasePool().execute<MemberProfileRow[]>(
        `SELECT member_id, member_code, share_capital_deadline, contact_number, email, barangay, municipality, province
           FROM member_profiles
          WHERE user_id = ?`,
        [auth.user.id],
      );

      const member = members[0];
      if (!member) {
        return { isLinked: false };
      }

      const [shareCapitalRows] = await databasePool().execute<RowDataPacket[]>(
        `SELECT COALESCE(SUM(amount), 0) AS validatedTotal
           FROM share_capital_payments
          WHERE member_id = ? AND payment_status = 'Validated'`,
        [member.member_id],
      );
      const validatedShareCapital = Number(shareCapitalRows[0]?.validatedTotal || 0);

      const [sales] = await databasePool().execute<RowDataPacket[]>(
        `SELECT pos_sale_id as id,
                sale_date as date,
                total_amount as amount,
                sale_status as status,
                'Coop Store Purchase' as type
           FROM pos_sales
          WHERE member_id = ?
          ORDER BY sale_date DESC
          LIMIT 5`,
        [member.member_id],
      );

      const [deposits] = await databasePool().execute<RowDataPacket[]>(
        `SELECT share_payment_id as id,
                payment_date as date,
                amount,
                payment_status as status,
                'Share Capital Deposit' as type
           FROM share_capital_payments
          WHERE member_id = ?
          ORDER BY payment_date DESC
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

      const recentActivity = [...sales, ...deposits, ...pendingDeposits]
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
        "SELECT COUNT(*) as count FROM share_capital_payments WHERE member_id = ?",
        [member.member_id],
      );
      const [rentalCount] = await databasePool().execute<CountRow[]>(
        "SELECT COUNT(*) as count FROM rental_bookings WHERE member_id = ?",
        [member.member_id],
      );

      return {
        isLinked: true,
        shareCapital: {
          total: validatedShareCapital,
          deadline: member.share_capital_deadline,
        },
        recentActivity,
        stats: {
          announcements: allAnnouncements[0]?.count || 0,
          purchases: purchaseCount[0]?.count || 0,
          deposits: depositCount[0]?.count || 0,
          rentals: rentalCount[0]?.count || 0,
        },
        member: {
          code: member.member_code,
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
      let whereClause = "";
      const queryParams: SqlValue[] = [member.member_id, member.member_id];

      if (search) {
        whereClause = "WHERE (type LIKE ? OR status LIKE ?)";
        const searchPattern = `%${search}%`;
        queryParams.push(searchPattern, searchPattern);
      }

      const [countResult] = await databasePool().execute<CountRow[]>(
        `SELECT COUNT(*) as total FROM (
          SELECT sale_status as status, 'Coop Store Purchase' as type
          FROM pos_sales WHERE member_id = ?
          UNION ALL
          SELECT payment_status as status, 'Share Capital Deposit' as type
          FROM share_capital_payments WHERE member_id = ?
        ) as combined
        ${whereClause}`,
        queryParams,
      );
      const total = Number(countResult[0]?.total || 0);

      const [records] = await databasePool().execute<RowDataPacket[]>(
        `SELECT * FROM (
          SELECT pos_sale_id as id, sale_date as date, total_amount as amount, sale_status as status, 'Coop Store Purchase' as type
          FROM pos_sales WHERE member_id = ?
          UNION ALL
          SELECT share_payment_id as id, payment_date as date, amount, payment_status as status, 'Share Capital Deposit' as type
          FROM share_capital_payments WHERE member_id = ?
        ) as combined
        ${whereClause}
        ORDER BY date DESC
        LIMIT ? OFFSET ?`,
        [...queryParams, pageSize, offset],
      );

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
