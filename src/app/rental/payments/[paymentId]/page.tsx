import { RentalPaymentDetails } from "../../_components/RentalPayments";

export default async function RentalPaymentPage({ params }: { params: Promise<{ paymentId: string }> }) { const { paymentId } = await params; return <RentalPaymentDetails paymentId={paymentId} />; }
