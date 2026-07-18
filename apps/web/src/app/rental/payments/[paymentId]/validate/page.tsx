import { RentalPaymentDetails } from "../../../_components/RentalPayments";

export default async function ValidateRentalPaymentPage({ params }: { params: Promise<{ paymentId: string }> }) { const { paymentId } = await params; return <RentalPaymentDetails paymentId={paymentId} validate />; }
