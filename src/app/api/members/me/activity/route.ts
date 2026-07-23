import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { RowDataPacket } from "mysql2";
import { requireApiUser } from "@/lib/next-api-auth";

export async function GET(req: Request) {
  try {
    const auth = await requireApiUser(["member"]);
    if (auth.response) return auth.response;

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") || "10", 10);
    const search = searchParams.get("search") || "";
    const offset = (page - 1) * pageSize;

    const connection = await db.getConnection();
    try {
      // 1. Get memberId
      const [members] = await connection.query<RowDataPacket[]>(
        `SELECT member_id FROM member_profiles WHERE user_id = ?`,
        [auth.user.id]
      );
      
      const member = members[0];
      if (!member) {
        return NextResponse.json({ error: "Member profile not found" }, { status: 404 });
      }

      const memberId = member.member_id;

      let whereClause = "";
      let queryParams: any[] = [memberId, memberId];

      if (search) {
        whereClause = `WHERE (type LIKE ? OR status LIKE ?)`;
        const searchPattern = `%${search}%`;
        queryParams.push(searchPattern, searchPattern);
      }

      // Count total records
      const [countResult] = await connection.query<RowDataPacket[]>(
        `SELECT COUNT(*) as total FROM (
          SELECT sale_status as status, 'Coop Store Purchase' as type
          FROM pos_sales WHERE member_id = ?
          UNION ALL
          SELECT payment_status as status, 'Share Capital Deposit' as type
          FROM share_capital_payments WHERE member_id = ?
        ) as combined
        ${whereClause}`,
        queryParams
      );
      const total = Number(countResult[0]?.total || 0);

      // Fetch paginated records
      const fetchParams = [...queryParams, pageSize, offset];
      const [records] = await connection.query<RowDataPacket[]>(
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
        fetchParams
      );

      return NextResponse.json({
        records,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize)
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error("Activity API error:", error);
    return NextResponse.json({ error: "Failed to fetch activity data" }, { status: 500 });
  }
}
