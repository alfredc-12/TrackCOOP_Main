import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { RowDataPacket, ResultSetHeader } from "mysql2";

export async function POST(req: Request) {
  try {
    const { items, paymentMethod, paymentReference, paymentName, paymentEmail, paymentContact } = await req.json();

    if (!items || items.length === 0) {
      return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
    }

    // Connect and transaction
    const connection = await db.getConnection();
    await connection.beginTransaction();

    try {
      // 1. Calculate totals
      let subtotal = 0;
      for (const item of items) {
        subtotal += item.price * item.quantity;
      }

      // Generate a unique sale number
      const saleNumber = `SALE-${Date.now()}`;

      let paymentRefId = null;

      // 2. Insert payment reference if Online
      if (paymentMethod === "Online") {
        const [refResult] = await connection.query<ResultSetHeader>(
          `INSERT INTO payment_references 
           (member_id, submitted_by, payer_name, provider, reference_number, email_address, contact_number, payment_purpose, amount, validation_status) 
           VALUES (1, 1, ?, 'GCash', ?, ?, ?, 'POS/Product', ?, 'Pending')`,
          [paymentName, paymentReference, paymentEmail, paymentContact, subtotal]
        );
        paymentRefId = refResult.insertId;
      }

      // 3. Insert into pos_sales
      const [saleResult] = await connection.query<ResultSetHeader>(
        `INSERT INTO pos_sales 
         (sale_number, member_id, customer_name, customer_email, customer_contact, sale_type, sale_status, payment_status, payment_reference_id, subtotal_amount, total_amount, recorded_by) 
         VALUES (?, 1, ?, ?, ?, 'Member Sale', 'Pending Payment', 'Unpaid', ?, ?, ?, 1)`,
        [saleNumber, paymentName, paymentEmail, paymentContact, paymentRefId, subtotal, subtotal]
      );
      
      const saleId = saleResult.insertId;

      // 3. Insert items and deduct stock
      for (const item of items) {
        // Fetch current product to get snapshot info (like name/sku)
        const [products] = await connection.query<RowDataPacket[]>(
          `SELECT product_name, sku FROM products WHERE product_id = ?`,
          [item.id]
        );
        
        if (products.length === 0) {
            throw new Error(`Product ID ${item.id} not found`);
        }
        const product = products[0];

        // Insert into pos_sale_items
        const lineTotal = item.price * item.quantity;
        await connection.query(
          `INSERT INTO pos_sale_items 
           (pos_sale_id, product_id, product_name_snapshot, sku_snapshot, quantity, unit_price, line_total) 
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [saleId, item.id, product.product_name, product.sku, item.quantity, item.price, lineTotal]
        );

      }

      await connection.commit();
      connection.release();

      return NextResponse.json({ success: true, saleId });
    } catch (err) {
      await connection.rollback();
      connection.release();
      throw err;
    }
  } catch (error: any) {
    console.error("Checkout failed:", error);
    return NextResponse.json({ error: error.message || "Checkout failed" }, { status: 500 });
  }
}
