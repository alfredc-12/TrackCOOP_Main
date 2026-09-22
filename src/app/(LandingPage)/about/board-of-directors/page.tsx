import type { Metadata } from "next";
import Image from "next/image";
import SiteFooter from "@/components/layout/SiteFooter";
import SiteHeader from "@/components/layout/SiteHeader";

export const metadata: Metadata = {
  title: "Board of Directors | TrackCOOP",
  description:
    "Board of Directors view for TrackCOOP cooperative leadership and governance records.",
};

const boardMembers = [
  {
    name: "Rafael Santos",
    role: "Chairperson",
    image: "https://randomuser.me/api/portraits/men/75.jpg",
    featured: true,
  },
  {
    name: "Elena Mercado",
    role: "Vice Chairperson",
    image: "https://randomuser.me/api/portraits/women/65.jpg",
    featured: true,
  },
  {
    name: "Mario Reyes",
    role: "Director",
    image: "https://randomuser.me/api/portraits/men/32.jpg",
  },
  {
    name: "Lorna Castillo",
    role: "Director",
    image: "https://randomuser.me/api/portraits/women/44.jpg",
  },
  {
    name: "Victor Ramos",
    role: "Director",
    image: "https://randomuser.me/api/portraits/men/52.jpg",
  },
  {
    name: "Amelia Torres",
    role: "Director",
    image: "https://randomuser.me/api/portraits/women/72.jpg",
  },
  {
    name: "Daniel Cruz",
    role: "Director",
    image: "https://randomuser.me/api/portraits/men/62.jpg",
  },
  {
    name: "Nora Mendoza",
    role: "Director",
    image: "https://randomuser.me/api/portraits/women/79.jpg",
  },
  {
    name: "Samuel Aquino",
    role: "Director",
    image: "https://randomuser.me/api/portraits/men/43.jpg",
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
      className={`group w-full overflow-hidden rounded-md border border-[#DDE8D8] bg-white shadow-[0_18px_44px_rgba(18,61,42,0.1)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_24px_60px_rgba(18,61,42,0.16)] ${
        featured ? "max-w-[260px]" : "max-w-[220px]"
      }`}
    >
      <div className="relative aspect-[4/5] overflow-hidden bg-[#E8F0E3]">
        <Image
          src={member.image}
          alt={`${member.name}, ${member.role}`}
          fill
          unoptimized
          sizes={featured ? "260px" : "220px"}
          className="h-full w-full object-cover object-center transition duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-x-0 bottom-0 bg-[#073F2B]/95 px-3 py-3 text-center">
          <p className="truncate text-[11px] font-black uppercase tracking-[0.18em] text-white">
            {member.name}
          </p>
          <p className="mx-auto mt-2 w-fit rounded-sm bg-[#F2C94C] px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-[#073F2B]">
            {member.role}
          </p>
        </div>
      </div>
    </article>
  );
}

export default function BoardOfDirectorsPage() {
  const [chairperson, viceChairperson, ...directors] = boardMembers;

  return (
    <main className="min-h-screen overflow-hidden bg-white text-[#123D2A]">
      <SiteHeader initialActive="about" />

      <section className="relative min-h-[24rem] overflow-hidden bg-[#123D2A] px-5 pb-10 pt-24 text-white sm:px-8 lg:min-h-[26rem] lg:pb-12 lg:pt-28">
        <Image
          src="/images/Other%20Landing%20Page/About.jpg"
          alt="Cooperative members gathered together"
          fill
          priority
          unoptimized
          sizes="100vw"
          className="object-cover object-center opacity-45"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#052F22]/95 via-[#052F22]/82 to-[#052F22]/45" />
        <div className="relative z-10 mx-auto max-w-7xl">
          <p className="mb-6 text-xs font-black uppercase tracking-[0.48em] text-[#F2C94C]">
            About
          </p>
          <h1 className="max-w-6xl text-5xl font-black leading-[0.95] tracking-normal md:text-7xl lg:text-8xl">
            Board of Directors
          </h1>
          <p className="mt-7 max-w-3xl text-lg leading-8 text-white/88 md:text-xl md:leading-9">
            Meet the cooperative leaders responsible for member representation,
            governance oversight, and steady stewardship of TrackCOOP records.
          </p>
        </div>
      </section>

      <section className="bg-[#F8F1E5] px-5 py-16 sm:px-8 lg:py-20">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.95fr_1fr] lg:items-center">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.48em] text-[#F2B705]">
              Governance
            </p>
            <h2 className="mt-5 max-w-4xl text-4xl font-black leading-[0.98] tracking-normal text-[#073F2B] md:text-6xl lg:text-7xl">
              Leadership in service of members.
            </h2>
            <p className="mt-7 max-w-3xl text-lg leading-8 text-[#4B5563]">
              The board directory gives members a clear view of official
              leadership roles while keeping cooperative records organized for
              meetings, terms, and future governance updates.
            </p>
          </div>

          <div className="relative min-h-[18rem] overflow-hidden rounded-md border border-[#DDE8D8] bg-[#E8F0E3] shadow-[0_28px_80px_rgba(18,61,42,0.2)] sm:min-h-[24rem]">
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
      </section>

      <section className="border-t border-[#E0EADC] bg-[#FFFDF8] px-5 py-16 sm:px-8 lg:py-20">
        <div className="mx-auto max-w-6xl">
          <div className="mb-10 text-center">
            <p className="text-xs font-black uppercase tracking-[0.48em] text-[#F2B705]">
              Directory
            </p>
            <h2 className="mt-4 text-4xl font-black leading-none text-[#073F2B] md:text-5xl">
              Current officers and directors
            </h2>
          </div>

          <div className="flex flex-wrap justify-center gap-6 sm:gap-8">
            <BoardCard member={chairperson} featured />
            <BoardCard member={viceChairperson} featured />
          </div>

          <div className="mx-auto mt-8 grid max-w-[760px] grid-cols-1 justify-items-center gap-6 sm:grid-cols-2 lg:grid-cols-3">
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
