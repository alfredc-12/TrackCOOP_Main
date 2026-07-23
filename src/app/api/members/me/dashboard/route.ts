import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { RowDataPacket } from "mysql2";
import { requireApiUser } from "@/lib/next-api-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const auth = await requireApiUser(["member"]);
    if (auth.response) return auth.response;

    const connection = await db.getConnection();
    try {
      // 1. Get memberId
      const [members] = await connection.query<RowDataPacket[]>(
        `SELECT member_id, member_code, share_capital_deadline, contact_number, email, barangay, municipality, province FROM member_profiles WHERE user_id = ?`,
        [auth.user.id]
      );
      
      const member = members[0];
      if (!member) {
        return NextResponse.json({ error: "Member profile not found" }, { status: 404 });
      }

      // 2. Get Share Capital Progress
      const [shareCapitalRows] = await connection.query<RowDataPacket[]>(
        `SELECT COALESCE(SUM(amount), 0) AS validatedTotal
         FROM share_capital_payments
         WHERE member_id = ? AND payment_status = 'Validated'`,
        [member.member_id]
      );
      
      const validatedShareCapital = Number(shareCapitalRows[0]?.validatedTotal || 0);

      // 3. Get Recent Activity (Store Purchases and Capital Deposits)
      const [sales] = await connection.query<RowDataPacket[]>(
        `SELECT 
           pos_sale_id as id,
           sale_date as date,
           total_amount as amount,
           sale_status as status,
           'Coop Store Purchase' as type
         FROM pos_sales
         WHERE member_id = ?
         ORDER BY sale_date DESC
         LIMIT 5`,
        [member.member_id]
      );

      const [deposits] = await connection.query<RowDataPacket[]>(
        `SELECT 
           share_payment_id as id,
           payment_date as date,
           amount,
           payment_status as status,
           'Share Capital Deposit' as type
         FROM share_capital_payments
         WHERE member_id = ?
         ORDER BY payment_date DESC
         LIMIT 5`,
        [member.member_id]
      );

      // Combine and sort recent activity
      const recentActivity = [...sales, ...deposits].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5);

      // 4. Get stats
      const [allAnnouncements] = await connection.query<RowDataPacket[]>(
        `SELECT COUNT(*) as count FROM announcements WHERE announcement_status = 'Published'`
      );

      const [purchaseCount] = await connection.query<RowDataPacket[]>(
        `SELECT COUNT(*) as count FROM pos_sales WHERE member_id = ?`, [member.member_id]
      );

      const [depositCount] = await connection.query<RowDataPacket[]>(
        `SELECT COUNT(*) as count FROM share_capital_payments WHERE member_id = ?`, [member.member_id]
      );

      const [rentalCount] = await connection.query<RowDataPacket[]>(
        `SELECT COUNT(*) as count FROM rental_bookings WHERE member_id = ?`, [member.member_id]
      );

      return NextResponse.json({
        shareCapital: {
          total: validatedShareCapital,
          deadline: member.share_capital_deadline
        },
        recentActivity,
        stats: {
          announcements: allAnnouncements[0]?.count || 0,
          purchases: purchaseCount[0]?.count || 0,
          deposits: depositCount[0]?.count || 0,
          rentals: rentalCount[0]?.count || 0
        },
        member: {
          code: member.member_code,
          contact_number: member.contact_number,
          email: member.email,
          barangay: member.barangay,
          municipality: member.municipality,
          province: member.province
        }
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error("Dashboard error:", error);
    return NextResponse.json({ error: "Failed to fetch dashboard data" }, { status: 500 });
  }
}
