import { RentalRequestReview } from "../../../_components/RentalRequestReview";

export default async function InquiryReviewPage({ params }: { params: Promise<{ inquiryId: string }> }) { const { inquiryId } = await params; return <RentalRequestReview inquiryId={inquiryId} />; }
