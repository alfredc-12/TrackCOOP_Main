import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { getPool } from "../../db/pool";
import { withTransaction } from "../../db/transaction";
import { createGeneratedPdfDocument } from "../../records/generated-pdf-document";
import { AppError } from "../../utils/app-error";
import type { AuthContext } from "../auth/auth.types";
import type { CheckoutPayload, ConfirmOrderInput, PosReasonInput } from "./pos.types";

type PosOrderRow = RowDataPacket & { id: number };
type PosSaleItemDisplayRow = RowDataPacket & {
  pos_sale_id: number;
  name: string;
  quantity: number | string;
  price: number | string;
};
type CheckoutProductRow = RowDataPacket & {
  id: number;
  name: string;
  sku: string;
  price: number | string;
  status: string;
  stock: number | string;
  pending_qty: number | string;
};
type StaffRecorderRow = RowDataPacket & { user_id: number | string };
type PosSaleStatusRow = RowDataPacket & {
  sale_number: string;
  sale_status: string;
  payment_reference_id: number | null;
  member_id: number | null;
  subtotal_amount: number | string;
  total_amount: number | string;
  customer_name: string | null;
  customer_contact: string | null;
  sale_date: string;
};
type PosSaleItemRow = RowDataPacket & {
  pos_sale_item_id: number;
  product_id: number;
  quantity: number | string;
};
type InventoryBalanceRow = RowDataPacket & { stock: number | string | null };
type FinancialCategoryRow = RowDataPacket & { financial_category_id: number };
type PaymentReferenceRow = RowDataPacket & { payment_reference_id: number; provider: string };
type MemberProfileRow = RowDataPacket & { member_id: number | string };

function numericUserId(auth: AuthContext) {
  const userId = Number(auth.user.id);
  if (!Number.isInteger(userId) || userId <= 0) {
    throw new AppError("Authenticated user is not linked to a valid account.", 403, "INVALID_AUTH_USER");
  }
  return userId;
}

function groupItemsBySale(itemRows: PosSaleItemDisplayRow[]) {
  return itemRows.reduce((acc, item) => {
    if (!acc[item.pos_sale_id]) acc[item.pos_sale_id] = [];
    acc[item.pos_sale_id].push({
      name: item.name,
      quantity: item.quantity,
      price: item.price,
    });
    return acc;
  }, {} as Record<number, Array<{ name: string; quantity: number | string; price: number | string }>>);
}

async function attachItems(connection: PoolConnection, rows: PosOrderRow[]) {
  let formatted = rows.map((row) => ({ ...row, items: [] as any[] }));

  if (rows.length > 0) {
    const saleIds = rows.map((row) => row.id);
    const [itemRows] = await connection.query<PosSaleItemDisplayRow[]>(
      `SELECT pos_sale_id, product_name_snapshot as name, quantity, unit_price as price
         FROM pos_sale_items
        WHERE pos_sale_id IN (?)`,
      [saleIds],
    );
    const itemsBySaleId = groupItemsBySale(itemRows);
    formatted = formatted.map((order) => ({ ...order, items: itemsBySaleId[order.id] || [] }));
  }

  return formatted;
}

export interface PosRepository {
  listOrders(): Promise<any[]>;
  listMemberHistory(auth: AuthContext): Promise<any[]>;
  createCheckout(input: CheckoutPayload, auth: AuthContext | null): Promise<{
    saleId: number;
    totalAmount: number;
    discountAmount: number;
    paymentReferenceId: number;
  }>;
  confirmOrder(orderId: string, input: ConfirmOrderInput, auth: AuthContext): Promise<{ receiptDocumentId: number | null }>;
  rejectOrder(orderId: string, input: PosReasonInput, auth: AuthContext): Promise<void>;
  revokeOrder(orderId: string, input: PosReasonInput, auth: AuthContext): Promise<void>;
}

