import { RentalInquiryForm } from "../_components/RentalInquiryForm";
import { RentalPageHeader } from "../_components/RentalPageHeader";

export default function InquiryPage() {
  return <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6"><RentalPageHeader eyebrow="Public Rental Inquiry" title="Tell us what you need" description="Complete the form, review your information, and submit it to NFFAC. This is an inquiry—not a confirmed booking or price quotation." /><RentalInquiryForm /></div>;
}
