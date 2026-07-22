import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { RowDataPacket } from "mysql2";
import { getMemberProfileIdForUser, requireApiUser } from "@/lib/next-api-auth";

type PosHistoryRow = RowDataPacket & {
  items?: string | unknown[];
};

export async function GET() {
  try {
    const auth = await requireApiUser(["member"]);
    if (auth.response) return auth.response;

    const memberId = await getMemberProfileIdForUser(auth.user.numericId);
    if (!memberId) {
      return NextResponse.json({ error: "Member profile is required." }, { status: 403 });
    }

    const connection = await db.getConnection();
    try {
      const [rows] = await connection.query<PosHistoryRow[]>(
        `SELECT 
             s.pos_sale_id as id, 
             s.sale_number, 
             s.sale_date, 
             s.sale_status, 
             s.total_amount,
             s.customer_name,
             s.customer_contact,
             s.payment_reference_id,
             pr.payer_email as customer_email,
             pr.reference_number,
             (
                 SELECT CONCAT('[', GROUP_CONCAT(
                     JSON_OBJECT(
                         'name', i.product_name_snapshot,
                         'quantity', i.quantity,
                         'price', i.unit_price
                     )
                 ), ']')
                 FROM pos_sale_items i
                 WHERE i.pos_sale_id = s.pos_sale_id
             ) as items
         FROM pos_sales s
         LEFT JOIN payment_references pr ON s.payment_reference_id = pr.payment_reference_id
         WHERE s.member_id = ?
         ORDER BY s.sale_date DESC`
        ,
        [memberId],
      );

      // MySQL might return items as a JSON string or an array depending on the driver config. 
      // We parse it if it's a string.
      const formattedHistory = rows.map(row => ({
          ...row,
          items: typeof row.items === 'string' ? JSON.parse(row.items) : (row.items || [])
      }));

      return NextResponse.json(formattedHistory);
    } finally {
      connection.release();
    }
  } catch (error: unknown) {
    console.error("Failed to fetch POS history:", error);
    return NextResponse.json({ error: "Failed to fetch history" }, { status: 500 });
  }
}
