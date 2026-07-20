import { RentalMemberPaymentProof } from "../../../../_components/RentalMemberArea";

export default async function MemberRentalPaymentPage({ params }: { params: Promise<{ rentalId: string }> }) { const { rentalId } = await params; return <RentalMemberPaymentProof rentalId={rentalId} />; }
