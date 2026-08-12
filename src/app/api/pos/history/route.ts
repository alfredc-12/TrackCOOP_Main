import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { RowDataPacket } from "mysql2";
import { getMemberProfileIdForUser, requireApiUser } from "@/lib/next-api-auth";

type PosHistoryRow = RowDataPacket & {
  id: number;
};

type PosSaleItemRow = RowDataPacket & {
  pos_sale_id: number;
  name: string;
  quantity: number;
  price: number;
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
             s.member_id,
             s.subtotal_amount,
             s.discount_amount,
             s.total_amount,
             s.customer_name,
             s.customer_contact,
             s.payment_reference_id,
             s.notes,
             pr.reference_number,
             pr.provider
         FROM pos_sales s
         LEFT JOIN payment_references pr ON s.payment_reference_id = pr.payment_reference_id
         WHERE s.member_id = ?
         ORDER BY s.sale_date DESC`
        ,
        [memberId],
      );

      let formattedHistory = rows.map(row => ({
          ...row,
          customer_email: auth.user.email,
          items: [] as any[]
      }));

      if (rows.length > 0) {
          const saleIds = rows.map(r => r.id);
          const [itemRows] = await connection.query<PosSaleItemRow[]>(
              `SELECT pos_sale_id, product_name_snapshot as name, quantity, unit_price as price
               FROM pos_sale_items
               WHERE pos_sale_id IN (?)`,
              [saleIds]
          );

          const itemsBySaleId = itemRows.reduce((acc, item) => {
              if (!acc[item.pos_sale_id]) acc[item.pos_sale_id] = [];
              acc[item.pos_sale_id].push({ name: item.name, quantity: item.quantity, price: item.price });
              return acc;
          }, {} as Record<number, any[]>);

          formattedHistory = formattedHistory.map(order => ({
              ...order,
              items: itemsBySaleId[order.id] || []
          }));
      }

      return NextResponse.json(formattedHistory);
    } finally {
      connection.release();
    }
  } catch (error: unknown) {
    console.error("Failed to fetch POS history:", error);
    return NextResponse.json({ error: "Failed to fetch history" }, { status: 500 });
  }
}
