import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { AppError } from "../../utils/app-error";
import {
  settlementMoney,
  settlementRecordDate,
} from "./paymongo.settlement.queries";
import type {
  GatewaySettlementDetails,
  PaymentReferenceForSettlement,
} from "./paymongo.settlement.types";

type PosSaleRow = RowDataPacket & {
  id: string;
  saleNumber: string;
  memberId: string | null;
  memberUserId: string | null;
  customerName: string | null;
  saleStatus: string;
  paymentStatus: string;
  subtotalAmount: string | number;
  discountAmount: string | number;
  totalAmount: string | number;
};

type PosSaleItemRow = RowDataPacket & {
  id: string;
  productId: string;
  quantity: string | number;
};

type InventoryBalanceRow = RowDataPacket & {
  stock: string | number | null;
};

type ExistingMovementRow = RowDataPacket & {
  count: string | number;
};

type FinancialCategoryRow = RowDataPacket & {
  id: string;
};

async function selectPosSaleForSettlement(
  connection: PoolConnection,
  saleId: string,
) {
  const [rows] = await connection.execute<PosSaleRow[]>(
    `SELECT CAST(ps.pos_sale_id AS CHAR) AS id,
            ps.sale_number AS saleNumber,
            CAST(ps.member_id AS CHAR) AS memberId,
            CAST(mp.user_id AS CHAR) AS memberUserId,
            ps.customer_name AS customerName,
            ps.sale_status AS saleStatus,
            ps.payment_status AS paymentStatus,
            ps.subtotal_amount AS subtotalAmount,
            ps.discount_amount AS discountAmount,
            ps.total_amount AS totalAmount
       FROM pos_sales ps
       LEFT JOIN member_profiles mp ON mp.member_id = ps.member_id
      WHERE ps.pos_sale_id = ?
      LIMIT 1 FOR UPDATE`,
    [saleId],
  );
  return rows[0] ?? null;
}

async function selectPosSaleItems(
  connection: PoolConnection,
  saleId: string,
) {
  const [rows] = await connection.execute<PosSaleItemRow[]>(
    `SELECT CAST(pos_sale_item_id AS CHAR) AS id,
            CAST(product_id AS CHAR) AS productId,
            quantity
       FROM pos_sale_items
      WHERE pos_sale_id = ?
      ORDER BY pos_sale_item_id ASC`,
    [saleId],
  );
  return rows;
}

async function selectPosSalesCategory(connection: PoolConnection) {
  const codes = ["POS_SALES", "OTHER_INCOME"];
  const [rows] = await connection.execute<FinancialCategoryRow[]>(
    `SELECT CAST(financial_category_id AS CHAR) AS id
       FROM financial_categories
      WHERE category_code IN (${codes.map(() => "?").join(", ")})
        AND is_active = 1
      ORDER BY FIELD(category_code, ${codes.map(() => "?").join(", ")})
      LIMIT 1`,
    [...codes, ...codes],
  );
  if (!rows[0]) {
    throw new AppError(
      "A POS Sales financial category is required before settlement",
      409,
      "POS_SETTLEMENT_CATEGORY_REQUIRED",
    );
  }
  return rows[0].id;
}

async function hasInventoryMovement(
  connection: PoolConnection,
  saleItemId: string,
) {
  const [rows] = await connection.execute<ExistingMovementRow[]>(
    `SELECT COUNT(*) AS count
       FROM inventory_movements
      WHERE pos_sale_item_id = ?
        AND movement_type = 'Sale'`,
    [saleItemId],
  );
  return Number(rows[0]?.count ?? 0) > 0;
}

async function assertAndDeductInventory(input: {
  connection: PoolConnection;
  saleId: string;
  saleItem: PosSaleItemRow;
  actorUserId: string;
}) {
  if (await hasInventoryMovement(input.connection, input.saleItem.id)) {
    return;
  }

  const [balances] = await input.connection.execute<InventoryBalanceRow[]>(
    `SELECT COALESCE(SUM(quantity_change), 0) AS stock
       FROM inventory_movements
      WHERE product_id = ?`,
    [input.saleItem.productId],
  );
  const currentStock = Number(balances[0]?.stock ?? 0);
  const quantity = Number(input.saleItem.quantity);
  if (currentStock < quantity) {
    throw new AppError(
      "Order quantity exceeds available stock.",
      409,
      "POS_SETTLEMENT_STOCK_UNAVAILABLE",
    );
  }

  await input.connection.execute(
    `INSERT INTO inventory_movements
       (product_id, movement_type, quantity_change, pos_sale_id, pos_sale_item_id, recorded_by)
     VALUES (?, 'Sale', ?, ?, ?, ?)`,
    [
      input.saleItem.productId,
      -quantity,
      input.saleId,
      input.saleItem.id,
      input.actorUserId,
    ],
  );
}

