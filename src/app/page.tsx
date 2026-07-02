"use client";

import { motion } from "framer-motion";
import {
  ArrowRight,
  CalendarCheck,
  FileCheck2,
  Leaf,
  Mail,
  MapPin,
  Menu,
  Phone,
  Sprout,
  UsersRound,
  Waves,
  Wheat,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

const cooperativeName =
  "NASUGBU FARMERS AND FISHERFOLKS AGRICULTURE COOPERATIVE";

const photos = {
  hero:
    "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=2400&q=85",
  about:
    "https://images.unsplash.com/photo-1464226184884-fa280b87c399?auto=format&fit=crop&w=1400&q=85",
  rice:
    "https://images.unsplash.com/photo-1471193945509-9ad0617afabf?auto=format&fit=crop&w=1100&q=85",
  nursery:
    "https://images.unsplash.com/photo-1523348837708-15d4a09cfac2?auto=format&fit=crop&w=1100&q=85",
  fisheries:
    "https://images.unsplash.com/photo-1534766555764-ce878a5e3a2b?auto=format&fit=crop&w=1100&q=85",
  farm:
    "https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&w=1100&q=85",
};

const stats = [
  { label: "Farmer members", value: "1,240+", icon: UsersRound },
  { label: "Farm lots assisted", value: "380+", icon: Sprout },
  { label: "Fishery partners", value: "90+", icon: Waves },
  { label: "Annual programs", value: "24", icon: CalendarCheck },
];

const projects = [
  {
    title: "Rice Production Support",
    caption: "Seed, field monitoring, and harvest coordination for member farms.",
    image: photos.rice,
    className: "md:col-span-5 md:row-span-2",
  },
  {
    title: "Seedling Nursery",
    caption: "Shared growing support for resilient crop cycles.",
    image: photos.nursery,
    className: "md:col-span-7",
  },
  {
    title: "Fisherfolk Livelihood",
    caption: "Aquaculture and market preparation for coastal members.",
    image: photos.fisheries,
    className: "md:col-span-4",
  },
  {
    title: "Field Operations",
    caption: "Planning, tools, and cooperative-led production tracking.",
    image: photos.farm,
    className: "md:col-span-3",
  },
];

const certifications = [
  "CDA Registration",
  "BIR Certificate",
  "Mayor's Permit",
  "Good Standing",
  "Agriculture Accreditation",
  "Fisherfolk Registry",
];

const fadeUp = {
  initial: { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: 0.65, ease: "easeOut" },
} as const;

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#F8F1E5] text-[#1E1E1E]">
      <Header />
      <Hero />
      <MarqueeBand />
      <StatsBand />
      <AboutSection />
      <ProjectsSection />
      <CertificationsSection />
      <ContactSection />
      <Footer />
    </main>
  );
}

