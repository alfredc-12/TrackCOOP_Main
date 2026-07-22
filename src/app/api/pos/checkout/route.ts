import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { RowDataPacket, ResultSetHeader } from "mysql2";
import { getServerAuthUser } from "@/lib/auth-server";
import { getMemberProfileIdForUser } from "@/lib/next-api-auth";

type CheckoutItem = {
  id: number;
  quantity: number;
};

type CheckoutPayload = {
  items?: CheckoutItem[];
  paymentMethod?: "Cash" | "Online";
  paymentReference?: string;
  paymentName?: string;
  paymentEmail?: string;
  paymentContact?: string;
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Checkout failed";
}

type CheckoutProductRow = RowDataPacket & {
  id: number;
  name: string;
  sku: string;
  price: number | string;
  status: string;
  stock: number | string;
  pending_qty: number | string;
};

type StaffRecorderRow = RowDataPacket & {
  user_id: number | string;
};

export async function POST(req: Request) {
  try {
    const user = await getServerAuthUser();
    let memberId: number | null = null;
    let submittedBy: number | null = null;
    let saleType = "Walk-in";

    if (user) {
      if (user.role !== "member") {
        return NextResponse.json({ error: "Use the POS Sales portal to process staff sales." }, { status: 403 });
      }

      const numericUserId = Number(user.id);
      if (!Number.isInteger(numericUserId) || numericUserId <= 0) {
        return NextResponse.json({ error: "Authenticated user is not linked to a valid account." }, { status: 403 });
      }

      memberId = await getMemberProfileIdForUser(numericUserId);
      if (!memberId) {
        return NextResponse.json({ error: "Member profile is required before checkout." }, { status: 403 });
      }

      submittedBy = numericUserId;
      saleType = "Member Sale";
    }

    const { items, paymentMethod, paymentReference, paymentName, paymentEmail, paymentContact } = await req.json() as CheckoutPayload;
    const normalizedPaymentMethod = paymentMethod ?? "Cash";

    if (!items || items.length === 0) {
      return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
    }

    if (normalizedPaymentMethod === "Online" && !paymentReference?.trim()) {
      return NextResponse.json({ error: "Online payment reference is required." }, { status: 400 });
    }

    const quantities = new Map<number, number>();
    for (const item of items) {
      const productId = Number(item.id);
      const quantity = Number(item.quantity);

      if (!Number.isInteger(productId) || productId <= 0 || !Number.isFinite(quantity) || quantity <= 0) {
        return NextResponse.json({ error: "Cart contains an invalid product or quantity." }, { status: 400 });
      }

      quantities.set(productId, (quantities.get(productId) ?? 0) + quantity);
    }

    const productIds = [...quantities.keys()];

    const connection = await db.getConnection();
    await connection.beginTransaction();

    try {
      let subtotal = 0;

      const [products] = await connection.query<CheckoutProductRow[]>(
        `SELECT
            p.product_id AS id,
            p.product_name AS name,
            p.sku,
            p.selling_price AS price,
            p.product_status AS status,
            COALESCE(v.quantity_on_hand, 0) AS stock,
            (
              SELECT COALESCE(SUM(psi.quantity), 0)
                FROM pos_sale_items psi
                JOIN pos_sales ps ON ps.pos_sale_id = psi.pos_sale_id
               WHERE ps.sale_status = 'Pending Payment'
                 AND psi.product_id = p.product_id
            ) AS pending_qty
          FROM products p
          LEFT JOIN v_product_inventory_balance v ON p.product_id = v.product_id
         WHERE p.product_id IN (?)`,
        [productIds],
      );

      if (products.length !== productIds.length) {
        await connection.rollback();
        return NextResponse.json({ error: "One or more cart products were not found." }, { status: 404 });
      }

      for (const product of products) {
        const quantity = quantities.get(Number(product.id)) ?? 0;
        const available = Number(product.stock) - Number(product.pending_qty ?? 0);

        if (product.status !== "Active" || available < quantity) {
          await connection.rollback();
          return NextResponse.json({ error: `${product.name} does not have enough available stock.` }, { status: 409 });
        }

        subtotal += Number(product.price) * quantity;
      }

      const saleNumber = `SALE-${Date.now()}`;

      let paymentRefId: number | null = null;
      let recordedBy = submittedBy;

      if (!recordedBy) {
        const [staffRecorders] = await connection.query<StaffRecorderRow[]>(
          `SELECT u.user_id
             FROM users u
             JOIN roles r ON r.role_id = u.role_id
            WHERE u.account_status = 'Active'
              AND r.role_slug IN ('chairman', 'bookkeeper')
            ORDER BY CASE r.role_slug WHEN 'chairman' THEN 1 WHEN 'bookkeeper' THEN 2 ELSE 3 END,
                     u.user_id ASC
            LIMIT 1`,
        );

        recordedBy = Number(staffRecorders[0]?.user_id);
        if (!Number.isInteger(recordedBy) || recordedBy <= 0) {
          await connection.rollback();
          return NextResponse.json(
            { error: "Checkout needs an active staff account to record public orders." },
            { status: 500 },
          );
        }
      }

      if (normalizedPaymentMethod === "Online") {
        const [refResult] = await connection.query<ResultSetHeader>(
          `INSERT INTO payment_references 
           (member_id, submitted_by, payer_name, payer_email, payer_contact, provider, reference_number, payment_purpose, amount, validation_status) 
           VALUES (?, ?, ?, ?, ?, 'GCash', ?, 'POS/Product', ?, 'Pending')`,
          [memberId, submittedBy, paymentName, paymentEmail, paymentContact, paymentReference, subtotal]
        );
        paymentRefId = refResult.insertId;
      }

      const [saleResult] = await connection.query<ResultSetHeader>(
        `INSERT INTO pos_sales 
         (sale_number, member_id, customer_name, customer_contact, sale_type, sale_status, payment_status, payment_reference_id, subtotal_amount, total_amount, recorded_by) 
         VALUES (?, ?, ?, ?, ?, 'Pending Payment', 'Unpaid', ?, ?, ?, ?)`,
        [saleNumber, memberId, paymentName, paymentContact, saleType, paymentRefId, subtotal, subtotal, recordedBy]
      );
      
      const saleId = saleResult.insertId;

      if (paymentRefId) {
        await connection.query(
          `UPDATE payment_references
              SET related_entity_type = 'pos_sales',
                  related_entity_id = ?
            WHERE payment_reference_id = ?`,
          [saleId, paymentRefId],
        );
      }

      for (const product of products) {
        const quantity = quantities.get(Number(product.id)) ?? 0;
        const unitPrice = Number(product.price);
        const lineTotal = unitPrice * quantity;
        await connection.query(
          `INSERT INTO pos_sale_items 
           (pos_sale_id, product_id, product_name_snapshot, sku_snapshot, quantity, unit_price, line_total) 
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [saleId, product.id, product.name, product.sku, quantity, unitPrice, lineTotal]
        );

      }

      await connection.commit();

      return NextResponse.json({ success: true, saleId, totalAmount: subtotal });
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  } catch (error: unknown) {
    console.error("Checkout failed:", error);
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