export type PointOfSalePostingResult = {
  inventoryPosted: boolean;
  financeCreated: boolean;
  memberId: string | null;
  memberUserId: string | null;
  subjectReference: string;
  subjectName: string;
};

export async function postPointOfSaleSettlement(input: {
  connection: PoolConnection;
  payment: PaymentReferenceForSettlement;
  actorUserId: string;
  gatewayDetails?: GatewaySettlementDetails | null;
}): Promise<PointOfSalePostingResult> {
  if (
    input.payment.paymentPurpose !== "POS/Product"
    || input.payment.relatedEntityType !== "pos_sales"
    || !input.payment.relatedEntityId
  ) {
    throw new AppError(
      "POS settlement requires a linked cooperative store sale",
      422,
      "POS_SETTLEMENT_ENTITY_INVALID",
    );
  }

  const sale = await selectPosSaleForSettlement(
    input.connection,
    input.payment.relatedEntityId,
  );
  if (!sale) {
    throw new AppError("POS sale was not found", 404, "POS_SALE_NOT_FOUND");
  }
  if (
    input.payment.memberId
    && sale.memberId
    && input.payment.memberId !== sale.memberId
  ) {
    throw new AppError(
      "The POS payment is linked to another member",
      409,
      "POS_PAYMENT_MEMBER_CONFLICT",
    );
  }
  if (settlementMoney(Number(sale.totalAmount)) !== settlementMoney(Number(input.payment.amount))) {
    throw new AppError(
      "POS payment amount does not match the sale total",
      422,
      "POS_PAYMENT_AMOUNT_MISMATCH",
    );
  }
  if (
    sale.saleStatus !== "Pending Payment"
    && !(sale.saleStatus === "Paid" && sale.paymentStatus === "Paid")
  ) {
    throw new AppError(
      "Only pending POS sales can be settled",
      409,
      "POS_SALE_NOT_SETTLEABLE",
    );
  }

  const items = await selectPosSaleItems(input.connection, sale.id);
  let inventoryPosted = false;
  for (const item of items) {
    const postedBefore = await hasInventoryMovement(input.connection, item.id);
    await assertAndDeductInventory({
      connection: input.connection,
      saleId: sale.id,
      saleItem: item,
      actorUserId: input.actorUserId,
    });
    inventoryPosted = inventoryPosted || !postedBefore;
  }

  await input.connection.execute(
    `UPDATE pos_sales
        SET sale_status = 'Paid',
            payment_status = 'Paid',
            amount_paid = total_amount,
            change_due = 0.00,
            updated_at = UTC_TIMESTAMP()
      WHERE pos_sale_id = ?`,
    [sale.id],
  );

  if (sale.memberId) {
    await input.connection.execute(
      `UPDATE payment_references
          SET member_id = ?, updated_at = UTC_TIMESTAMP()
        WHERE payment_reference_id = ?
          AND (member_id IS NULL OR member_id = ?)`,
      [sale.memberId, input.payment.id, sale.memberId],
    );
  }

  const categoryId = await selectPosSalesCategory(input.connection);
  const [financeResult] = await input.connection.execute<ResultSetHeader>(
    `INSERT INTO financial_records
       (record_number, payment_reference_id, member_id, financial_category_id,
        recorded_by, approved_by, record_type, source_module, source_record_id,
        amount, record_date, record_status, remarks)
     SELECT ?, ?, ?, ?, ?, ?, 'Income', 'POS', ?, ?, ?, 'Active', ?
      WHERE NOT EXISTS (
        SELECT 1 FROM financial_records WHERE payment_reference_id = ?
      )`,
    [
      `PAY-FIN-POS-${input.payment.id}`,
      input.payment.id,
      sale.memberId,
      categoryId,
      input.actorUserId,
      input.actorUserId,
      sale.id,
      input.payment.amount,
      settlementRecordDate(input.gatewayDetails?.paidAt),
      `PayMongo settlement for POS sale ${sale.saleNumber}`,
      input.payment.id,
    ],
  );

  return {
    inventoryPosted,
    financeCreated: financeResult.affectedRows > 0,
    memberId: sale.memberId,
    memberUserId: sale.memberUserId,
    subjectReference: sale.saleNumber,
    subjectName: sale.customerName ?? "Cooperative store order",
  };
}
