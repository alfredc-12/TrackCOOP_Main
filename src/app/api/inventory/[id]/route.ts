import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ResultSetHeader } from "mysql2";
import { processAndSaveImage } from "@/lib/imageUpload";
import { requireApiUser } from "@/lib/next-api-auth";

type InventoryProductUpdateInput = {
  name?: string;
  category?: string;
  price?: number | string;
  cost_price?: number | string;
  description?: string;
  status?: string;
  img?: string;
};

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireApiUser(["chairman", "bookkeeper"]);
    if (auth.response) return auth.response;

    const productId = (await params).id;
    const body = await req.json() as InventoryProductUpdateInput;
    const { name, category, price, cost_price, description, status, img } = body;
    const sellingPrice = Number(price);
    const costPrice = Number(cost_price ?? 0);

    if (!name || !Number.isFinite(sellingPrice) || sellingPrice < 0) {
      return NextResponse.json({ error: "Product name and valid price are required." }, { status: 400 });
    }
    
    const dbStatus = status === 'Available' ? 'Active' : 'Out of Stock';
    const imagePath = await processAndSaveImage(img ?? "");

    await db.query(
      `UPDATE products 
       SET product_name = ?, category = ?, selling_price = ?, cost_price = ?, description = ?, product_status = ?, image_path = ? 
       WHERE product_id = ?`,
      [name, category ?? null, sellingPrice, costPrice, description ?? null, dbStatus, imagePath || null, productId]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update product:", error);
    return NextResponse.json({ error: "Failed to update product" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireApiUser(["chairman", "bookkeeper"]);
    if (auth.response) return auth.response;

    const productId = (await params).id;
    
    const [result] = await db.query<ResultSetHeader>(
      `UPDATE products SET product_status = 'Archived' WHERE product_id = ?`,
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
