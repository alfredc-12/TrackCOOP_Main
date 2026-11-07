import Link from "next/link";
import { ArrowRight } from "lucide-react";
import SiteFooter from "@/components/layout/SiteFooter";
import SiteHeader from "@/components/layout/SiteHeader";
import { MembershipApplicationForm } from "@/features/membership-applications/components/MembershipApplicationForm";

export default function MembershipApplyPage() {
  return (
    <main className="public-apply min-h-screen overflow-x-clip bg-[var(--public-canvas)] text-[#123D2A]">
      <SiteHeader initialActive="membership" />
      <section className="px-4 pb-12 pt-20 sm:px-8 sm:pb-14 sm:pt-24 lg:pb-20">
        <div className="mx-auto w-full max-w-7xl">
          <div className="mb-7 flex flex-col items-center gap-5 border-b border-[var(--public-section-border)] pb-6 text-center sm:items-end sm:text-left lg:mb-8">
            <div className="w-full min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-[#9A6400]">
                Membership
              </p>
              <h1 className="mt-2 text-3xl font-black leading-tight tracking-normal text-[#073f2b] sm:text-4xl">
                Become a Member
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#365F4A]">
                Complete the application below. Payment opens only after chairman review.
              </p>
            </div>
            <Link
              href="/membership/application-status"
              className="public-apply-action inline-flex min-h-11 w-full shrink-0 items-center justify-center gap-3 border border-[var(--public-card-border)] bg-white px-5 py-2 text-sm font-semibold text-[#123D2A] shadow-sm hover:bg-[#EAF3E8] sm:w-auto"
            >
              Check application status
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </div>

          <MembershipApplicationForm />
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
