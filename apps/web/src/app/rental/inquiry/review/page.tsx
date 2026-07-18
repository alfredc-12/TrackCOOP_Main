import { RentalInquiryReview } from "../../_components/RentalInquiryReview";
import { RentalPageHeader } from "../../_components/RentalPageHeader";

export default function InquiryReviewPage() {
  return <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6"><RentalPageHeader eyebrow="Step 2 of 2" title="Review your rental inquiry" description="Check every detail before sending the inquiry to NFFAC." /><RentalInquiryReview /></div>;
}
