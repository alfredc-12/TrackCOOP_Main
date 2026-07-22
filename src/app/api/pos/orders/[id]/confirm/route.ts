import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { requireApiUser } from "@/lib/next-api-auth";

type PosSaleStatusRow = RowDataPacket & {
    sale_status: string;
};

type PosSaleItemRow = RowDataPacket & {
    pos_sale_item_id: number;
    product_id: number;
    quantity: number;
};

type InventoryBalanceRow = RowDataPacket & {
    stock: number | string | null;
};

export async function PUT(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const auth = await requireApiUser(["chairman", "bookkeeper"]);
        if (auth.response) return auth.response;

        const { id: orderId } = await params;

        const connection = await db.getConnection();
        await connection.beginTransaction();
        try {
            const [sales] = await connection.query<PosSaleStatusRow[]>(
                `SELECT sale_status FROM pos_sales WHERE pos_sale_id = ?`,
                [orderId]
            );

            if (sales.length === 0) {
                await connection.rollback();
                return NextResponse.json({ error: "Order not found" }, { status: 404 });
            }

            if (sales[0].sale_status !== 'Pending Payment') {
                await connection.rollback();
                return NextResponse.json({ error: "Only pending orders can be confirmed." }, { status: 400 });
            }

            // Fetch items to deduct stock
            const [items] = await connection.query<PosSaleItemRow[]>(
                `SELECT pos_sale_item_id, product_id, quantity FROM pos_sale_items WHERE pos_sale_id = ?`,
                [orderId]
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
                    await connection.rollback();
                    return NextResponse.json({ error: "Order quantity exceeds available stock." }, { status: 409 });
                }

                await connection.query(
                    `INSERT INTO inventory_movements 
                     (product_id, movement_type, quantity_change, pos_sale_id, pos_sale_item_id, recorded_by) 
                     VALUES (?, 'Sale', ?, ?, ?, ?)`,
                    [item.product_id, -item.quantity, orderId, item.pos_sale_item_id, auth.user.numericId]
                );
            }

            // Update status
            await connection.query<ResultSetHeader>(
                `UPDATE pos_sales 
                 SET sale_status = 'Paid', payment_status = 'Paid' 
                 WHERE pos_sale_id = ?`,
                [orderId]
            );

            // If it's a GCash payment (has payment_reference_id), we should also update the payment_references to Validated
            await connection.query(
                `UPDATE payment_references pr 
                 JOIN pos_sales s ON s.payment_reference_id = pr.payment_reference_id
                 SET pr.validation_status = 'Validated', 
                     pr.validated_by = ?, 
                     pr.validated_at = NOW(),
                     pr.payer_contact = COALESCE(pr.payer_contact, s.customer_contact)
                 WHERE s.pos_sale_id = ?`,
                [auth.user.numericId, orderId]
            );

            await connection.commit();
            return NextResponse.json({ success: true });
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }
    } catch (error: unknown) {
        console.error("Failed to confirm order:", error);
        return NextResponse.json({ error: "Failed to confirm order" }, { status: 500 });
    }
}
