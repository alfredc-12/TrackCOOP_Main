import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import SiteFooter from "@/components/layout/SiteFooter";
import SiteHeader from "@/components/layout/SiteHeader";
import { BoardMemberPortrait } from "@/features/landing-public/BoardMemberPortrait";

export const metadata: Metadata = {
  title: "Board of Directors | TrackCOOP",
  description:
    "Board of Directors view for TrackCOOP cooperative leadership and governance records.",
};

const boardMembers = [
  {
    name: "Rafael Santos",
    role: "Chairperson",
    featured: true,
  },
  {
    name: "Elena Mercado",
    role: "Vice Chairperson",
    featured: true,
  },
  {
    name: "Mario Reyes",
    role: "Director",
  },
  {
    name: "Lorna Castillo",
    role: "Director",
  },
  {
    name: "Victor Ramos",
    role: "Director",
  },
  {
    name: "Amelia Torres",
    role: "Director",
  },
  {
    name: "Daniel Cruz",
    role: "Director",
  },
  {
    name: "Nora Mendoza",
    role: "Director",
  },
  {
    name: "Samuel Aquino",
    role: "Director",
  },
];

function BoardCard({
  member,
  featured = false,
}: {
  member: (typeof boardMembers)[number];
  featured?: boolean;
}) {
  return (
    <article
      className={`public-card group min-w-0 overflow-hidden ${
        featured ? "w-full max-w-[290px]" : "w-[calc(50%_-_0.75rem)] max-w-[250px] sm:w-[calc((100%_-_3rem)/3)] lg:w-[calc((100%_-_4.5rem)/4)]"
      }`}
    >
      <div className="public-media relative aspect-[4/5] overflow-hidden bg-[#EAF3E8]">
        <BoardMemberPortrait name={member.name} role={member.role} />
      </div>
      <div className="px-4 py-4 text-center sm:px-5 sm:py-5">
        <h3 className="break-words text-base font-bold leading-6 text-[#123D2A] sm:text-lg">{member.name}</h3>
        <p className="mt-1 text-sm font-semibold leading-6 text-[#1F6B43]">{member.role}</p>
      </div>
    </article>
  );
}

export default function BoardOfDirectorsPage() {
  const [chairperson, viceChairperson, ...directors] = boardMembers;

  return (
    <main className="public-about min-h-screen overflow-hidden bg-[var(--public-canvas)] text-[#123D2A]">
      <SiteHeader initialActive="about" />

      <section className="relative min-h-[24rem] overflow-hidden bg-[#123D2A] px-5 pb-12 pt-28 text-white sm:px-8 lg:pb-14 lg:pt-32">
        <Image
          src="/images/Other%20Landing%20Page/About.jpg"
          alt="Cooperative members gathered together"
          fill
          priority
          unoptimized
          sizes="100vw"
          className="public-hero-media object-cover object-[center_42%] opacity-70"
        />
        <div className="absolute inset-0 bg-[#052F22]/70" />
        <div className="relative z-10 mx-auto max-w-7xl">
          <p className="mb-4 text-xs font-bold uppercase tracking-[0.35em] text-[#F2C94C]">
            About
          </p>
          <h1 className="max-w-5xl text-4xl font-black leading-[1.05] sm:text-6xl lg:text-7xl">
            Board of Directors
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-white/90 sm:text-lg sm:leading-8">
            Meet the cooperative leaders responsible for member representation,
            governance oversight, and steady stewardship of TrackCOOP records.
          </p>
        </div>
      </section>

      <section className="bg-white px-5 py-16 sm:px-8 lg:py-20">
        <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[1.05fr_.95fr] lg:gap-14">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.35em] text-[#9A6400]">
              Governance
            </p>
            <h2 className="mt-3 max-w-4xl text-3xl font-black leading-[1.1] text-[#073F2B] sm:text-4xl lg:text-5xl">
              Leadership in service of members.
            </h2>
            <p className="mt-6 max-w-3xl text-base leading-8 text-[#365F4A]">
              The board directory gives members a clear view of official
              leadership roles while keeping cooperative records organized for
              meetings, terms, and future governance updates.
            </p>
            <Link href="#board-directory" className="public-action mt-7 inline-flex min-h-11 items-center gap-3 rounded-md bg-[#123D2A] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#1F6B43] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1F6B43]">View the directory<ArrowRight aria-hidden="true" className="size-4" /></Link>
          </div>

          <div className="public-card min-w-0 overflow-hidden p-2.5">
            <div className="public-media relative aspect-[4/3] overflow-hidden rounded-md bg-[#EAF3E8]">
              <Image
                src="/images/Hero%20Page/Main%20Photo%204.jpg"
                alt="TrackCOOP cooperative gathering"
                fill
                unoptimized
                sizes="(min-width: 1024px) 50vw, 100vw"
                className="object-cover object-center"
              />
            </div>
          </div>
        </div>
      </section>

      <section id="board-directory" className="scroll-mt-20 bg-[var(--public-canvas)] px-5 py-16 sm:px-8 lg:py-20">
        <div className="mx-auto max-w-7xl">
          <div className="mb-10 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.35em] text-[#9A6400]">
                Directory
              </p>
              <h2 className="mt-3 max-w-3xl text-2xl font-black leading-tight text-[#073F2B] sm:text-4xl lg:text-5xl">
                Current officers and directors
              </h2>
            </div>
            <Link href="/about/our-cooperative" className="public-action inline-flex min-h-11 shrink-0 items-center gap-3 rounded-md text-sm font-semibold text-[#123D2A] hover:text-[#1F6B43] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1F6B43]">Our Cooperative<ArrowRight aria-hidden="true" className="size-4" /></Link>
          </div>

          <div className="mx-auto grid max-w-[604px] grid-cols-2 justify-items-center gap-6">
            <BoardCard member={chairperson} featured />
            <BoardCard member={viceChairperson} featured />
          </div>

          <div className="mx-auto mt-8 flex max-w-[1100px] flex-wrap justify-center gap-6">
            {directors.map((member) => (
              <BoardCard key={member.name} member={member} />
            ))}
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