function Header() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-[#0b160f]/72 text-white backdrop-blur-xl">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-8">
        <Link href="#home" className="flex items-center gap-3">
          <span className="grid size-12 place-items-center rounded-md bg-white p-1.5">
            <Image
              src="/logo.png"
              alt="Cooperative logo"
              width={38}
              height={38}
              className="rounded"
              priority
            />
          </span>
          <span className="hidden leading-tight sm:block">
            <span className="block text-sm font-bold uppercase tracking-[0.14em]">
              NFFAC
            </span>
            <span className="block text-xs text-white/65">Agriculture Cooperative</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-8 text-sm font-semibold text-white/80 lg:flex">
          <a href="#about" className="transition hover:text-white">About</a>
          <a href="#projects" className="transition hover:text-white">Projects</a>
          <a href="#certifications" className="transition hover:text-white">Certifications</a>
          <a href="#contact" className="transition hover:text-white">Contact</a>
        </nav>

        <div className="flex items-center gap-3">
          <Link href="/login" className="hidden sm:inline-flex">
            <Button className="h-11 rounded-full border border-white/25 bg-transparent px-5 text-white hover:bg-white hover:text-[#123D2A]">
              Portal
              <ArrowRight className="size-4" />
            </Button>
          </Link>
          <button
            aria-label="Open menu"
            className="grid size-11 place-items-center rounded-md border border-white/20 bg-white/10 lg:hidden"
          >
            <Menu className="size-5" />
          </button>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section
      id="home"
      className="relative flex min-h-screen items-center justify-center overflow-hidden px-5 pb-24 pt-28 text-white sm:px-8"
    >
      <Image
        src={photos.hero}
        alt="Agriculture terraces and green farms"
        fill
        priority
        unoptimized
        className="object-cover"
      />
      <div className="absolute inset-0 bg-[#07110b]/58" />
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#07110b] to-transparent" />

      <motion.div
        initial={{ opacity: 0, y: 26 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.75, ease: "easeOut" }}
        className="relative z-10 mx-auto max-w-6xl text-center"
      >
        <div className="mx-auto mb-10 grid size-28 place-items-center rounded-md border border-white/20 bg-white/10 p-4 backdrop-blur-md">
          <Leaf className="size-14 text-[#F2C94C]" />
        </div>
        <p className="text-2xl font-bold tracking-normal text-white sm:text-4xl">
          Growing livelihoods.
        </p>
        <h1 className="mx-auto mt-5 max-w-5xl text-5xl font-bold leading-[1.04] tracking-normal sm:text-7xl lg:text-8xl">
          Built for farmers and fisherfolks.
        </h1>
        <p className="mx-auto mt-8 max-w-3xl text-lg leading-8 text-white/78 sm:text-xl">
          A warm agriculture cooperative portal for member services, farm
          programs, certifications, and community contact.
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link href="#projects">
            <Button className="h-14 w-full rounded-full bg-white px-8 text-[#123D2A] hover:bg-[#F2C94C] sm:w-auto">
              View Projects
              <ArrowRight className="size-4" />
            </Button>
          </Link>
          <Link href="#contact">
            <Button
              variant="secondary"
              className="h-14 w-full rounded-full border border-white/35 bg-white/10 px-8 text-white backdrop-blur-md hover:bg-white hover:text-[#123D2A] sm:w-auto"
            >
              Contact Cooperative
            </Button>
          </Link>
        </div>
      </motion.div>
    </section>
  );
}

