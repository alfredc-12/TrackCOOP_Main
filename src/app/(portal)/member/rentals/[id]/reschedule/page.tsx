import { RentalMemberReschedule } from "@/app/rental/_components/RentalMemberArea";

export default async function RentalReschedulePage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return <RentalMemberReschedule rentalId={params.id} />;
}
