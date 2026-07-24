import { ChairmanRentalBookingDetails } from "../../_components/ChairmanRentalBookingDetails";

export default async function ChairmanRentalBookingDetailPage({
  params,
}: {
  params: Promise<{ bookingId: string }>;
}) {
  const { bookingId } = await params;
  return (
    <ChairmanRentalBookingDetails bookingId={decodeURIComponent(bookingId)} />
  );
}
