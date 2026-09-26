import { Suspense } from "react";
import SiteFooter from "@/components/layout/SiteFooter";
import SiteHeader from "@/components/layout/SiteHeader";
import { ApplicationStatusPayments } from "@/features/membership-applications/components/ApplicationStatusPayments";

export default function MembershipApplicationStatusPage() {
  return (
    <main className="min-h-screen bg-[#F8F1E5] text-[#123D2A]">
      <SiteHeader initialActive="membership" />
      <section className="px-5 pb-12 pt-24 sm:px-8 lg:pb-16">
        <div className="mx-auto max-w-6xl">
          <div className="mb-6 border-b border-[#D9E3D7] pb-5">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.28em] text-[#D8A011]">
                Membership
              </p>
              <h1 className="mt-2 text-3xl font-black leading-tight tracking-normal text-[#073f2b] sm:text-4xl">
                Application Status
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#365F4A]">
                Use your application code and applicant date of birth to follow
                the review status and eligible PayMongo payments.
              </p>
            </div>
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
    <div className="grid min-h-[380px] place-items-center rounded-[18px] border border-white/80 bg-white/95 p-8 text-center shadow-[0_24px_70px_rgba(18,61,42,0.10)] ring-1 ring-[#DDE8D8]">
      <p className="text-sm font-bold text-[#365F4A]">Loading status form...</p>
    </div>
  );
}
