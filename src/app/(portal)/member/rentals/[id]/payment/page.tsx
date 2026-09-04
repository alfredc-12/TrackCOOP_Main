import { RentalMemberPaymentProof } from "@/app/rental/_components/RentalMemberArea";

export default async function RentalPaymentProofPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return <RentalMemberPaymentProof rentalId={params.id} />;
}
