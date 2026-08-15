import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { RowDataPacket, ResultSetHeader } from "mysql2";
import { getServerAuthUser } from "@/lib/auth-server";
import { getMemberProfileIdForUser } from "@/lib/next-api-auth";
import {
  createPaymongoConfigFromEnv,
  validatePaymongoConfig,
} from "@/../server/src/modules/paymongo/paymongo.client";
import { createPaymongoService } from "@/../server/src/modules/paymongo/paymongo.service";
import { AppError } from "@/../server/src/utils/app-error";

type CheckoutItem = {
  id: number;
  quantity: number;
};

type CheckoutPayload = {
  items?: CheckoutItem[];
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

    const { items, paymentName, paymentEmail, paymentContact } = await req.json() as CheckoutPayload;

    if (!items || items.length === 0) {
      return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
    }

    const customerName = paymentName?.trim();
    const customerEmail = paymentEmail?.trim();
    const customerContact = paymentContact?.trim();

    if (!customerName || !customerEmail || !customerContact) {
      return NextResponse.json({ error: "Customer name, email, and contact number are required." }, { status: 400 });
    }
    const paymongoConfig = createPaymongoConfigFromEnv();
    validatePaymongoConfig(paymongoConfig);
    const paymongoService = createPaymongoService({ config: paymongoConfig });

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

      const discountAmount = memberId ? subtotal * 0.05 : 0;
      const totalAmount = Math.max(0, subtotal - discountAmount);

      const [saleResult] = await connection.query<ResultSetHeader>(
        `INSERT INTO pos_sales 
         (sale_number, member_id, customer_name, customer_contact, sale_type, sale_status, payment_status, payment_reference_id, subtotal_amount, discount_amount, total_amount, recorded_by) 
         VALUES (?, ?, ?, ?, ?, 'Pending Payment', 'Unpaid', ?, ?, ?, ?, ?)`,
        [saleNumber, memberId, customerName, customerContact, saleType, null, subtotal, discountAmount, totalAmount, recordedBy]
      );
      
      const saleId = saleResult.insertId;

      const referenceNumber = `${saleNumber}-PAY`;
      const [refResult] = await connection.query<ResultSetHeader>(
        `INSERT INTO payment_references
           (member_id, submitted_by, payer_name, payer_email, payer_contact,
            provider, payment_channel, reference_number, payment_purpose,
            related_entity_type, related_entity_id, amount, validation_status)
         VALUES (?, ?, ?, ?, ?, 'PayMongo', 'PayMongo', ?, 'POS/Product',
                 'pos_sales', ?, ?, 'Pending')`,
        [
          memberId,
          submittedBy,
          customerName,
          customerEmail,
          customerContact,
          referenceNumber,
          saleId,
          totalAmount,
        ],
      );
      paymentRefId = refResult.insertId;

      await connection.query(
        `UPDATE pos_sales SET payment_reference_id = ? WHERE pos_sale_id = ?`,
        [paymentRefId, saleId],
      );

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

      const checkout = await paymongoService.createPointOfSaleCheckout(String(paymentRefId));

      return NextResponse.json({
        success: true,
        saleId,
        totalAmount,
        discountAmount,
        paymentReferenceId: paymentRefId,
        checkoutUrl: checkout.checkoutUrl,
        checkoutId: checkout.checkoutId,
        gatewayStatus: checkout.gatewayStatus,
        mode: checkout.mode,
      });
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  } catch (error: unknown) {
    console.error("Checkout failed:", error);
    const status = error instanceof AppError ? error.statusCode : 500;
    return NextResponse.json({ error: getErrorMessage(error) }, { status });
  }
}
