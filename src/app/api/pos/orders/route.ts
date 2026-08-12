import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { RowDataPacket } from "mysql2";
import { requireApiUser } from "@/lib/next-api-auth";

type PosOrderRow = RowDataPacket & {
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
    const auth = await requireApiUser(["chairman", "bookkeeper"]);
    if (auth.response) return auth.response;

    const connection = await db.getConnection();
    try {
      const [rows] = await connection.query<PosOrderRow[]>(
        `SELECT 
             s.pos_sale_id as id, 
             s.sale_number, 
             s.sale_date, 
             s.sale_status, 
             s.payment_status,
             s.member_id,
             s.subtotal_amount,
             s.discount_amount,
             s.total_amount,
             s.customer_name,
             s.customer_contact,
             s.payment_reference_id,
             COALESCE(u.email, pr.payer_email) as customer_email,
             pr.reference_number,
             pr.provider
         FROM pos_sales s
         LEFT JOIN payment_references pr ON s.payment_reference_id = pr.payment_reference_id
         LEFT JOIN member_profiles mp ON s.member_id = mp.member_id
         LEFT JOIN users u ON mp.user_id = u.user_id
         ORDER BY s.sale_date DESC`
      );

      let formattedOrders = rows.map(row => ({
          ...row,
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

          formattedOrders = formattedOrders.map(order => ({
              ...order,
              items: itemsBySaleId[order.id] || []
          }));
      }

      return NextResponse.json(formattedOrders);
    } finally {
      connection.release();
    }
  } catch (error: unknown) {
    console.error("Failed to fetch orders:", error);
    return NextResponse.json({ error: "Failed to fetch orders" }, { status: 500 });
  }
}
