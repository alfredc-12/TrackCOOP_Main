import { Suspense } from "react";
import Image from "next/image";
import SiteFooter from "@/components/layout/SiteFooter";
import SiteHeader from "@/components/layout/SiteHeader";
import { ApplicationStatusLookup } from "@/features/membership-applications/components/ApplicationStatusLookup";

export default function MembershipApplicationStatusPage() {
  return (
    <main className="min-h-screen bg-[#F8F1E5] text-[#123D2A]">
      <SiteHeader initialActive="membership" />
      <section className="px-5 pb-12 pt-28 sm:px-8 lg:pb-16">
        <div className="mx-auto max-w-6xl">
          <div className="mb-10 grid gap-8 lg:grid-cols-[1fr_0.9fr] lg:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.42em] text-[#f4b62a]">
                Membership
              </p>
              <h1 className="mt-4 text-5xl font-black leading-[0.94] tracking-normal text-[#073f2b] md:text-7xl">
                Application Status
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-9 text-[#365F4A]">
                Use your application code and private tracking secret to follow
                the public review status.
              </p>
            </div>

            <div className="relative min-h-[240px] overflow-hidden rounded-[2rem] shadow-[0_24px_70px_rgba(18,61,42,0.16)] ring-1 ring-white/70 lg:min-h-[320px]">
              <Image
                src="/images/Hero%20Page/Main%20Photo%203.jpg"
                alt="TrackCOOP cooperative field activity"
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 40vw"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#123D2A]/72 via-[#123D2A]/12 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                <p className="text-sm font-black leading-tight">
                  Safe public tracking for submitted membership applications.
                </p>
              </div>
            </div>
          </div>

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
    <div className="grid min-h-[380px] place-items-center rounded-[2rem] border border-white/80 bg-white/95 p-8 text-center shadow-[0_24px_70px_rgba(18,61,42,0.10)] ring-1 ring-[#DDE8D8]">
      <p className="text-sm font-bold text-[#365F4A]">Loading status form...</p>
    </div>
  );
}
