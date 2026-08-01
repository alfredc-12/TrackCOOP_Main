import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { requireApiUser } from "@/lib/next-api-auth";
import { createGeneratedPdfDocument } from "@/../server/src/records/generated-pdf-document";

type PosSaleStatusRow = RowDataPacket & {
    sale_number: string;
    sale_status: string;
    payment_reference_id: number | null;
    member_id: number | null;
    total_amount: number | string;
    customer_name: string | null;
    customer_contact: string | null;
    sale_date: string;
};

type PosSaleItemRow = RowDataPacket & {
    pos_sale_item_id: number;
    product_id: number;
    quantity: number;
};

type InventoryBalanceRow = RowDataPacket & {
    stock: number | string | null;
};

type FinancialCategoryRow = RowDataPacket & {
    financial_category_id: number;
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
                `SELECT sale_number, sale_status, payment_reference_id, member_id,
                        total_amount, customer_name, customer_contact, sale_date
                   FROM pos_sales WHERE pos_sale_id = ?`,
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

            // Resolve the payment_reference_id to use for this sale
            let paymentRefId: number | null = sales[0].payment_reference_id;

            if (paymentRefId) {
                // If it already has a payment_reference (e.g. GCash), mark it as Validated
                await connection.query(
                    `UPDATE payment_references
                     SET validation_status = 'Validated',
                         validated_by = ?,
                         validated_at = NOW()
                     WHERE payment_reference_id = ?`,
                    [auth.user.numericId, paymentRefId]
                );
            } else {
                // Cash sale – create a payment_reference so it shows in the Payments page
                const refNumber = `POS-CASH-${sales[0].sale_number}`;
                const [insertResult] = await connection.query<ResultSetHeader>(
                    `INSERT INTO payment_references
                     (member_id, payer_name, payer_contact, provider, reference_number,
                      payment_purpose, related_entity_type, related_entity_id,
                      amount, validation_status, payment_channel,
                      validated_by, validated_at, submitted_at, updated_at)
                     VALUES (?, ?, ?, 'Cash', ?,
                             'POS/Product', 'POS_SALE', ?,
                             ?, 'Validated', 'Cash',
                             ?, NOW(), NOW(), NOW())`,
                    [
                        sales[0].member_id || null,
                        sales[0].customer_name || 'Walk-in',
                        sales[0].customer_contact || null,
                        refNumber,
                        orderId,
                        sales[0].total_amount || 0,
                        auth.user.numericId,
                    ]
                );
                paymentRefId = insertResult.insertId;

                // Link the new payment_reference back to the sale
                await connection.query(
                    `UPDATE pos_sales SET payment_reference_id = ? WHERE pos_sale_id = ?`,
                    [paymentRefId, orderId]
                );
            }

            // Generate Financial Record for the sale
            const [categories] = await connection.query<FinancialCategoryRow[]>(
                `SELECT financial_category_id FROM financial_categories WHERE category_code = 'POS_SALES' LIMIT 1`
            );
            
            if (categories.length > 0) {
                const categoryId = categories[0].financial_category_id;
                const recordNumber = `FIN-POS-${orderId}-${Date.now()}`;
                await connection.query(
                    `INSERT INTO financial_records 
                    (record_number, payment_reference_id, member_id, financial_category_id, recorded_by, approved_by, record_type, source_module, source_record_id, amount, record_date, record_status, remarks) 
                    VALUES (?, ?, ?, ?, ?, ?, 'Income', 'POS', ?, ?, CURDATE(), 'Active', ?)`,
                    [
                        recordNumber,
                        paymentRefId || null,
                        sales[0].member_id || null,
                        categoryId,
                        auth.user.numericId,
                        auth.user.numericId,
                        orderId,
                        sales[0].total_amount || 0,
                        `POS Sale #${sales[0].sale_number}`
                    ]
                );
            }

            const receiptNumber = `POS-RCP-${new Date().getUTCFullYear()}-${orderId.padStart(6, "0")}`;
            let generatedReceipt = null;
            try {
                generatedReceipt = await createGeneratedPdfDocument(connection, {
                    uploadedBy: auth.user.numericId,
                    uploaderRole: auth.user.role,
                    memberId: sales[0].member_id,
                    title: `POS Receipt ${receiptNumber}`,
                    description: "System-generated receipt for a confirmed TrackCOOP POS sale.",
                    category: "RECEIPT",
                    documentType: "Receipt",
                    accessLevel: sales[0].member_id ? "Member-only" : "Bookkeeper-only",
                    relatedModule: "POS_SALE",
                    relatedRecordId: orderId,
                    relatedRecordReference: sales[0].sale_number,
                    relationshipType: "SYSTEM_RECEIPT",
                    fileBaseName: receiptNumber,
                    heading: "Point-of-Sale Receipt",
                    lines: [
                        { label: "Receipt number", value: receiptNumber },
                        { label: "Sale number", value: sales[0].sale_number },
                        { label: "Customer", value: sales[0].customer_name ?? "Walk-in" },
                        { label: "Sale date", value: sales[0].sale_date },
                        { label: "Amount paid", value: `PHP ${sales[0].total_amount}` },
                        { label: "Payment status", value: "Paid" },
                    ],
                });
            } catch (pdfErr) {
                console.error("PDF generation failed in API route:", pdfErr);
                // Proceed without PDF receipt for now rather than failing the whole order confirmation.
            }

            if (generatedReceipt && sales[0].member_id) {
                await connection.query(
                    `INSERT INTO notifications
                       (user_id, notification_type, title, message, related_entity_type, related_entity_id)
                     SELECT mp.user_id, 'Document', 'POS receipt available',
                            CONCAT(?, ' is available in Documents.'), 'Document', ?
                       FROM member_profiles mp
                      WHERE mp.member_id = ? AND mp.user_id IS NOT NULL`,
                    [receiptNumber, generatedReceipt.documentId, sales[0].member_id],
                );
            }

            await connection.commit();
            return NextResponse.json({
                success: true,
                receiptDocumentId: generatedReceipt?.documentId ?? null,
            });
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }
    } catch (error: unknown) {
        console.error("Failed to confirm order:", error);
        return NextResponse.json({ 
            error: "Failed to confirm order", 
            details: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
    }
}
