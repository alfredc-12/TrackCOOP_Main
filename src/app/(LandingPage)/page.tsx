"use client";

import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { MouseEvent, TouchEvent } from "react";
import { createPortal } from "react-dom";
import {
  ArrowRight,
  ChevronDown,
  FileCheck2,
  Maximize2,
  Menu,
  Store,
  Tractor,
  UserRoundPlus,
  UsersRound,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import StatsParallaxSection from "@/components/shared/StatsParallaxSection";
import AnnouncementsSection from "@/features/announcements/components/AnnouncementsSection";
import SiteHeader from "@/components/layout/SiteHeader";
import SiteFooter from "@/components/layout/SiteFooter";
import { RecentPhotosSection } from "@/features/landing-public/RecentPhotosSection";
import { AboutSection, ContactSection, ServicesSection } from "@/features/landing-public/LandingInfoSections";
import {
  mapPublishedCertifications,
  usePublishedLandingContent,
} from "@/features/landing-public/usePublishedLandingContent";

const cooperativeName =
  "Nasugbu Farmers and Fisherfolks Agriculture Cooperative";


const heroSlides = [
  {
    title: "Growing livelihoods.",
    headline: "Built for farmers and fisherfolks.",
    description:
      "Practical cooperative access for member assistance, farm and fishery programs, advisory updates, documents, and community contact.",
    image: "/images/Hero%20Page/Main%20Photo%201.jpg",
  },
  {
    title: "Shared production support.",
    headline: "Farm programs made visible.",
    description:
      "Follow cooperative projects, field coordination, shared services, and seasonal program priorities.",
    image: "/images/Hero%20Page/Main%20Photo%202.jpg",
  },
  {
    title: "Community-first service.",
    headline: "A clearer path for every member.",
    description:
      "Find services, documents, inquiries, and office contact details from one simple cooperative portal.",
    image: "/images/Hero%20Page/Main%20Photo%203.jpg",
  },
  {
    title: "Cooperative field activity.",
    headline: "Local agriculture in motion.",
    description:
      "Highlighting real cooperative activities, members, and agriculture support from the community.",
    image: "/images/Hero%20Page/Main%20Photo%204.jpg",
  },
];

const services = [
  {
    eyebrow: "Membership",
    title: "Membership Application",
    description: "Apply online and track your review status.",
    cta: "Become a Member",
    href: "/membership/apply",
    icon: UsersRound,
  },
  {
    eyebrow: "Rental",
    title: "Equipment Rental",
    description: "Request cooperative equipment for review.",
    cta: "View Rentals",
    href: "/rental",
    icon: Tractor,
  },
  {
    eyebrow: "Store",
    title: "Cooperative Store",
    description: "Order available supplies and products.",
    cta: "Open Store",
    href: "/store",
    icon: Store,
  },
];


const certifications = [
  {
    title: "Certificate of Compliance",
    tag: "Certificate of Compliance (CDA)",
    image: "/images/Other%20Landing%20Page/COC.jpg",
    aspectRatio: 381 / 524,
    maxWidth: 560,
  },
  {
    title: "BIR Certificate",
    tag: "Certificate of Registration (BIR)",
    image: "/images/Other%20Landing%20Page/BIR.jpg",
    aspectRatio: 480 / 640,
    maxWidth: 580,
  },
  {
    title: "Cooperative Good Standing",
    tag: "Certificate of Good Standing (CDA)",
    image: "/images/Other%20Landing%20Page/CGS.jpg",
    aspectRatio: 1600 / 1216,
    maxWidth: 1040,
  },
  {
    title: "Certification",
    tag: "Certificate of Registration (CDA)",
    image: "/images/Other%20Landing%20Page/Certification.jpg",
    aspectRatio: 269 / 400,
    maxWidth: 520,
  },
];

const fadeUp = {
  initial: { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: 0.65, ease: "easeOut" },
} as const;

export default function Home() {
  const published = usePublishedLandingContent();
  const publishedCertifications = mapPublishedCertifications(published.partners);

  return (
    <main className="public-landing min-h-screen overflow-hidden bg-[var(--public-canvas)] text-[#1E1E1E]">
      <SiteHeader initialActive="home" />
      <Hero />
      <ServicesSection items={services} />
      <AboutSection />
      <StatsParallaxSection stats={published.stats} />
      <RecentPhotosSection photos={published.landingPhotos} isLoading={published.isLoading} loadError={published.loadError} onRetry={published.retry} />
      <CertificationsSection slides={publishedCertifications.length ? publishedCertifications : certifications} />
      <ContactSection />
      <SiteFooter />
    </main>
  );
}

function Header() {
  const [activeNav, setActiveNav] = useState("home");

  useEffect(() => {
    const sectionIds = ["home", "services", "about", "projects", "certifications", "contact"];

    function updateActiveSection() {
      if (window.scrollY < 80) {
        setActiveNav(window.location.hash === "#announcements" ? "announcements" : "home");
        return;
      }

      let current = "home";
      sectionIds.forEach((id) => {
        const section = document.getElementById(id);
        if (section && section.getBoundingClientRect().top <= 140) {
          current = id;
        }
      });

      setActiveNav(current);
    }

    updateActiveSection();
    window.addEventListener("scroll", updateActiveSection, { passive: true });
    return () => window.removeEventListener("scroll", updateActiveSection);
  }, []);

  const navClass = (id: string) =>
    `inline-flex h-9 items-center border-b-2 px-1 transition ${
      activeNav === id
        ? "border-[#1F6B43] text-[#123D2A]"
        : "border-transparent text-[#365f4a] hover:border-[#1F6B43]/55 hover:text-[#123D2A]"
    }`;

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b-2 border-[#1F6B43]/55 bg-white/92 text-[#123D2A] shadow-sm backdrop-blur-xl">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-8">
        <Link href="#home" className="flex items-center gap-3" onClick={() => setActiveNav("home")}>
          <span className="relative block size-14 overflow-hidden rounded-md">
            <Image
              src="/trackcoop-logo.svg"
              alt="TrackCOOP logo"
              fill
              unoptimized
              sizes="56px"
              className="object-contain"
              priority
            />
          </span>
          <span className="hidden leading-tight sm:block">
            <span className="block text-lg font-bold tracking-[0.04em]">
              TrackCOOP
            </span>
            <span className="block text-[11px] italic text-[#4b6b5a]">
              Cooperative Management System
            </span>
          </span>
        </Link>

        <nav className="hidden items-center gap-2 text-sm font-semibold lg:flex">
          <a
            href="#home"
            className={navClass("home")}
            onClick={() => setActiveNav("home")}
          >
            Home
          </a>
          <HeaderDropdown
            label="About"
            href="#about"
            active={activeNav === "about"}
            onActivate={() => setActiveNav("about")}
            items={[
              { label: "Our Cooperative", href: "/about/our-cooperative" },
              {
                label: "Board of Directors",
                href: "/about/board-of-directors",
              },
            ]}
          />
          <HeaderDropdown
            label="Services"
            href="#services"
            active={activeNav === "services"}
            onActivate={() => setActiveNav("services")}
            items={[
              { label: "Become a Member", href: "/membership/apply" },
              { label: "Equipment Rental", href: "/rental" },
              { label: "Cooperative Store", href: "/store" },
            ]}
          />
          <a
            href="#announcements"
            className={navClass("announcements")}
            onClick={() => setActiveNav("announcements")}
          >
            Announcements
          </a>
          <a
            href="#projects"
            className={navClass("projects")}
            onClick={() => setActiveNav("projects")}
          >
            Gallery
          </a>
          <a
            href="#contact"
            className={navClass("contact")}
            onClick={() => setActiveNav("contact")}
          >
            Contact
          </a>
        </nav>

        <div className="flex items-center gap-3">
          <a
            href="tel:+630430000000"
            className="hidden rounded-full border border-[#DDE8D8] bg-[var(--public-canvas)] px-4 py-2 text-xs font-semibold text-[#365f4a] transition hover:bg-[#EAF3E8] hover:text-[#123D2A] xl:inline-flex"
          >
            Helpdesk: (043) 000-0000
          </a>
          <Link href="/login" className="hidden sm:inline-flex">
            <Button className="h-11 rounded-full border border-[#123D2A]/20 bg-[#123D2A] px-5 text-white hover:bg-[#1F6B43]">
              Portal
              <ArrowRight className="size-4" />
            </Button>
          </Link>
          <button
            aria-label="Open menu"
            className="grid size-11 place-items-center rounded-md border border-[#DDE8D8] bg-[var(--public-canvas)] text-[#123D2A] lg:hidden"
          >
            <Menu className="size-5" />
          </button>
        </div>
      </div>
    </header>
  );
}

function HeaderDropdown({
  label,
  href,
  active,
  onActivate,
  items,
}: {
  label: string;
  href: string;
  active: boolean;
  onActivate: () => void;
  items: { label: string; href: string; target?: string }[];
}) {
  return (
    <div className="group relative">
      <a
        href={href}
        onClick={onActivate}
        className={`inline-flex h-9 items-center gap-1.5 border-b-2 px-1 transition focus:outline-none ${
          active
            ? "border-[#1F6B43] text-[#123D2A]"
            : "border-transparent text-[#365f4a] hover:border-[#1F6B43]/55 hover:text-[#123D2A]"
        }`}
      >
        {label}
        <ChevronDown className="size-3.5 transition group-hover:rotate-180 group-focus-within:rotate-180" />
      </a>
      <div className="pointer-events-none absolute left-0 top-full z-50 w-60 pt-2 opacity-0 transition duration-200 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
        <div className="translate-y-2 rounded-xl border border-[#DDE8D8] bg-white p-2 shadow-2xl shadow-[#123D2A]/14 transition duration-200 group-hover:translate-y-0 group-focus-within:translate-y-0">
          {items.map((item) => (
            <a
              key={item.label}
              href={item.href}
              target={item.target}
              onClick={onActivate}
              className="block rounded-lg px-3 py-2.5 text-sm text-[#365f4a] transition hover:bg-[#EAF3E8] hover:text-[#123D2A] focus:bg-[#EAF3E8] focus:text-[#123D2A] focus:outline-none"
            >
              {item.label}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

function Hero() {
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCurrentSlide((index) => (index + 1) % heroSlides.length);
    }, 5200);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <section
      id="home"
      className="relative h-[100svh] min-h-0 overflow-hidden bg-[#0B2118] px-0 pb-0 pt-16 text-white"
    >
      <div className="absolute inset-0 bg-[linear-gradient(135deg,#071912_0%,#123D2A_44%,#1F6B43_100%)]" />
      <div className="absolute inset-x-0 top-0 h-44 bg-[linear-gradient(180deg,rgba(248,247,243,0.12),transparent)]" />

      <motion.div
        initial={{ opacity: 0, y: 26 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.75, ease: "easeOut" }}
        className="relative z-10 h-[calc(100svh-4rem)] min-h-0 w-full overflow-hidden"
      >
        {heroSlides.map((item, index) => (
          <Image
            key={item.image}
            src={item.image}
            alt={item.headline}
            fill
            priority={index === 0}
            unoptimized
            sizes="100vw"
            className={`object-cover transition duration-1000 ease-out ${
              index === currentSlide
                ? "scale-100 opacity-100"
                : "scale-105 opacity-0"
            }`}
          />
        ))}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(3,41,29,0.16)_0%,rgba(3,41,29,0.30)_48%,rgba(3,41,29,0.72)_100%)] md:bg-[linear-gradient(90deg,rgba(3,41,29,0.96)_0%,rgba(3,41,29,0.80)_34%,rgba(3,41,29,0.40)_54%,rgba(247,238,220,0.70)_78%,rgba(247,238,220,0.94)_100%)]" />
        <div className="absolute inset-x-0 bottom-0 h-3/5 bg-[linear-gradient(0deg,rgba(3,41,29,0.94)_0%,rgba(3,41,29,0.58)_48%,transparent_100%)]" />
        <div className="absolute inset-y-0 right-0 hidden w-1/2 bg-[linear-gradient(270deg,rgba(248,247,243,0.90)_0%,rgba(248,247,243,0.62)_38%,transparent_100%)] md:block" />
        <div className="absolute left-0 top-24 h-px w-2/5 bg-[linear-gradient(90deg,rgba(242,201,76,0.80),transparent)]" />

        <div className="relative z-10 grid h-full min-h-0 w-full grid-rows-[minmax(0,0.53fr)_minmax(300px,0.47fr)] gap-0 md:grid-cols-[minmax(0,1.08fr)_minmax(340px,0.92fr)] md:grid-rows-1 lg:grid-cols-[minmax(0,1.18fr)_minmax(460px,0.82fr)] xl:grid-cols-[minmax(0,1.26fr)_minmax(520px,0.74fr)]">
          <div className="relative flex min-h-0 flex-col justify-start px-6 pb-5 pt-20 sm:px-8 sm:pb-8 sm:pt-16 md:h-full md:justify-end md:pb-20 md:pt-10 lg:px-10 lg:pb-24 xl:px-14 xl:pb-28 [@media(max-height:560px)]:pb-4 [@media(max-height:560px)]:pt-14">
            <div className="absolute left-1/2 top-8 flex -translate-x-1/2 items-center gap-2 rounded-full bg-[var(--public-canvas)]/12 px-3 py-2 shadow-[0_12px_32px_rgba(0,0,0,0.14)] backdrop-blur-md sm:top-10 md:top-10 lg:top-8">
              {heroSlides.map((item, index) => (
                <button
                  key={item.title}
                  type="button"
                  aria-label={`Show ${item.title}`}
                  aria-current={currentSlide === index ? "true" : undefined}
                  onClick={() => setCurrentSlide(index)}
                  className={`h-2 rounded-full transition ${
                    currentSlide === index
                      ? "w-9 bg-[#F2C94C]"
                      : "w-2 bg-white/55 hover:bg-white"
                  }`}
                />
              ))}
            </div>

            <div className="max-w-5xl">
              <h1 className="max-w-4xl text-balance text-4xl font-black leading-[0.98] tracking-normal text-white drop-shadow-[0_18px_45px_rgba(0,0,0,0.45)] sm:max-w-3xl sm:text-5xl md:text-[3.35rem] lg:max-w-3xl lg:text-6xl xl:max-w-4xl xl:text-7xl 2xl:text-[5.3rem] [@media(max-height:620px)]:text-3xl [@media(max-height:430px)]:text-2xl">
                {cooperativeName}
              </h1>
              <div className="mt-4 max-w-2xl border-l border-[#F2C94C]/70 pl-4 sm:pl-5 lg:mt-4 xl:mt-5 [@media(max-height:620px)]:mt-3 [@media(max-height:430px)]:hidden">
                <p className="text-sm font-semibold leading-6 text-[var(--public-canvas)] sm:text-lg xl:text-xl">
                  {heroSlides[currentSlide].headline}
                </p>
                <p className="mt-2 line-clamp-3 max-w-xl text-sm leading-6 text-[#EAF3E8]/88 sm:text-base lg:text-sm xl:text-base [@media(max-height:620px)]:hidden">
                  {heroSlides[currentSlide].description}
                </p>
              </div>
              <div className="mt-5 flex flex-wrap gap-3 lg:mt-5 xl:mt-7 [@media(max-height:620px)]:mt-3 [@media(max-height:430px)]:mt-2">
                <Link
                  href="/membership/apply"
                  aria-label="Become a member"
                  className="public-action group inline-flex min-h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-[#F2C94C] text-[#123D2A] shadow-[0_16px_36px_rgba(0,0,0,0.22)] transition-all duration-500 ease-[cubic-bezier(0.19,1,0.22,1)] hover:w-[12.25rem] hover:-translate-y-0.5 hover:bg-[#FFDD75] focus-visible:w-[12.25rem] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F2C94C] sm:min-h-12 sm:w-12 sm:hover:w-[13rem] sm:focus-visible:w-[13rem] [@media(max-height:430px)]:min-h-10 [@media(max-height:430px)]:w-10"
                >
                  <UserRoundPlus className="size-5 shrink-0 transition-transform duration-500 group-hover:scale-95 group-focus-visible:scale-95" />
                  <span className="ml-0 max-w-0 translate-x-2 whitespace-nowrap text-xs font-bold opacity-0 transition-all duration-500 ease-[cubic-bezier(0.19,1,0.22,1)] group-hover:ml-2.5 group-hover:max-w-36 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:ml-2.5 group-focus-visible:max-w-36 group-focus-visible:translate-x-0 group-focus-visible:opacity-100 sm:text-sm">
                    Become a Member
                  </span>
                </Link>
                <Link
                  href="#services"
                  className="public-action inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-[var(--public-canvas)]/35 bg-[var(--public-canvas)]/10 px-5 text-xs font-bold text-white shadow-[0_16px_36px_rgba(0,0,0,0.16)] backdrop-blur-md transition hover:-translate-y-0.5 hover:bg-[var(--public-canvas)] hover:text-[#123D2A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:min-h-12 sm:px-6 sm:text-sm [@media(max-height:430px)]:min-h-10"
                >
                  Explore Services
                  <ArrowRight className="size-4" />
                </Link>
              </div>
            </div>
          </div>

          <aside
            id="announcements"
            className="relative z-30 mx-auto mb-5 h-[95%] w-[calc(100%-1rem)] min-h-0 self-center overflow-hidden rounded-[22px] bg-[var(--public-canvas)]/96 shadow-[0_34px_100px_rgba(18,61,42,0.28)] ring-1 ring-white/70 backdrop-blur-sm sm:mb-7 sm:w-[calc(100%-2rem)] md:mx-0 md:mb-0 md:ml-16 md:mr-2 md:w-auto md:h-[calc(95%_-_2rem)] md:max-h-[665px] md:rounded-[28px] lg:ml-[5.5rem] lg:mr-2 lg:h-[calc(95%_-_2.25rem)] lg:max-h-[694px] xl:ml-[6.5rem] xl:mr-2"
          >
            <AnnouncementsSection />
          </aside>
        </div>
      </motion.div>

      <HeroBottomDecor />
    </section>
  );
}

const heroFloatingSeeds = [
  { left: "9%", bottom: "6%", delay: 0.1, duration: 8 },
  { left: "18%", bottom: "12%", delay: 1.4, duration: 9 },
  { left: "34%", bottom: "8%", delay: 0.7, duration: 10 },
  { left: "57%", bottom: "14%", delay: 1.8, duration: 8.5 },
  { left: "76%", bottom: "7%", delay: 0.4, duration: 9.5 },
  { left: "88%", bottom: "11%", delay: 1.1, duration: 8.2 },
];

const heroSeedlings = [
  { left: "14%", bottom: "18%" },
  { left: "29%", bottom: "10%" },
  { left: "48%", bottom: "14%" },
  { left: "68%", bottom: "8%" },
  { left: "83%", bottom: "16%" },
];

function HeroSeedling({ left, bottom }: { left: string; bottom: string }) {
  return (
    <div
      className="absolute hidden h-7 w-6 sm:block"
      style={{ left, bottom }}
      aria-hidden="true"
    >
      <span className="absolute bottom-0 left-1/2 h-5 w-px -translate-x-1/2 bg-[#d9e89e]/60" />
      <span className="absolute bottom-3 left-1/2 h-3 w-4 origin-bottom-left -translate-x-0.5 rotate-[-32deg] rounded-full rounded-br-none bg-[#a8d66f]/70" />
      <span className="absolute bottom-3 right-1/2 h-3 w-4 origin-bottom-right translate-x-0.5 rotate-[32deg] rounded-full rounded-bl-none bg-[#c9e879]/70" />
    </div>
  );
}

function HeroBottomDecor() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 bottom-[-1px] z-20 h-[118px] overflow-hidden sm:h-[148px] lg:h-[168px]"
    >
      {/* Wave SVG lines */}
      <svg
        className="absolute inset-x-0 bottom-0 h-full w-full"
        viewBox="0 0 1440 160"
        preserveAspectRatio="none"
      >
        <motion.path
          d="M-60 120 C 210 60, 430 62, 660 100 S 1100 140, 1510 72"
          fill="none"
          stroke="rgba(201,232,121,0.22)"
          strokeWidth="3"
          strokeLinecap="round"
          animate={{
            d: [
              "M-60 120 C 210 60, 430 62, 660 100 S 1100 140, 1510 72",
              "M-60 92 C 210 142, 430 136, 660 104 S 1100 58, 1510 120",
              "M-60 120 C 210 60, 430 62, 660 100 S 1100 140, 1510 72",
            ],
          }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.path
          d="M-40 138 C 250 96, 470 98, 700 124 S 1090 154, 1480 108"
          fill="none"
          stroke="rgba(201,232,121,0.16)"
          strokeWidth="2"
          strokeLinecap="round"
          animate={{
            d: [
              "M-40 138 C 250 96, 470 98, 700 124 S 1090 154, 1480 108",
              "M-40 112 C 250 150, 470 146, 700 118 S 1090 82, 1480 136",
              "M-40 138 C 250 96, 470 98, 700 124 S 1090 154, 1480 108",
            ],
          }}
          transition={{ duration: 14, repeat: Infinity, ease: "easeInOut", delay: 1.1 }}
        />
        <path
          d="M0 110 C 230 64, 520 78, 760 112 S 1160 138, 1440 90"
          fill="none"
          stroke="rgba(248,247,243,0.12)"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <path
          d="M0 148 C 250 118, 520 128, 770 146 S 1190 162, 1440 130"
          fill="none"
          stroke="rgba(248,247,243,0.10)"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>

      {/* Seedlings */}
      {heroSeedlings.map((s) => (
        <HeroSeedling key={`${s.left}-${s.bottom}`} left={s.left} bottom={s.bottom} />
      ))}

      {/* Floating seed dots */}
      {heroFloatingSeeds.map((seed) => (
        <motion.span
          key={`${seed.left}-${seed.bottom}`}
          className="absolute size-1.5 rounded-full bg-[#F2C94C]/70 shadow-[0_0_14px_rgba(242,201,76,0.50)]"
          style={{ left: seed.left, bottom: seed.bottom }}
          animate={{ y: [0, -16, 0], x: [0, 7, 0], opacity: [0.3, 0.85, 0.3] }}
          transition={{
            duration: seed.duration,
            repeat: Infinity,
            ease: "easeInOut",
            delay: seed.delay,
          }}
        />
      ))}

      {/* Floating leaves */}
      <motion.span
        className="absolute left-[7%] bottom-[28%] h-4 w-7 rotate-[-18deg] rounded-full rounded-br-none bg-[#c9e879]/55"
        animate={{ x: [0, 18, 0], y: [0, -8, 0], rotate: [-18, -7, -18] }}
        transition={{ duration: 11, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.span
        className="absolute right-[12%] bottom-[22%] h-5 w-8 rotate-[21deg] rounded-full rounded-bl-none bg-[#a8d66f]/50"
        animate={{ x: [0, -16, 0], y: [0, -10, 0], rotate: [21, 10, 21] }}
        transition={{ duration: 13, repeat: Infinity, ease: "easeInOut", delay: 0.8 }}
      />
    </div>
  );
}
function CertificationsSection({ slides }: { slides: CertificationSlide[] }) {
  return (
    <section id="certifications" className="relative overflow-hidden bg-white py-12 lg:py-16">
      <div className="relative z-10 px-5 sm:px-8">
        <motion.div {...fadeUp} className="mx-auto max-w-7xl">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.35em] text-[#9A6400]">
            Documents
          </p>
          <h2 className="max-w-4xl text-4xl font-black leading-[1.02] tracking-normal text-[#073f2b] md:text-6xl lg:text-7xl">
            Proofs members can trust.
          </h2>
        </motion.div>
      </div>

      <CertificationCarousel slides={slides} />
    </section>
  );
}

type CertificationSlide = {
  title: string;
  tag: string;
  image: string;
  fileType?: "image" | "pdf";
  aspectRatio: number;
  maxWidth: number;
};

function CertificationMedia({ slide, className = "" }: { slide: CertificationSlide; className?: string }) {
  if (slide.fileType === "pdf") {
    return (
      <div className={`grid h-full w-full place-items-center bg-[#123D2A] text-white ${className}`}>
        <div className="grid max-w-xs justify-items-center gap-5 px-8 text-center">
          <span className="grid size-24 place-items-center rounded-3xl bg-white/12 text-[#F2C94C]">
            <FileCheck2 className="size-12" aria-hidden="true" />
          </span>
          <div>
            <p className="text-2xl font-black leading-tight">{slide.title}</p>
            <p className="mt-3 rounded-full border border-white/20 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-white/72">
              PDF Document
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element -- Certification media can be a deployment-hosted upload. */}
      <img
        src={slide.image}
        alt={slide.title}
        className={`absolute inset-0 h-full w-full bg-white object-contain ${className}`}
      />
    </>
  );
}

function CertificationModalMedia({ slide }: { slide: CertificationSlide }) {
  const motionProps = {
    initial: { opacity: 0, y: 18, scale: 0.94 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: 10, scale: 0.96 },
    transition: { duration: 0.26, ease: "easeOut" as const },
    onClick: (event: MouseEvent) => event.stopPropagation(),
  };

  if (slide.fileType === "pdf") {
    return (
      <motion.div
        className="relative h-[calc(100dvh-6.5rem)] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-lg sm:h-[calc(100dvh-7.5rem)] sm:max-w-[calc(100vw-3rem)]"
        style={{
          aspectRatio: slide.aspectRatio,
          width: `min(calc((100dvh - 7.5rem) * ${slide.aspectRatio}), calc(100vw - 1.5rem))`,
        }}
        {...motionProps}
      >
        <CertificationMedia slide={slide} className="drop-shadow-2xl" />
      </motion.div>
    );
  }

  return (
    <motion.img
      src={slide.image}
      alt={slide.title}
      className="block h-[calc(100dvh-6.5rem)] w-auto max-w-[calc(100vw-1.5rem)] object-contain drop-shadow-2xl sm:h-[calc(100dvh-7.5rem)] sm:max-w-[calc(100vw-3rem)]"
      {...motionProps}
    />
  );
}

function CertificationCarousel({ slides }: { slides: CertificationSlide[] }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [openCertificate, setOpenCertificate] =
    useState<CertificationSlide | null>(null);
  const touchStartX = useRef<number | null>(null);

  const nextSlide = useCallback(() => {
    setCurrentIndex((index) => (index + 1) % slides.length);
  }, [slides.length]);

  const prevSlide = useCallback(() => {
    setCurrentIndex((index) => (index - 1 + slides.length) % slides.length);
  }, [slides.length]);

  const goToSlide = useCallback((index: number) => {
    setCurrentIndex(index);
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpenCertificate(null);
      if (event.key === "ArrowRight") nextSlide();
      if (event.key === "ArrowLeft") prevSlide();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [nextSlide, prevSlide]);

  useEffect(() => {
    if (!openCertificate) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [openCertificate]);

  function getSlidePosition(index: number) {
    const total = slides.length;
    const previous = (currentIndex - 1 + total) % total;
    const next = (currentIndex + 1) % total;

    if (index === currentIndex) return "active";
    if (index === previous) return "previous";
    if (index === next) return "next";
    return "hidden";
  }

  function getSlideStyle(position: string) {
    const styles = {
      active: {
        transform: "translateX(0) scale(1) rotateY(0deg)",
        opacity: 1,
        zIndex: 30,
      },
      previous: {
        transform: "translateX(-70%) scale(0.85) rotateY(35deg)",
        opacity: 0.75,
        zIndex: 20,
      },
      next: {
        transform: "translateX(70%) scale(0.85) rotateY(-35deg)",
        opacity: 0.75,
        zIndex: 20,
      },
      hidden: {
        transform: "translateX(0) scale(0.68) rotateY(0deg)",
        opacity: 0,
        zIndex: 0,
      },
    };

    return styles[position as keyof typeof styles];
  }

  function handleTouchStart(event: TouchEvent<HTMLDivElement>) {
    touchStartX.current = event.touches[0].clientX;
  }

  function handleTouchEnd(event: TouchEvent<HTMLDivElement>) {
    if (touchStartX.current === null) return;
    const distance = event.changedTouches[0].clientX - touchStartX.current;

    if (distance > 48) prevSlide();
    if (distance < -48) nextSlide();

    touchStartX.current = null;
  }

  return (
    <>
      <div
        className="relative left-1/2 mt-8 w-screen -translate-x-1/2 overflow-x-clip overflow-y-visible px-4 py-6 pb-10 sm:px-8 sm:pb-12"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div className="relative h-[640px] perspective-[1200px] sm:h-[820px] lg:h-[860px]">
        {slides.map((slide, index) => {
          const position = getSlidePosition(index);
          const isActive = position === "active";
          const slideWidth = `min(86vw, ${slide.maxWidth}px)`;

          return (
            <button
              type="button"
              key={slide.title}
              aria-label={`Preview ${slide.title}`}
              tabIndex={isActive ? 0 : -1}
              aria-hidden={!isActive}
              onClick={() => setOpenCertificate(slide)}
              className="public-certificate absolute inset-x-0 top-0 mx-auto cursor-zoom-in overflow-hidden rounded-[22px] border border-[#DDE8D8] bg-white text-left shadow-2xl shadow-[#123D2A]/12 transition-[transform,opacity] duration-700 ease-out focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1F6B43]"
              style={{
                ...getSlideStyle(position),
                transformOrigin: "center center",
                width: slideWidth,
                aspectRatio: slide.aspectRatio,
              }}
            >
              <CertificationMedia slide={slide} />
              <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-4 bg-gradient-to-b from-[#03291d]/55 to-transparent p-4 text-white">
                <span className="inline-flex max-w-[calc(100%-2rem)] items-center gap-2 truncate rounded-full bg-white/18 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.08em] shadow-sm ring-1 ring-white/20 backdrop-blur-md sm:text-xs">
                  <FileCheck2 className="size-3.5" />
                  <span className="truncate">{slide.tag}</span>
                </span>
                <span aria-hidden="true" className="public-preview-indicator grid size-10 shrink-0 place-items-center rounded-full bg-[#123D2A] text-white shadow-lg"><Maximize2 className="size-5" /></span>
              </div>
            </button>
          );
        })}

        <button
          type="button"
          aria-label="Previous certification slide"
          onClick={prevSlide}
          className="absolute left-3 top-1/2 z-40 -translate-y-1/2 rounded-full border border-white/45 bg-[#123D2A]/70 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-white backdrop-blur-md transition hover:bg-[#1F6B43] sm:left-8"
        >
          Prev
        </button>
        <button
          type="button"
          aria-label="Next certification slide"
          onClick={nextSlide}
          className="absolute right-3 top-1/2 z-40 -translate-y-1/2 rounded-full border border-white/45 bg-[#123D2A]/70 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-white backdrop-blur-md transition hover:bg-[#1F6B43] sm:right-8"
        >
          Next
        </button>
      </div>

      <div className="mt-5 flex items-center justify-center gap-2">
        {slides.map((slide, index) => (
          <button
            key={slide.title}
            type="button"
            aria-label={`Go to ${slide.title}`}
            aria-current={currentIndex === index ? "true" : undefined}
            onClick={() => goToSlide(index)}
            className={`size-2.5 rounded-full transition ${
              currentIndex === index ? "w-8 bg-[#123D2A]" : "bg-[#C9D8C8]"
            }`}
          />
        ))}
      </div>

      </div>

      {typeof document !== "undefined"
        ? createPortal(
            <AnimatePresence>
              {openCertificate ? (
                <motion.div
                  key="certificate-preview"
                  role="dialog"
                  aria-modal="true"
                  aria-label={openCertificate.title}
                  className="fixed inset-0 z-[9999] grid h-[100dvh] w-screen place-items-center overflow-hidden bg-black/45 p-3 backdrop-blur-2xl sm:p-6"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.22, ease: "easeOut" }}
                  onClick={() => setOpenCertificate(null)}
                >
                  <motion.button
                    type="button"
                    aria-label="Close certificate preview"
                    onClick={(event) => {
                      event.stopPropagation();
                      setOpenCertificate(null);
                    }}
                    className="absolute right-4 top-4 z-10 grid size-11 place-items-center rounded-full border border-white/20 bg-white/12 text-white backdrop-blur transition hover:bg-white hover:text-[#123D2A]"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.18, ease: "easeOut" }}
                  >
                    <X className="size-5" />
                  </motion.button>
                  <motion.div
                    className="absolute left-1/2 top-4 z-10 flex max-w-[calc(100vw-7rem)] -translate-x-1/2 items-center gap-2 truncate rounded-full border border-white/18 bg-white/18 px-4 py-2 text-center text-[10px] font-bold uppercase tracking-[0.08em] text-white shadow-sm backdrop-blur-xl sm:top-6 sm:text-xs"
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.18, ease: "easeOut" }}
                  >
                    <FileCheck2 className="size-3.5 shrink-0" />
                    <span className="truncate">{openCertificate.tag}</span>
                  </motion.div>
                  <CertificationModalMedia slide={openCertificate} />
                </motion.div>
              ) : null}
            </AnimatePresence>,
            document.body,
          )
        : null}
    </>
  );
}


function Footer() {
  return (
    <footer className="border-t border-[#1F6B43]/20 bg-[#123D2A] px-5 py-10 text-white sm:px-8">
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
