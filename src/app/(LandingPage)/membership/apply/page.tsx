import Link from "next/link";
import SiteFooter from "@/components/layout/SiteFooter";
import SiteHeader from "@/components/layout/SiteHeader";
import { MembershipApplicationForm } from "@/features/membership-applications/components/MembershipApplicationForm";

export default function MembershipApplyPage() {
  return (
    <main className="min-h-screen bg-[#F8F1E5] text-[#123D2A]">
      <SiteHeader initialActive="membership" />
      <section className="px-5 pb-12 pt-28 sm:px-8 lg:pb-16">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.42em] text-[#f4b62a]">
              Membership
            </p>
            <h1 className="mt-3 text-4xl font-black leading-[0.98] tracking-normal text-[#073f2b] md:text-6xl">
              Become a Member
            </h1>
            <p className="mt-5 text-base leading-8 text-[#365F4A]">
              Apply for cooperative membership and receive a private tracking
              secret after submission. Applications still require Chairman review.
            </p>
            <Link
              href="/membership/application-status"
              className="mt-4 inline-flex text-sm font-bold text-[#1F6B43] underline-offset-4 hover:underline"
            >
              Already submitted? Check application status.
            </Link>
          </div>

          <MembershipApplicationForm />
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
