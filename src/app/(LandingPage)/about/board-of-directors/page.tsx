import type { Metadata } from "next";
import Image from "next/image";
import SiteFooter from "@/components/layout/SiteFooter";
import SiteHeader from "@/components/layout/SiteHeader";

export const metadata: Metadata = {
  title: "Board of Directors | TrackCOOP",
  description:
    "Board of Directors view for TrackCOOP cooperative management system.",
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
  compact = false,
}: {
  member: (typeof boardMembers)[number];
  compact?: boolean;
}) {
  return (
    <article
      className={`group overflow-hidden rounded-[16px] border border-[#DDE8D8] bg-white shadow-[0_18px_44px_rgba(18,61,42,0.08)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_24px_60px_rgba(18,61,42,0.14)] ${
        compact ? "" : "mx-auto w-full max-w-[370px]"
      }`}
    >
      <div className="relative aspect-[4/5] overflow-hidden bg-[#E8F0E3]">
        <img
          src={member.image}
          alt={`${member.name}, ${member.role}`}
          className="h-full w-full object-cover object-center transition duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-x-4 bottom-4">
          <div className="bg-[#33413B]/92 px-4 py-2 text-center text-sm font-black uppercase tracking-[0.08em] text-white shadow-sm">
            {member.name}
          </div>
          <div className="ml-auto w-fit bg-[#F2C94C] px-4 py-1.5 text-xs font-black uppercase tracking-[0.08em] text-[#073F2B] shadow-sm">
            {member.role}
          </div>
        </div>
      </div>
    </article>
  );
}

export default function BoardOfDirectorsPage() {
  const [chairperson, viceChairperson, ...directors] = boardMembers;

  return (
    <main className="min-h-screen bg-[#FFFAF2] pt-16 text-[#123D2A]">
      <SiteHeader initialActive="about" />

      <section className="relative overflow-hidden bg-[#123D2A] px-5 py-20 text-white sm:px-8 lg:py-24">
        <Image
          src="/images/Other%20Landing%20Page/About.jpg"
          alt="Cooperative board and members"
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
            Board of Directors
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-white/80">
            A dedicated view for cooperative leadership, roles, terms, and
            board-related records.
          </p>
        </div>
      </section>

      <section className="px-5 py-14 sm:px-8 lg:py-16">
        <div className="mx-auto max-w-7xl">
          <p className="text-xs font-bold uppercase tracking-[0.45em] text-[#F2B705]">
            Governance
          </p>
          <h2 className="mt-4 max-w-5xl text-4xl font-black leading-[0.98] tracking-normal text-[#073f2b] md:text-6xl lg:text-7xl">
            Board of Directors
          </h2>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-[#4b5563]">
            Cooperative leadership is presented in a simple directory view for
            officers, directors, and governance records. The portraits here are
            temporary placeholders for the final official board photos.
          </p>

          <div className="mt-12 grid gap-10">
            <div className="mx-auto w-full max-w-[420px]">
              <BoardCard member={chairperson} />
            </div>

            <div className="mx-auto w-full max-w-[420px]">
              <BoardCard member={viceChairperson} />
            </div>
          </div>

          <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {directors.map((member) => (
              <BoardCard key={member.name} member={member} compact />
            ))}
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
