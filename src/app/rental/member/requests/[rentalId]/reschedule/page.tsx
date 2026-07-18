import { RentalMemberReschedule } from "../../../../_components/RentalMemberArea";

export default async function MemberRentalReschedulePage({ params }: { params: Promise<{ rentalId: string }> }) { const { rentalId } = await params; return <RentalMemberReschedule rentalId={rentalId} />; }