export function createPosRepository(pool?: Pool): PosRepository {
  const databasePool = () => pool ?? getPool();

  async function memberProfileIdForUser(connection: PoolConnection, userId: number) {
    const [members] = await connection.query<MemberProfileRow[]>(
      "SELECT member_id FROM member_profiles WHERE user_id = ? LIMIT 1",
      [userId],
    );
    const memberId = Number(members[0]?.member_id);
    return Number.isInteger(memberId) && memberId > 0 ? memberId : null;
  }

  return {
    async listOrders() {
      const connection = await databasePool().getConnection();
      try {
        const [rows] = await connection.query<PosOrderRow[]>(
          `SELECT
               s.pos_sale_id as id,
               s.sale_number,
               s.sale_date,
               s.sale_status,
               s.payment_status,
               s.member_id,
               s.subtotal_amount,
               s.discount_amount,
               s.total_amount,
               s.customer_name,
               s.customer_contact,
               s.payment_reference_id,
               COALESCE(u.email, pr.payer_email) as customer_email,
               pr.reference_number,
               pr.provider
           FROM pos_sales s
           LEFT JOIN payment_references pr ON s.payment_reference_id = pr.payment_reference_id
           LEFT JOIN member_profiles mp ON s.member_id = mp.member_id
           LEFT JOIN users u ON mp.user_id = u.user_id
           ORDER BY s.sale_date DESC`,
        );

        return attachItems(connection, rows);
      } finally {
        connection.release();
      }
    },

    async listMemberHistory(auth) {
      const connection = await databasePool().getConnection();
      try {
        const memberId = await memberProfileIdForUser(connection, numericUserId(auth));
        if (!memberId) {
          throw new AppError("Member profile is required.", 403, "MEMBER_PROFILE_REQUIRED");
        }

        const [rows] = await connection.query<PosOrderRow[]>(
          `SELECT
               s.pos_sale_id as id,
               s.sale_number,
               s.sale_date,
               s.sale_status,
               s.member_id,
               s.subtotal_amount,
               s.discount_amount,
               s.total_amount,
               s.customer_name,
               s.customer_contact,
               s.payment_reference_id,
               s.notes,
               pr.reference_number,
               pr.provider
           FROM pos_sales s
           LEFT JOIN payment_references pr ON s.payment_reference_id = pr.payment_reference_id
           WHERE s.member_id = ?
           ORDER BY s.sale_date DESC`,
          [memberId],
        );

        const withItems = await attachItems(connection, rows);
        return withItems.map((order) => ({ ...order, customer_email: auth.user.email }));
      } finally {
        connection.release();
      }
    },

    async createCheckout(input, auth) {
      let memberId: number | null = null;
      let submittedBy: number | null = null;
      let saleType = "Walk-in";

      if (auth) {
        if (auth.user.role !== "member") {
          throw new AppError("Use the POS Sales portal to process staff sales.", 403, "POS_STAFF_CHECKOUT_FORBIDDEN");
        }
        submittedBy = numericUserId(auth);
        saleType = "Member Sale";
      }

      if (!input.items || input.items.length === 0) {
        throw new AppError("Cart is empty", 400, "POS_CART_EMPTY");
      }

      const customerName = input.paymentName?.trim();
      const customerEmail = input.paymentEmail?.trim();
      const customerContact = input.paymentContact?.trim();
      if (!customerName || !customerEmail || !customerContact) {
        throw new AppError("Customer name, email, and contact number are required.", 400, "POS_CUSTOMER_REQUIRED");
      }

      const quantities = new Map<number, number>();
      for (const item of input.items) {
        const productId = Number(item.id);
        const quantity = Number(item.quantity);
        if (!Number.isInteger(productId) || productId <= 0 || !Number.isFinite(quantity) || quantity <= 0) {
          throw new AppError("Cart contains an invalid product or quantity.", 400, "POS_CART_INVALID");
        }
        quantities.set(productId, (quantities.get(productId) ?? 0) + quantity);
      }

      const productIds = [...quantities.keys()];

      return withTransaction(async (connection) => {
        if (submittedBy) {
          memberId = await memberProfileIdForUser(connection, submittedBy);
          if (!memberId) {
            throw new AppError("Member profile is required before checkout.", 403, "MEMBER_PROFILE_REQUIRED");
          }
        }

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
          throw new AppError("One or more cart products were not found.", 404, "POS_PRODUCT_NOT_FOUND");
        }

        for (const product of products) {
          const quantity = quantities.get(Number(product.id)) ?? 0;
          const available = Number(product.stock) - Number(product.pending_qty ?? 0);
          if (product.status !== "Active" || available < quantity) {
            throw new AppError(`${product.name} does not have enough available stock.`, 409, "POS_INSUFFICIENT_STOCK");
          }
          subtotal += Number(product.price) * quantity;
        }

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
            throw new AppError("Checkout needs an active staff account to record public orders.", 500, "POS_STAFF_RECORDER_REQUIRED");
          }
        }

        const discountAmount = memberId ? subtotal * 0.05 : 0;
        const totalAmount = Math.max(0, subtotal - discountAmount);
        const saleNumber = `SALE-${Date.now()}`;

        const [saleResult] = await connection.query<ResultSetHeader>(
          `INSERT INTO pos_sales
             (sale_number, member_id, customer_name, customer_contact, sale_type, sale_status, payment_status, payment_reference_id, subtotal_amount, discount_amount, total_amount, recorded_by)
           VALUES (?, ?, ?, ?, ?, 'Pending Payment', 'Unpaid', ?, ?, ?, ?, ?)`,
          [saleNumber, memberId, customerName, customerContact, saleType, null, subtotal, discountAmount, totalAmount, recordedBy],
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
          [memberId, submittedBy, customerName, customerEmail, customerContact, referenceNumber, saleId, totalAmount],
        );
        const paymentReferenceId = refResult.insertId;

        await connection.query("UPDATE pos_sales SET payment_reference_id = ? WHERE pos_sale_id = ?", [
          paymentReferenceId,
          saleId,
        ]);

        for (const product of products) {
          const quantity = quantities.get(Number(product.id)) ?? 0;
          const unitPrice = Number(product.price);
          await connection.query(
            `INSERT INTO pos_sale_items
               (pos_sale_id, product_id, product_name_snapshot, sku_snapshot, quantity, unit_price, line_total)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [saleId, product.id, product.name, product.sku, quantity, unitPrice, unitPrice * quantity],
          );
        }

        return { saleId, totalAmount, discountAmount, paymentReferenceId };
      }, databasePool());
    },

    async confirmOrder(orderId, input, auth) {
      const userId = numericUserId(auth);
      const discountAmount = Number(input.discount_amount || 0);

      return withTransaction(async (connection) => {
        const [sales] = await connection.query<PosSaleStatusRow[]>(
          `SELECT sale_number, sale_status, payment_reference_id, member_id,
                  subtotal_amount, total_amount, customer_name, customer_contact, sale_date
             FROM pos_sales WHERE pos_sale_id = ?`,
          [orderId],
        );

        if (sales.length === 0) throw new AppError("Order not found", 404, "POS_ORDER_NOT_FOUND");
        const sale = sales[0];
        if (sale.sale_status !== "Pending Payment") {
          throw new AppError("Only pending orders can be confirmed.", 400, "POS_ORDER_NOT_PENDING");
        }

        const [items] = await connection.query<PosSaleItemRow[]>(
          "SELECT pos_sale_item_id, product_id, quantity FROM pos_sale_items WHERE pos_sale_id = ?",
          [orderId],
        );

        for (const item of items) {
          const [balances] = await connection.query<InventoryBalanceRow[]>(
            `SELECT COALESCE(SUM(quantity_change), 0) AS stock
               FROM inventory_movements
              WHERE product_id = ?`,
            [item.product_id],
          );
          const currentStock = Number(balances[0]?.stock ?? 0);
          if (currentStock < Number(item.quantity)) {
            throw new AppError("Order quantity exceeds available stock.", 409, "POS_INSUFFICIENT_STOCK");
          }

          await connection.query(
            `INSERT INTO inventory_movements
               (product_id, movement_type, quantity_change, pos_sale_id, pos_sale_item_id, recorded_by)
             VALUES (?, 'Sale', ?, ?, ?, ?)`,
            [item.product_id, -Number(item.quantity), orderId, item.pos_sale_item_id, userId],
          );
        }

        const subtotalAmount = Number(sale.subtotal_amount);
        const newTotalAmount = Math.max(0, subtotalAmount - discountAmount);
        await connection.query<ResultSetHeader>(
          `UPDATE pos_sales
              SET sale_status = 'Paid',
                  payment_status = 'Paid',
                  discount_amount = ?,
                  total_amount = ?
            WHERE pos_sale_id = ?`,
          [discountAmount, newTotalAmount, orderId],
        );

        let paymentRefId: number | null = sale.payment_reference_id;
        if (paymentRefId) {
          await connection.query(
            `UPDATE payment_references
                SET validation_status = 'Validated',
                    validated_by = ?,
                    validated_at = NOW()
              WHERE payment_reference_id = ?`,
            [userId, paymentRefId],
          );
        } else {
          const refNumber = `POS-CASH-${sale.sale_number}-${Date.now()}`;
          const [insertResult] = await connection.query<ResultSetHeader>(
            `INSERT INTO payment_references
               (member_id, payer_name, payer_contact, provider, reference_number,
                payment_purpose, related_entity_type, related_entity_id,
                amount, validation_status,
                validated_by, validated_at, submitted_at, updated_at)
             VALUES (?, ?, ?, 'Cash', ?,
                     'POS/Product', 'POS_SALE', ?,
                     ?, 'Validated',
                     ?, NOW(), NOW(), NOW())`,
            [sale.member_id || null, sale.customer_name || "Walk-in", sale.customer_contact || null, refNumber, orderId, newTotalAmount, userId],
          );
          paymentRefId = insertResult.insertId;
          await connection.query("UPDATE pos_sales SET payment_reference_id = ? WHERE pos_sale_id = ?", [
            paymentRefId,
            orderId,
          ]);
        }

        const [categories] = await connection.query<FinancialCategoryRow[]>(
          "SELECT financial_category_id FROM financial_categories WHERE category_code = 'POS_SALES' LIMIT 1",
        );
        if (categories.length > 0) {
          const recordNumber = `FIN-POS-${orderId}-${Date.now()}`;
          await connection.query(
            `INSERT INTO financial_records
              (record_number, payment_reference_id, member_id, financial_category_id, recorded_by, approved_by, record_type, source_module, source_record_id, amount, record_date, record_status, remarks)
             VALUES (?, ?, ?, ?, ?, ?, 'Income', 'POS', ?, ?, CURDATE(), 'Active', ?)`,
            [
              recordNumber,
              paymentRefId || null,
              sale.member_id || null,
              categories[0].financial_category_id,
              userId,
              userId,
              orderId,
              newTotalAmount,
              `POS Sale #${sale.sale_number}`,
            ],
          );
        }

        const receiptNumber = `POS-RCP-${new Date().getUTCFullYear()}-${orderId.padStart(6, "0")}`;
        let generatedReceipt: Awaited<ReturnType<typeof createGeneratedPdfDocument>> | null = null;
        try {
          generatedReceipt = await createGeneratedPdfDocument(connection, {
            uploadedBy: userId,
            uploaderRole: auth.user.role,
            memberId: sale.member_id,
            title: `POS Receipt ${receiptNumber}`,
            description: "System-generated receipt for a confirmed TrackCOOP POS sale.",
            category: "RECEIPT",
            documentType: "Receipt",
            accessLevel: sale.member_id ? "Member-only" : "Bookkeeper-only",
            relatedModule: "POS_SALE",
            relatedRecordId: orderId,
            relatedRecordReference: sale.sale_number,
            relationshipType: "SYSTEM_RECEIPT",
            fileBaseName: receiptNumber,
            heading: "Point-of-Sale Receipt",
            lines: [
              { label: "Receipt number", value: receiptNumber },
              { label: "Sale number", value: sale.sale_number },
              { label: "Customer", value: sale.customer_name ?? "Walk-in" },
              { label: "Sale date", value: sale.sale_date },
              { label: "Subtotal", value: `PHP ${subtotalAmount.toFixed(2)}` },
              ...(discountAmount > 0 ? [{ label: "Discount", value: `PHP -${discountAmount.toFixed(2)}` }] : []),
              { label: "Amount paid", value: `PHP ${newTotalAmount.toFixed(2)}` },
              { label: "Payment status", value: "Paid" },
            ],
          });
        } catch (pdfErr) {
          console.error("PDF generation failed in POS confirmation:", pdfErr);
        }

        if (generatedReceipt && sale.member_id) {
          await connection.query(
            `INSERT INTO notifications
               (user_id, notification_type, title, message, related_entity_type, related_entity_id)
             SELECT mp.user_id, 'Document', 'POS receipt available',
                    CONCAT(?, ' is available in Documents.'), 'Document', ?
               FROM member_profiles mp
              WHERE mp.member_id = ? AND mp.user_id IS NOT NULL`,
            [receiptNumber, generatedReceipt.documentId, sale.member_id],
          );
        }

        return { receiptDocumentId: generatedReceipt?.documentId ?? null };
      }, databasePool());
    },

    async rejectOrder(orderId, input, auth) {
      const userId = numericUserId(auth);
      const reason = input.reason?.trim();
      await withTransaction(async (connection) => {
        const [sales] = await connection.query<Array<RowDataPacket & { sale_status: string; payment_reference_id?: number | null }>>(
          "SELECT sale_status, payment_reference_id FROM pos_sales WHERE pos_sale_id = ?",
          [orderId],
        );
        if (sales.length === 0) throw new AppError("Order not found", 404, "POS_ORDER_NOT_FOUND");
        if (sales[0].sale_status !== "Pending Payment") {
          throw new AppError("Only pending orders can be rejected", 400, "POS_ORDER_NOT_PENDING");
        }

        const notesAddition = reason ? `\n[Rejected Reason]: ${reason}` : "\n[Rejected Reason]: Order rejected by user.";
        await connection.query<ResultSetHeader>(
          `UPDATE pos_sales
              SET sale_status = 'Cancelled',
                  payment_status = 'Refunded',
                  notes = CONCAT(COALESCE(notes, ''), ?)
            WHERE pos_sale_id = ?`,
          [notesAddition, orderId],
        );

        if (sales[0].payment_reference_id) {
          await connection.query(
            `UPDATE payment_references
                SET validation_status = 'Rejected',
                    validated_by = ?,
                    validated_at = NOW(),
                    rejection_reason = ?
              WHERE payment_reference_id = ?`,
            [userId, reason || null, sales[0].payment_reference_id],
          );
        }
      }, databasePool());
    },

    async revokeOrder(orderId, input, auth) {
      const userId = numericUserId(auth);
      const reason = input.reason?.trim();
      await withTransaction(async (connection) => {
        const [sales] = await connection.query<PosSaleStatusRow[]>(
          `SELECT sale_number, sale_status, payment_reference_id, member_id, subtotal_amount, total_amount, customer_name, customer_contact, sale_date
             FROM pos_sales WHERE pos_sale_id = ?`,
          [orderId],
        );
        if (sales.length === 0) throw new AppError("Order not found", 404, "POS_ORDER_NOT_FOUND");
        const sale = sales[0];
        if (sale.sale_status !== "Paid") {
          throw new AppError("Only Paid orders can be revoked.", 400, "POS_ORDER_NOT_PAID");
        }

        const [items] = await connection.query<PosSaleItemRow[]>(
          "SELECT pos_sale_item_id, product_id, quantity FROM pos_sale_items WHERE pos_sale_id = ?",
          [orderId],
        );
        for (const item of items) {
          await connection.query(
            `INSERT INTO inventory_movements
               (product_id, movement_type, quantity_change, pos_sale_id, pos_sale_item_id, recorded_by)
             VALUES (?, 'Return In', ?, ?, ?, ?)`,
            [item.product_id, Number(item.quantity), orderId, item.pos_sale_item_id, userId],
          );
        }

        let newPaymentReferenceId = sale.payment_reference_id;
        if (newPaymentReferenceId) {
          const [refs] = await connection.query<PaymentReferenceRow[]>(
            "SELECT payment_reference_id, provider FROM payment_references WHERE payment_reference_id = ?",
            [newPaymentReferenceId],
          );
          if (refs.length > 0) {
            if (refs[0].provider === "Cash") {
              await connection.query(
                "UPDATE payment_references SET validation_status = 'Rejected', updated_at = NOW() WHERE payment_reference_id = ?",
                [newPaymentReferenceId],
              );
              newPaymentReferenceId = null;
            } else {
              await connection.query(
                "UPDATE payment_references SET validation_status = 'Pending', validated_by = NULL, validated_at = NULL, updated_at = NOW() WHERE payment_reference_id = ?",
                [newPaymentReferenceId],
              );
            }
          }
        }

        const financeRemarkAddition = reason
          ? ` (Voided due to Payment Revocation. Reason: ${reason})`
          : " (Voided due to Payment Revocation)";
        await connection.query(
          `UPDATE financial_records
              SET record_status = 'Voided',
                  remarks = CONCAT(COALESCE(remarks, ''), ?)
            WHERE source_module = 'POS'
              AND source_record_id = ?
              AND record_status = 'Active'`,
          [financeRemarkAddition, orderId],
        );

        const notesAddition = reason ? `\n[Revoked Reason]: ${reason}` : "\n[Revoked Reason]: Payment revoked by user.";
        const originalMemberDiscount = sale.member_id ? Number(sale.subtotal_amount) * 0.05 : 0;
        const newTotalAmount = Number(sale.subtotal_amount) - originalMemberDiscount;
        await connection.query<ResultSetHeader>(
          `UPDATE pos_sales
              SET sale_status = 'Pending Payment',
                  payment_status = 'Pending',
                  discount_amount = ?,
                  total_amount = ?,
                  payment_reference_id = ?,
                  notes = CONCAT(COALESCE(notes, ''), ?)
            WHERE pos_sale_id = ?`,
          [originalMemberDiscount, newTotalAmount, newPaymentReferenceId, notesAddition, orderId],
        );
      }, databasePool());
    },
  };
}
