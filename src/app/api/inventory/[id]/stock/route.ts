import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
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

    await db.query(
      `INSERT INTO inventory_movements (product_id, movement_type, quantity_change, recorded_by) 
       VALUES (?, ?, ?, 1)`,
      [productId, movementType, quantityChange]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update stock:", error);
    return NextResponse.json({ error: "Failed to update stock" }, { status: 500 });
  }
}
