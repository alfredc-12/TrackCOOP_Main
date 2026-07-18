import { RentalReceiptPreview } from "../../_components/RentalReceiptPreview";

export default async function RentalReceiptPage({ params }: { params: Promise<{ receiptId: string }> }) { const { receiptId } = await params; return <RentalReceiptPreview receiptId={receiptId} />; }
