import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { RowDataPacket, ResultSetHeader } from "mysql2";
import { processAndSaveImage } from "@/lib/imageUpload";

export async function GET() {
  try {
    const [rows] = await db.query<RowDataPacket[]>(`
      SELECT 
        p.product_id as id,
        p.product_name as name,
        p.category,
        p.selling_price as price,
        p.cost_price,
        p.description,
        COALESCE(v.quantity_on_hand, 0) as stock,
        (
            SELECT COALESCE(SUM(psi.quantity), 0)
            FROM pos_sale_items psi
            JOIN pos_sales ps ON ps.pos_sale_id = psi.pos_sale_id
            WHERE ps.sale_status = 'Pending Payment' AND psi.product_id = p.product_id
        ) as pending_qty,
        0 as sold,
        p.product_status as status,
        p.image_path as img
      FROM products p
      LEFT JOIN v_product_inventory_balance v ON p.product_id = v.product_id
      ORDER BY p.product_name ASC
    `);

    // Fetch movements to build the history array for each product
    const [movements] = await db.query<RowDataPacket[]>(`
      SELECT 
        product_id,
        movement_type as type,
        quantity_change as amount,
        movement_date as date
      FROM inventory_movements
      ORDER BY movement_date DESC
    `);

    // Map database enum to frontend expected statuses and attach history
    const inventory = rows.map((item) => {
      const itemHistory = movements
        .filter((m) => m.product_id === item.id)
        .map((m) => ({
          type: m.amount > 0 ? 'add' : 'deduct',
          amount: Math.abs(Number(m.amount)),
          date: m.date
        }));

      return {
        ...item,
        price: Number(item.price),
        cost_price: Number(item.cost_price || 0),
        stock: Number(item.stock),
        pending_qty: Number(item.pending_qty || 0),
        status: item.status === 'Active' ? 'Available' : (item.status === 'Out of Stock' ? 'Unavailable' : item.status),
        history: itemHistory
      };
    });

    return NextResponse.json(inventory);
  } catch (error) {
    console.error("Failed to fetch inventory:", error);
    return NextResponse.json({ error: "Failed to fetch inventory" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, category, price, cost_price, description, stock, status, img } = body;

    // Save image to file system if it's a new upload
    const imagePath = await processAndSaveImage(img);

    // Default SKU since it's required in the table
    const sku = `SKU-${Date.now()}`;
    const dbStatus = status === 'Available' ? 'Active' : 'Out of Stock';

    // Insert product
    const [productResult] = await db.query<ResultSetHeader>(
      `INSERT INTO products (sku, product_name, category, selling_price, cost_price, description, product_status, image_path, created_by) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [sku, name, category, price, cost_price, description, dbStatus, imagePath]
    );

    const productId = productResult.insertId;

    // Insert initial stock if greater than 0
    if (stock > 0) {
      await db.query(
        `INSERT INTO inventory_movements (product_id, movement_type, quantity_change, recorded_by) 
         VALUES (?, 'Opening Stock', ?, 1)`,
        [productId, stock]
      );
    }

    return NextResponse.json({ success: true, id: productId }, { status: 201 });
  } catch (error) {
    console.error("Failed to add product:", error);
    return NextResponse.json({ error: "Failed to add product" }, { status: 500 });
  }
}
