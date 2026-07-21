import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { RowDataPacket } from "mysql2";
import { requireApiUser } from "@/lib/next-api-auth";

export async function GET() {
  try {
    const auth = await requireApiUser(["chairman", "bookkeeper"]);
    if (auth.response) return auth.response;

    const [rows] = await db.query<RowDataPacket[]>(`
      SELECT 
        m.inventory_movement_id as id,
        m.movement_type as type,
        m.quantity_change as amount,
        m.movement_date as date,
        p.product_id,
        p.product_name,
        p.image_path as img
      FROM inventory_movements m
      JOIN products p ON m.product_id = p.product_id
      ORDER BY m.movement_date DESC
      LIMIT 100
    `);

    // Map to expected format
    const history = rows.map((log) => ({
      id: log.id,
      type: log.amount > 0 ? 'add' : 'deduct',
      amount: Math.abs(Number(log.amount)),
      date: log.date,
      inventoryItem: {
        name: log.product_name,
        img: log.img
      }
    }));

    return NextResponse.json(history);
  } catch (error) {
    console.error("Failed to fetch global history:", error);
    return NextResponse.json({ error: "Failed to fetch global history" }, { status: 500 });
  }
}
