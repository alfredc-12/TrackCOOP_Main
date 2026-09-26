import Link from "next/link";
import SiteFooter from "@/components/layout/SiteFooter";
import SiteHeader from "@/components/layout/SiteHeader";
import { MembershipApplicationForm } from "@/features/membership-applications/components/MembershipApplicationForm";

export default function MembershipApplyPage() {
  return (
    <main className="min-h-screen bg-[#F8F1E5] text-[#123D2A]">
      <SiteHeader initialActive="membership" />
      <section className="px-5 pb-14 pt-24 sm:px-8 lg:pb-20">
        <div className="mx-auto max-w-6xl">
          <div className="mb-6 flex flex-col gap-3 border-b border-[#D9E3D7] pb-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.28em] text-[#D8A011]">
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
              className="inline-flex h-11 items-center justify-center rounded-full bg-white px-5 text-sm font-black text-[#123D2A] shadow-sm ring-1 ring-[#CAD8CB] transition hover:bg-[#EAF3E8]"
            >
              Check application status
            </Link>
          </div>

          <MembershipApplicationForm />
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
