import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { RowDataPacket } from "mysql2";

export async function GET() {
  try {
    const connection = await db.getConnection();
    try {
      const [rows] = await connection.query<RowDataPacket[]>(
        `SELECT 
             s.pos_sale_id as id, 
             s.sale_number, 
             s.sale_date, 
             s.sale_status, 
             s.payment_status,
             s.total_amount,
             s.customer_name,
             s.customer_email,
             s.customer_contact,
             s.payment_reference_id,
             pr.reference_number,
             pr.provider,
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
         ORDER BY s.sale_date DESC`
      );

      const formattedOrders = rows.map(row => ({
          ...row,
          items: typeof row.items === 'string' ? JSON.parse(row.items) : (row.items || [])
      }));

      return NextResponse.json(formattedOrders);
    } finally {
      connection.release();
    }
  } catch (error: any) {
    console.error("Failed to fetch orders:", error);
    return NextResponse.json({ error: "Failed to fetch orders" }, { status: 500 });
  }
}
