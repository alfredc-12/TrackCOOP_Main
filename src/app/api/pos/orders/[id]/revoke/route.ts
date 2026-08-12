import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { requireApiUser } from "@/lib/next-api-auth";

type PosSaleStatusRow = RowDataPacket & {
    sale_number: string;
    sale_status: string;
    payment_reference_id: number | null;
    member_id: number | null;
    subtotal_amount: number | string;
    total_amount: number | string;
};

type PosSaleItemRow = RowDataPacket & {
    pos_sale_item_id: number;
    product_id: number;
    quantity: number;
};

type PaymentReferenceRow = RowDataPacket & {
    payment_reference_id: number;
    provider: string;
};

export async function PUT(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        // Only allow Chairman and Bookkeeper to revoke
        const auth = await requireApiUser(["chairman", "bookkeeper"]);
        if (auth.response) return auth.response;

        const { id: orderId } = await params;
        const body = await req.json().catch(() => ({}));
        const reason = body.reason?.trim();

        const connection = await db.getConnection();
        await connection.beginTransaction();
        try {
            // 1. Fetch Order Status
            const [sales] = await connection.query<PosSaleStatusRow[]>(
                `SELECT sale_number, sale_status, payment_reference_id, member_id, subtotal_amount, total_amount
                   FROM pos_sales WHERE pos_sale_id = ?`,
                [orderId]
            );

            if (sales.length === 0) {
                await connection.rollback();
                return NextResponse.json({ error: "Order not found" }, { status: 404 });
            }

            if (sales[0].sale_status !== 'Paid') {
                await connection.rollback();
                return NextResponse.json({ error: "Only Paid orders can be revoked." }, { status: 400 });
            }

            // 2. Add stock back (Reversal)
            const [items] = await connection.query<PosSaleItemRow[]>(
                `SELECT pos_sale_item_id, product_id, quantity FROM pos_sale_items WHERE pos_sale_id = ?`,
                [orderId]
            );

            for (const item of items) {
                await connection.query(
                    `INSERT INTO inventory_movements 
                     (product_id, movement_type, quantity_change, pos_sale_id, pos_sale_item_id, recorded_by) 
                     VALUES (?, 'Return In', ?, ?, ?, ?)`,
                    [item.product_id, item.quantity, orderId, item.pos_sale_item_id, auth.user.numericId]
                );
            }

            // 3. Revert Payment Reference
            let newPaymentReferenceId = sales[0].payment_reference_id;
            if (newPaymentReferenceId) {
                const [refs] = await connection.query<PaymentReferenceRow[]>(
                    `SELECT provider FROM payment_references WHERE payment_reference_id = ?`,
                    [newPaymentReferenceId]
                );
                
                if (refs.length > 0) {
                    if (refs[0].provider === 'Cash') {
                        // Cash payments are system generated, so we void them and detach from order
                        await connection.query(
                            `UPDATE payment_references SET validation_status = 'Rejected', updated_at = NOW() WHERE payment_reference_id = ?`,
                            [newPaymentReferenceId]
                        );
                        newPaymentReferenceId = null; // Detach
                    } else {
                        // External payments (e.g., GCash) uploaded by member -> set back to Pending so they can be re-validated or rejected properly
                        await connection.query(
                            `UPDATE payment_references SET validation_status = 'Pending', validated_by = NULL, validated_at = NULL, updated_at = NOW() WHERE payment_reference_id = ?`,
                            [newPaymentReferenceId]
                        );
                    }
                }
            }

            // 4. Void Financial Records
            const financeRemarkAddition = reason 
                ? ` (Voided due to Payment Revocation. Reason: ${reason})` 
                : ` (Voided due to Payment Revocation)`;
                
            await connection.query(
                `UPDATE financial_records 
                 SET record_status = 'Voided', remarks = CONCAT(COALESCE(remarks, ''), ?)
                 WHERE source_module = 'POS' AND source_record_id = ? AND record_status = 'Active'`,
                [financeRemarkAddition, orderId]
            );

            // 5. Reset Order Status and append to notes
            const notesAddition = reason ? `\n[Revoked Reason]: ${reason}` : `\n[Revoked Reason]: Payment revoked by user.`;
            
            const originalMemberDiscount = sales[0].member_id ? Number(sales[0].subtotal_amount) * 0.05 : 0;
            const newTotalAmount = Number(sales[0].subtotal_amount) - originalMemberDiscount;

            await connection.query<ResultSetHeader>(
                `UPDATE pos_sales 
                 SET sale_status = 'Pending Payment', 
                     payment_status = 'Pending',
                     discount_amount = ?, 
                     total_amount = ?,
                     payment_reference_id = ?,
                     notes = CONCAT(COALESCE(notes, ''), ?)
                 WHERE pos_sale_id = ?`,
                [originalMemberDiscount, newTotalAmount, newPaymentReferenceId, notesAddition, orderId]
            );

            await connection.commit();
            return NextResponse.json({ success: true, message: "Payment revoked successfully." });
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error("Failed to revoke order payment:", error);
        return NextResponse.json(
            { 
                error: "Failed to revoke order payment", 
                details: error instanceof Error ? error.message : "Unknown error" 
            },
            { status: 500 }
        );
    }
}
