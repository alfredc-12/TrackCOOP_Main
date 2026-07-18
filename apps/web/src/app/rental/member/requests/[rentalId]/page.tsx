import { RentalMemberRequestDetails } from "../../../_components/RentalMemberArea";

export default async function MemberRentalRequestPage({ params }: { params: Promise<{ rentalId: string }> }) { const { rentalId } = await params; return <RentalMemberRequestDetails rentalId={rentalId} />; }
