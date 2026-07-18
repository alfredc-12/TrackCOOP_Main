import { RentalRequestDetails } from "../../_components/RentalRequestDetails";

export default async function InquiryDetailPage({ params }: { params: Promise<{ inquiryId: string }> }) { const { inquiryId } = await params; return <RentalRequestDetails inquiryId={inquiryId} />; }
