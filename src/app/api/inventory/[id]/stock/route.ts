import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { RowDataPacket } from "mysql2";
import { requireApiUser } from "@/lib/next-api-auth";

type InventoryBalanceRow = RowDataPacket & {
  stock: number | string | null;
};

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireApiUser(["chairman", "bookkeeper"]);
    if (auth.response) return auth.response;

    const productId = (await params).id;
    const body = await req.json();
    const { amount, type } = body;
    
    // Validate inputs
    if (!amount || isNaN(Number(amount))) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }

    const qty = Number(amount);
    
    // Determine movement type and sign
    let movementType = 'Adjustment';
    let quantityChange = 0;

    if (type === 'add') {
      movementType = 'Stock In';
      quantityChange = Math.abs(qty);
    } else if (type === 'deduct') {
      movementType = 'Sale'; // Or 'Adjustment' based on use-case, but deduct usually means a sale or similar
      quantityChange = -Math.abs(qty);
    } else {
      return NextResponse.json({ error: "Invalid operation type" }, { status: 400 });
    }

    const connection = await db.getConnection();
    await connection.beginTransaction();

    try {
      const [balances] = await connection.query<InventoryBalanceRow[]>(
        `SELECT COALESCE(SUM(quantity_change), 0) AS stock
           FROM inventory_movements
          WHERE product_id = ?`,
        [productId],
      );

      const currentStock = Number(balances[0]?.stock ?? 0);
      if (quantityChange < 0 && currentStock < Math.abs(quantityChange)) {
        await connection.rollback();
        return NextResponse.json({ error: "Stock deduction exceeds available quantity." }, { status: 409 });
      }

      await connection.query(
        `INSERT INTO inventory_movements (product_id, movement_type, quantity_change, recorded_by) 
         VALUES (?, ?, ?, ?)`,
        [productId, movementType, quantityChange, auth.user.numericId]
      );

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update stock:", error);
    return NextResponse.json({ error: "Failed to update stock" }, { status: 500 });
  }
}
