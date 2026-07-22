import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ResultSetHeader } from "mysql2";
import { listInventoryProducts } from "@/features/pos/inventoryQueries";
import { processAndSaveImage } from "@/lib/imageUpload";
import { requireApiUser } from "@/lib/next-api-auth";

type InventoryProductInput = {
  name?: string;
  category?: string;
  price?: number | string;
  cost_price?: number | string;
  description?: string;
  unit?: string;
  stock?: number | string;
  status?: string;
  img?: string;
};

export async function GET() {
  try {
    const auth = await requireApiUser(["chairman", "bookkeeper", "member"]);
    if (auth.response) return auth.response;

    return NextResponse.json(await listInventoryProducts({ includeHistory: true }));
  } catch (error) {
    console.error("Failed to fetch inventory:", error);
    return NextResponse.json({ error: "Failed to fetch inventory" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireApiUser(["chairman", "bookkeeper"]);
    if (auth.response) return auth.response;

    const body = await req.json() as InventoryProductInput;
    const { name, category, price, cost_price, description, unit, stock, status, img } = body;
    const sellingPrice = Number(price);
    const costPrice = Number(cost_price ?? 0);
    const openingStock = Number(stock ?? 0);
    const productUnit = unit?.trim() || "piece";

    if (!name || !productUnit || !Number.isFinite(sellingPrice) || sellingPrice < 0 || !Number.isFinite(openingStock) || openingStock < 0) {
      return NextResponse.json({ error: "Product name, unit, price, and stock are required." }, { status: 400 });
    }

    // Save image to file system if it's a new upload
    const imagePath = await processAndSaveImage(img ?? "");

    // Default SKU since it's required in the table
    const sku = `SKU-${Date.now()}`;
    const dbStatus = status === 'Available' ? 'Active' : 'Out of Stock';

    const connection = await db.getConnection();
    await connection.beginTransaction();

    try {
      const [productResult] = await connection.query<ResultSetHeader>(
        `INSERT INTO products (sku, product_name, category, unit, selling_price, cost_price, description, product_status, image_path, created_by) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [sku, name, category ?? null, productUnit, sellingPrice, costPrice, description ?? null, dbStatus, imagePath || null, auth.user.numericId]
      );

      const productId = productResult.insertId;

      if (openingStock > 0) {
        await connection.query(
          `INSERT INTO inventory_movements (product_id, movement_type, quantity_change, recorded_by) 
           VALUES (?, 'Opening Stock', ?, ?)`,
          [productId, openingStock, auth.user.numericId]
        );
      }

      await connection.commit();

      return NextResponse.json({ success: true, id: productId }, { status: 201 });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error("Failed to add product:", error);
    return NextResponse.json({ error: "Failed to add product" }, { status: 500 });
  }
}
