import Link from "next/link";
import Image from "next/image";
import SiteFooter from "@/components/layout/SiteFooter";
import SiteHeader from "@/components/layout/SiteHeader";
import { MembershipApplicationForm } from "@/features/membership-applications/components/MembershipApplicationForm";

export default function MembershipApplyPage() {
  return (
    <main className="min-h-screen bg-[#F8F1E5] text-[#123D2A]">
      <SiteHeader initialActive="membership" />
      <section className="px-5 pb-14 pt-28 sm:px-8 lg:pb-20">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
            <div className="max-w-3xl">
              <p className="text-xs font-bold uppercase tracking-[0.42em] text-[#f4b62a]">
                Membership
              </p>
              <h1 className="mt-4 text-5xl font-black leading-[0.94] tracking-normal text-[#073f2b] md:text-7xl">
                Become a Member
              </h1>
              <p className="mt-6 text-lg leading-9 text-[#365F4A]">
                Apply for cooperative membership and receive a private tracking
                secret after submission. Applications still require Chairman review.
              </p>
              <Link
                href="/membership/application-status"
                className="mt-5 inline-flex rounded-full bg-white px-5 py-3 text-sm font-bold text-[#1F6B43] shadow-sm ring-1 ring-[#DDE8D8] transition hover:bg-[#EAF3E8]"
              >
                Already submitted? Check application status.
              </Link>
            </div>

            <div className="relative min-h-[300px] overflow-hidden rounded-[2rem] shadow-[0_24px_70px_rgba(18,61,42,0.16)] ring-1 ring-white/70 lg:min-h-[430px]">
              <Image
                src="/images/Hero%20Page/Main%20Photo%201.jpg"
                alt="TrackCOOP members working together in the field"
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 46vw"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#123D2A]/70 via-[#123D2A]/10 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-6 text-white sm:p-8">
                <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#f4d47a]">
                  NFFAC
                </p>
                <p className="mt-2 max-w-md text-xl font-black leading-tight">
                  Membership records, requirements, and review in one clear path.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-10">
            <MembershipApplicationForm />
          </div>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
