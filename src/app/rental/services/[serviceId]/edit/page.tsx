import { RentalServiceForm } from "../../../_components/RentalServiceForm";

export default async function EditRentalServicePage({ params }: { params: Promise<{ serviceId: string }> }) { const { serviceId } = await params; return <RentalServiceForm serviceId={serviceId} />; }
