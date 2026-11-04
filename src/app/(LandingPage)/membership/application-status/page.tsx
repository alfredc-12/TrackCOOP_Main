import { Suspense } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import SiteFooter from "@/components/layout/SiteFooter";
import SiteHeader from "@/components/layout/SiteHeader";
import { ApplicationStatusPayments } from "@/features/membership-applications/components/ApplicationStatusPayments";

export default function MembershipApplicationStatusPage() {
  return (
    <main className="public-apply public-status flex min-h-screen flex-col overflow-x-clip bg-[var(--public-canvas)] text-[#123D2A]">
      <SiteHeader initialActive="membership" />
      <section className="flex-1 px-5 pb-12 pt-24 sm:px-8 lg:pb-16">
        <div className="mx-auto w-full max-w-7xl">
          <div className="mb-7 flex flex-col gap-5 border-b border-[var(--public-section-border)] pb-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-[#9A6400]">Membership</p>
              <h1 className="mt-2 text-3xl font-black leading-tight text-[#073F2B] sm:text-4xl">Application Status</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#365F4A]">Use your application code and applicant date of birth to follow your review status, messages, and payment updates.</p>
            </div>
            <Link href="/membership/apply" className="public-apply-action inline-flex min-h-11 shrink-0 items-center justify-center gap-3 rounded-md border border-[var(--public-card-border)] bg-white px-5 py-2 text-sm font-semibold text-[#123D2A] shadow-sm hover:bg-[#EAF3E8]">
              Become a Member<ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </div>
          <Suspense fallback={<StatusFallback />}>
            <ApplicationStatusPayments />
          </Suspense>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}

function StatusFallback() {
  return (
    <div role="status" className="public-apply-card grid min-h-[300px] place-items-center p-8 text-center">
      <p className="text-sm font-bold text-[#365F4A]">Loading status form...</p>
    </div>
  );
}
