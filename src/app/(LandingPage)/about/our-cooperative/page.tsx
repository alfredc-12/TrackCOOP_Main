import type { Metadata } from "next";
import Image from "next/image";
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
      "A True Member refers to a member who has fulfilled or is completing the cooperative's share capital requirement for full membership status. In TrackCOOP, true members are monitored through share capital records, payment progress, certificates, member status, and contribution summaries. The confirmed true-member share capital requirement is PHP 3,000, with an initial payment of PHP 1,500.",
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
    <main className="min-h-screen bg-[#FFFAF2] pt-16 text-[#123D2A]">
      <SiteHeader initialActive="about" />

      <section className="relative overflow-hidden bg-[#123D2A] px-5 py-20 text-white sm:px-8 lg:py-24">
        <Image
          src="/images/Hero%20Page/Main%20Photo%204.jpg"
          alt="Cooperative members and agriculture activity"
          fill
          unoptimized
          priority
          sizes="100vw"
          className="object-cover opacity-35"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#052F22]/95 via-[#052F22]/78 to-[#052F22]/35" />
        <div className="relative z-10 mx-auto max-w-7xl">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.45em] text-[#F2C94C]">
            About
          </p>
          <h1 className="max-w-5xl text-5xl font-black leading-[0.98] tracking-normal md:text-7xl lg:text-8xl">
            Our Cooperative
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-white/80">
            A member-centered agriculture cooperative supported by TrackCOOP for
            clearer records, membership monitoring, and cooperative service
            coordination.
          </p>
        </div>
      </section>

      <section className="px-5 py-14 sm:px-8 lg:py-16">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-stretch">
          <div>
            <SectionHeading label="Welcome" title="Built around local producers." />
            <div className="mt-7 space-y-5 text-lg leading-8 text-[#4b5563]">
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
          </div>

          <div className="relative min-h-[360px] overflow-hidden rounded-[18px] border border-[#DDE8D8] bg-white shadow-[0_24px_70px_rgba(31,107,67,0.18)]">
            <Image
              src="/images/Other%20Landing%20Page/About.jpg"
              alt="Nasugbu farmers and fisherfolks cooperative members"
              fill
              unoptimized
              sizes="(max-width: 1024px) 100vw, 46vw"
              className="object-cover"
            />
          </div>
        </div>
      </section>

      <section
        className="relative min-h-[420px] bg-cover bg-fixed bg-center bg-no-repeat px-5 py-20 text-white sm:px-8 lg:py-24"
        style={{ backgroundImage: "url('/images/stats/underlay.jpg')" }}
      >
        <div className="absolute inset-0 bg-[#052F22]/68" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(242,201,76,0.20),transparent_34%)]" />
        <div className="relative z-10 mx-auto flex min-h-[260px] max-w-7xl flex-col items-center justify-center text-center">
          <p className="text-xs font-bold uppercase tracking-[0.45em] text-[#F2C94C] drop-shadow-[0_1px_4px_rgba(0,0,0,0.5)]">
            Membership
          </p>
          <p className="mt-8 max-w-4xl text-lg leading-8 text-white/88 sm:text-xl sm:leading-9">
            Membership in the cooperative records each person&apos;s participation,
            payment progress, approval status, and access to selected services.
            TrackCOOP helps distinguish associate members from true members while
            keeping share capital records, membership fees, certificates,
            announcements, and cooperative service history easier to monitor.
          </p>
        </div>
      </section>

      <section className="px-5 py-14 sm:px-8 lg:py-16">
        <div className="mx-auto max-w-7xl">
          <SectionHeading
            label="Classification"
            title="Member status made easier to understand."
          />
          <div className="mt-8 grid gap-5 lg:grid-cols-2">
            {classifications.map((classification) => (
              <article
                key={classification.title}
                className="rounded-[18px] border border-[#DDE8D8] bg-white p-7 shadow-[0_18px_52px_rgba(18,61,42,0.08)]"
              >
                <p className="text-xs font-bold uppercase tracking-[0.28em] text-[#F2B705]">
                  {classification.note}
                </p>
                <h2 className="mt-4 text-3xl font-black text-[#073f2b]">
                  {classification.title}
                </h2>
                <p className="mt-5 text-base leading-8 text-[#4b5563]">
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
      <p className="mb-3 text-xs font-bold uppercase tracking-[0.45em] text-[#F2B705]">
        {label}
      </p>
      <h2 className="max-w-5xl text-4xl font-black leading-[0.98] tracking-normal text-[#073f2b] md:text-6xl">
        {title}
      </h2>
    </div>
  );
}
