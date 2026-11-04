import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, UsersRound, Wallet } from "lucide-react";
import SiteHeader from "@/components/layout/SiteHeader";
import SiteFooter from "@/components/layout/SiteFooter";

const cooperativeName =
  "Nasugbu Farmers and Fisherfolks Agriculture Cooperative";

export const metadata: Metadata = {
  title: "Our Cooperative | TrackCOOP",
  description:
    "Learn about the cooperative, membership categories, and member classifications supported by TrackCOOP.",
};

const classifications = [
  {
    title: "True Member",
    note: "Full membership status",
    description:
      "A True Member pays PHP 1,500 in share capital for membership. Associate membership costs PHP 200 instead. TrackCOOP records payments, membership status, and share capital contributions.",
  },
  {
    title: "Associate Member",
    note: "Associate membership category",
    description:
      "Associate Member refers to a cooperative member who is registered under the associate membership category and has paid the required associate membership fee. This member is recorded in the system for membership monitoring, approval tracking, payment records, announcements, and selected cooperative services, but is not yet classified as a true member because the full share capital requirement has not been completed.",
  },
];

export default function OurCooperativePage() {
  return (
    <main className="public-about min-h-screen overflow-hidden bg-[var(--public-canvas)] text-[#123D2A]">
      <SiteHeader initialActive="about" />

      <section className="relative min-h-[24rem] overflow-hidden bg-[#123D2A] px-5 pb-12 pt-28 text-white sm:px-8 lg:pb-14 lg:pt-32">
        <Image
          src="/images/Hero%20Page/Main%20Photo%204.jpg"
          alt="Cooperative members and agriculture activity"
          fill
          unoptimized
          priority
          sizes="100vw"
          className="public-hero-media object-cover object-[center_42%] opacity-70"
        />
        <div className="absolute inset-0 bg-[#052F22]/70" />
        <div className="relative z-10 mx-auto max-w-7xl">
          <p className="mb-4 text-xs font-bold uppercase tracking-[0.35em] text-[#F2C94C]">
            About
          </p>
          <h1 className="max-w-5xl text-4xl font-black leading-[1.05] sm:text-6xl lg:text-7xl">
            Our Cooperative
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-white/90 sm:text-lg sm:leading-8">
            A member-centered agriculture cooperative supported by TrackCOOP for
            clearer records, membership monitoring, and cooperative service
            coordination.
          </p>
        </div>
      </section>

      <section className="bg-white px-5 py-16 sm:px-8 lg:py-20">
        <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
          <div className="min-w-0">
            <SectionHeading label="Welcome" title="Built around local producers." />
            <div className="mt-6 space-y-5 text-base leading-8 text-[#365F4A]">
              <p>
                {cooperativeName} brings together farmers, fisherfolks, and
                community partners who rely on organized records, transparent
                member services, and practical coordination for agriculture and
                livelihood activities.
              </p>
              <p>
                TrackCOOP supports this work by helping the cooperative monitor
                membership, approvals, payments, documents, announcements, and
                selected services in one clear management system.
              </p>
            </div>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link href="/membership/apply" className="public-action inline-flex min-h-11 items-center gap-3 rounded-md bg-[#123D2A] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#1F6B43] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1F6B43]">Become a Member<ArrowRight aria-hidden="true" className="size-4" /></Link>
              <Link href="/about/board-of-directors" className="public-action inline-flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-semibold text-[#123D2A] transition-colors hover:bg-[#EAF3E8] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1F6B43]">Meet the board<ArrowRight aria-hidden="true" className="size-4" /></Link>
            </div>
          </div>

          <div className="public-card min-w-0 overflow-hidden p-2.5">
            <div className="public-media overflow-hidden rounded-md">
            <Image
              src="/images/Other%20Landing%20Page/About.jpg"
              alt="Nasugbu farmers and fisherfolks cooperative members"
              width={2048}
              height={2730}
              unoptimized
              sizes="(max-width: 1024px) 100vw, 46vw"
              className="aspect-[4/3] w-full rounded-md object-cover object-[center_42%] lg:aspect-square"
            />
            </div>
          </div>
        </div>
      </section>

      <section
        className="relative bg-cover bg-scroll bg-center bg-no-repeat px-5 py-16 text-white sm:px-8 lg:bg-fixed lg:py-20"
        style={{ backgroundImage: "url('/images/stats/underlay.jpg')" }}
      >
        <div className="absolute inset-0 bg-[#052F22]/68" />
        <div className="relative z-10 mx-auto flex max-w-7xl flex-col items-center justify-center text-center">
          <h2 className="text-3xl font-black leading-tight text-white sm:text-4xl">
            Membership
          </h2>
          <p className="mt-6 max-w-3xl text-base leading-8 text-white/90 sm:text-lg">
            Membership in the cooperative records each person&apos;s participation,
            payment progress, approval status, and access to selected services.
            TrackCOOP helps distinguish associate members from true members while
            keeping share capital records, membership fees, certificates,
            announcements, and cooperative service history easier to monitor.
          </p>
        </div>
      </section>

      <section className="px-5 py-16 sm:px-8 lg:py-20">
        <div className="mx-auto max-w-7xl">
          <SectionHeading
            label="Classification"
            title="Member status made easier to understand."
          />
          <div className="mt-8 grid gap-5 lg:grid-cols-2">
            {classifications.map((classification, index) => (
              <article
                key={classification.title}
                className="public-card flex flex-col p-6 sm:p-8"
              >
                {index === 0 ? <Wallet aria-hidden="true" className="mb-5 size-7 text-[#1F6B43]" /> : <UsersRound aria-hidden="true" className="mb-5 size-7 text-[#1F6B43]" />}
                <h3 className="text-2xl font-black text-[#073f2b] sm:text-3xl">
                  {classification.title}
                </h3>
                <p className="mt-2 text-sm font-semibold text-[#1F6B43]">{classification.note}</p>
                <p className="mt-5 text-base leading-8 text-[#365F4A]">
                  {classification.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}

function SectionHeading({ label, title }: { label: string; title: string }) {
  return (
    <div>
      <p className="mb-3 text-xs font-bold uppercase tracking-[0.35em] text-[#9A6400]">
        {label}
      </p>
      <h2 className="max-w-4xl text-3xl font-black leading-[1.1] text-[#073f2b] sm:text-4xl lg:text-5xl">
        {title}
      </h2>
    </div>
  );
}
