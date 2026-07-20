import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ResultSetHeader } from "mysql2";
import { processAndSaveImage } from "@/lib/imageUpload";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const productId = (await params).id;
    const body = await req.json();
    const { name, category, price, cost_price, description, status, img } = body;
    
    const dbStatus = status === 'Available' ? 'Active' : 'Out of Stock';
    const imagePath = await processAndSaveImage(img);

    await db.query(
      `UPDATE products 
       SET product_name = ?, category = ?, selling_price = ?, cost_price = ?, description = ?, product_status = ?, image_path = ? 
       WHERE product_id = ?`,
      [name, category, price, cost_price, description, dbStatus, imagePath, productId]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update product:", error);
    return NextResponse.json({ error: "Failed to update product" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const productId = (await params).id;

    // We need to delete associated inventory movements first due to foreign key constraints,
    // or we can soft delete if there are foreign keys. Assuming hard delete for now:
    await db.query(`DELETE FROM inventory_movements WHERE product_id = ?`, [productId]);
    
    const [result] = await db.query<ResultSetHeader>(
      `DELETE FROM products WHERE product_id = ?`,
      [productId]
    );

    if (result.affectedRows === 0) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete product:", error);
    return NextResponse.json({ error: "Failed to delete product" }, { status: 500 });
  }
}
