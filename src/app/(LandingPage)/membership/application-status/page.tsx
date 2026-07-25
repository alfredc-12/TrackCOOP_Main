import { Suspense } from "react";
import SiteFooter from "@/components/layout/SiteFooter";
import SiteHeader from "@/components/layout/SiteHeader";
import { ApplicationStatusLookup } from "@/features/membership-applications/components/ApplicationStatusLookup";

export default function MembershipApplicationStatusPage() {
  return (
    <main className="min-h-screen bg-[#F8F1E5] text-[#123D2A]">
      <SiteHeader initialActive="membership" />
      <section className="px-5 pb-12 pt-28 sm:px-8 lg:pb-16">
        <div className="mx-auto max-w-6xl">
          <Suspense fallback={<StatusFallback />}>
            <ApplicationStatusLookup />
          </Suspense>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}

function StatusFallback() {
  return (
    <div className="grid min-h-[380px] place-items-center border border-[#DDE8D8] bg-white p-8 text-center shadow-sm">
      <p className="text-sm font-bold text-[#365F4A]">Loading status form...</p>
    </div>
  );
}