function MarqueeBand() {
  const marqueeItems = Array.from({ length: 6 }, (_, index) => index);

  return (
    <section className="border-b border-[#E5E7EB] bg-white py-8">
      <div className="overflow-hidden whitespace-nowrap">
        <motion.div
          animate={{ x: ["0%", "-50%"] }}
          transition={{ duration: 26, repeat: Infinity, ease: "linear" }}
          className="inline-flex min-w-max gap-10"
        >
          {[...marqueeItems, ...marqueeItems].map((_, index) => (
            <span
              key={index}
              className="text-xl font-bold uppercase tracking-[0.14em] text-[#123D2A] sm:text-3xl"
            >
              {cooperativeName}
            </span>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

function StatsBand() {
  return (
    <section className="bg-[#FFFAF2] px-5 py-14 sm:px-8">
      <div className="mx-auto grid max-w-7xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, index) => (
          <motion.div
            key={stat.label}
            {...fadeUp}
            transition={{ duration: 0.55, delay: index * 0.07, ease: "easeOut" }}
            className="rounded-[24px] border border-[#E5E7EB] bg-white p-6 shadow-sm"
          >
            <stat.icon className="mb-8 size-7 text-[#1F6B43]" />
            <p className="text-4xl font-bold text-[#123D2A]">{stat.value}</p>
            <p className="mt-2 font-medium text-[#6B7280]">{stat.label}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

function AboutSection() {
  return (
    <section id="about" className="bg-[#FFFAF2] px-5 py-20 sm:px-8 lg:py-28">
      <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[0.92fr_1.08fr]">
        <motion.div {...fadeUp} className="relative min-h-[420px] overflow-hidden rounded-[28px]">
          <Image
            src={photos.about}
            alt="Farmers planting rice seedlings"
            fill
            unoptimized
            className="object-cover"
          />
          <div className="absolute inset-x-5 bottom-5 rounded-[20px] bg-white/88 p-5 backdrop-blur-md">
            <p className="text-sm font-bold uppercase tracking-[0.14em] text-[#1F6B43]">
              Farmers and fisherfolks
            </p>
            <p className="mt-2 text-lg font-bold text-[#123D2A]">
              Organized production, shared services, and member support.
            </p>
          </div>
        </motion.div>

        <motion.div {...fadeUp} transition={{ duration: 0.65, delay: 0.08, ease: "easeOut" }}>
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#4F9D69]">
            About The Cooperative
          </p>
          <h2 className="mt-4 text-4xl font-bold leading-tight tracking-normal text-[#123D2A] sm:text-6xl">
            Rooted in Nasugbu agriculture.
          </h2>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-[#4b5563]">
            {cooperativeName} supports local producers through cooperative
            services, farm coordination, fishery livelihood tracking, and
            accessible community information.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <MiniPanel
              icon={Wheat}
              title="Farm Programs"
              copy="Crop support, production activities, and seasonal coordination."
            />
            <MiniPanel
              icon={Waves}
              title="Fishery Support"
              copy="Livelihood visibility for coastal and aquaculture members."
            />
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function ProjectsSection() {
  return (
    <section id="projects" className="bg-black px-5 py-20 text-white sm:px-8 lg:py-28">
      <div className="mx-auto max-w-7xl">
        <motion.div {...fadeUp} className="mb-10">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#F2C94C]">
            Projects
          </p>
          <h2 className="mt-4 text-4xl font-bold tracking-normal sm:text-6xl">
            Cooperative Projects
          </h2>
        </motion.div>

        <div className="grid auto-rows-[220px] gap-4 md:grid-cols-12">
          {projects.map((project, index) => (
            <motion.article
              key={project.title}
              {...fadeUp}
              transition={{ duration: 0.6, delay: index * 0.08, ease: "easeOut" }}
              whileHover={{ y: -8 }}
              className={`group relative overflow-hidden rounded-[24px] ${project.className}`}
            >
              <Image
                src={project.image}
                alt={project.title}
                fill
                unoptimized
                className="object-cover transition duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/82 via-black/20 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-5">
                <h3 className="text-xl font-bold">{project.title}</h3>
                <p className="mt-2 max-w-md text-sm leading-6 text-white/76">
                  {project.caption}
                </p>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}

function CertificationsSection() {
  return (
    <section id="certifications" className="bg-[#F8F1E5] py-20">
      <div className="px-5 sm:px-8">
        <motion.div {...fadeUp} className="mx-auto max-w-7xl">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#4F9D69]">
            Cooperative Documents
          </p>
          <div className="mt-4 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <h2 className="max-w-3xl text-4xl font-bold leading-tight tracking-normal text-[#123D2A] sm:text-6xl">
              Certifications ready for member confidence.
            </h2>
            <p className="max-w-md text-lg leading-8 text-[#6B7280]">
              A simple carousel for key registrations, permits, and cooperative
              validation documents.
            </p>
          </div>
        </motion.div>
      </div>

      <div className="mt-12 overflow-hidden">
        <motion.div
          animate={{ x: ["0%", "-50%"] }}
          transition={{ duration: 22, repeat: Infinity, ease: "linear" }}
          className="flex w-max gap-5 px-5 sm:px-8"
        >
          {[...certifications, ...certifications].map((item, index) => (
            <div
              key={`${item}-${index}`}
              className="w-[300px] shrink-0 rounded-[24px] border border-[#E5E7EB] bg-white p-6 shadow-sm"
            >
              <div className="mb-10 flex items-center justify-between">
                <div className="grid size-12 place-items-center rounded-full bg-[#EAF3E8] text-[#1F6B43]">
                  <FileCheck2 className="size-6" />
                </div>
                <span className="rounded-full bg-[#EAF3E8] px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] text-[#1F6B43]">
                  Validated
                </span>
              </div>
              <h3 className="text-2xl font-bold text-[#123D2A]">{item}</h3>
              <p className="mt-3 text-sm leading-6 text-[#6B7280]">
                Certificate record prepared for cooperative profile display.
              </p>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

function ContactSection() {
  const mapSrc =
    "https://maps.google.com/maps?q=14.058886759350967,120.63832068540415&z=16&output=embed";

  return (
    <section id="contact" className="bg-[#FFFAF2] px-5 py-20 sm:px-8 lg:py-28">
      <div className="mx-auto max-w-7xl">
        <motion.div {...fadeUp} className="mb-12">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#4F9D69]">
            Contact
          </p>
          <h2 className="mt-4 text-4xl font-bold tracking-normal text-[#123D2A] sm:text-6xl">
            Visit or reach the cooperative.
          </h2>
        </motion.div>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <motion.div
            {...fadeUp}
            className="min-h-[420px] overflow-hidden rounded-[28px] border border-[#E5E7EB] bg-white shadow-sm"
          >
            <iframe
              title="Nasugbu Farmers and Fisherfolks Agriculture Cooperative location"
              src={mapSrc}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="h-full min-h-[420px] w-full"
            />
          </motion.div>

          <motion.div
            {...fadeUp}
            transition={{ duration: 0.65, delay: 0.08, ease: "easeOut" }}
            className="rounded-[28px] bg-[#123D2A] p-7 text-white shadow-sm sm:p-9"
          >
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#F2C94C]">
              {cooperativeName}
            </p>
            <h3 className="mt-5 text-3xl font-bold leading-tight tracking-normal sm:text-4xl">
              We are here for farm, fishery, and member service concerns.
            </h3>
            <div className="mt-9 grid gap-4">
              <ContactRow
                icon={MapPin}
                label="Map Coordinates"
                value="14.058886759350967, 120.63832068540415"
              />
              <ContactRow icon={Phone} label="Phone" value="(043) 000-0000" />
              <ContactRow
                icon={Mail}
                label="Email"
                value="nasugbu.agri.coop@example.com"
              />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-white/10 bg-black px-5 py-10 text-white sm:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="font-bold uppercase tracking-[0.16em]">{cooperativeName}</p>
          <p className="mt-2 text-sm text-white/55">
            Agriculture and fisherfolk cooperative landing portal.
          </p>
        </div>
        <p className="text-sm text-white/55">
          Copyright 2026. All rights reserved.
        </p>
      </div>
    </footer>
  );
}

function MiniPanel({
  icon: Icon,
  title,
  copy,
}: {
  icon: typeof Wheat;
  title: string;
  copy: string;
}) {
  return (
    <div className="rounded-[24px] border border-[#E5E7EB] bg-white p-6 shadow-sm">
      <div className="mb-7 grid size-12 place-items-center rounded-full bg-[#EAF3E8] text-[#1F6B43]">
        <Icon className="size-6" />
      </div>
      <h3 className="text-xl font-bold text-[#123D2A]">{title}</h3>
      <p className="mt-3 leading-7 text-[#6B7280]">{copy}</p>
    </div>
  );
}

function ContactRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof MapPin;
  label: string;
  value: string;
}) {
  return (
    <div className="flex gap-4 rounded-[20px] bg-white/8 p-4">
      <div className="grid size-11 shrink-0 place-items-center rounded-full bg-white text-[#123D2A]">
        <Icon className="size-5" />
      </div>
      <div>
        <p className="text-sm font-semibold text-white/55">{label}</p>
        <p className="mt-1 break-words font-semibold leading-6">{value}</p>
      </div>
    </div>
  );
}
