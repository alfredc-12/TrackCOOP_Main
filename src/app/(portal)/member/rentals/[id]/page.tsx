import { RentalMemberRequestDetails } from "@/app/rental/_components/RentalMemberArea";

export default async function RentalRequestDetailsPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return <RentalMemberRequestDetails rentalId={params.id} />;
}
