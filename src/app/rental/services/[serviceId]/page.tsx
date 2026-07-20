import { RentalServiceDetails } from "../../_components/RentalServiceDetails";

export default async function RentalServiceDetailPage({ params }: { params: Promise<{ serviceId: string }> }) {
  const { serviceId } = await params;
  return <RentalServiceDetails serviceId={serviceId} />;
}
