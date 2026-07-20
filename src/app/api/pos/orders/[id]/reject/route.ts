import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ResultSetHeader } from "mysql2";

export async function PUT(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: orderId } = await params;

        const connection = await db.getConnection();
        await connection.beginTransaction();
        try {
            // Check if already paid or cancelled
            const [sales] = await connection.query<any[]>(
                `SELECT sale_status, payment_reference_id FROM pos_sales WHERE pos_sale_id = ?`,
                [orderId]
            );

            if (sales.length === 0) {
                await connection.rollback();
                return NextResponse.json({ error: "Order not found" }, { status: 404 });
            }

            if (sales[0].sale_status !== 'Pending Payment') {
                await connection.rollback();
                return NextResponse.json({ error: "Only pending orders can be rejected" }, { status: 400 });
            }

            // Update status to Cancelled
            await connection.query<ResultSetHeader>(
                `UPDATE pos_sales 
                 SET sale_status = 'Cancelled', payment_status = 'Refunded' 
                 WHERE pos_sale_id = ?`,
                [orderId]
            );

            // If it's a GCash payment (has payment_reference_id), we should update the payment_references to Rejected
            if (sales[0].payment_reference_id) {
                await connection.query(
                    `UPDATE payment_references 
                     SET validation_status = 'Rejected', 
                         validated_by = 1, 
                         validated_at = NOW()
                     WHERE payment_reference_id = ?`,
                    [sales[0].payment_reference_id]
                );
            }

            await connection.commit();
            return NextResponse.json({ message: "Order rejected successfully" });
        } catch (error) {
            await connection.rollback();
            console.error("Database error in reject order transaction:", error);
            return NextResponse.json({ error: "Failed to reject order" }, { status: 500 });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error("Error in reject order API:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
