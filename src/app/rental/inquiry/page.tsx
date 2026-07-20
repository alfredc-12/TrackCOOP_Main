import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { RentalInquiryForm } from "../_components/RentalInquiryForm";

export default function InquiryPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-11">
      <div className="mx-auto mb-7 max-w-4xl">
        <Link
          href="/rental"
          className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-[#617269] transition hover:text-[#08753a]"
        >
          <ArrowLeft className="size-4" />
          Back to Services
        </Link>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-[#10231a] sm:text-4xl">
          Submit Rental Inquiry
        </h1>
        <p className="mt-2 max-w-2xl text-base leading-7 text-[#68776e]">
          Complete the three steps below to send a rental inquiry to NFFAC.
        </p>
      </div>
      <RentalInquiryForm />
    </div>
  );
}
