"use client";

import { ArrowRight, ChevronDown, Menu } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";

type SiteHeaderProps = {
  initialActive?: string;
  enableScrollSpy?: boolean;
};

const sectionIds = ["home", "services", "about", "projects", "certifications", "contact"];

export default function SiteHeader({
  initialActive = "home",
  enableScrollSpy = false,
}: SiteHeaderProps) {
  const [activeNav, setActiveNav] = useState(initialActive);

  useEffect(() => {
    if (!enableScrollSpy) return;

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
  }, [enableScrollSpy, initialActive]);

  const activateNav = (id: string) => {
    if (enableScrollSpy) setActiveNav(id);
  };

  const currentNav = enableScrollSpy ? activeNav : initialActive;

  const navClass = (id: string) =>
    `inline-flex h-8 items-center border-b-2 px-1 transition ${
      currentNav === id
        ? "border-[#1F6B43] text-[#123D2A]"
        : "border-transparent text-[#365f4a] hover:border-[#1F6B43]/55 hover:text-[#123D2A]"
    }`;

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b-2 border-[#1F6B43]/55 bg-white/92 text-[#123D2A] shadow-sm backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
        <Link
          href="/#home"
          className="flex items-center gap-3"
          onClick={() => activateNav("home")}
        >
          <span className="relative block size-10 overflow-hidden rounded-md">
            <Image
              src="/trackcoop-logo.svg"
              alt="TrackCOOP logo"
              fill
              unoptimized
              sizes="40px"
              className="object-contain"
              priority
            />
          </span>
          <span className="hidden leading-tight sm:block">
            <span className="block text-base font-bold tracking-[0.04em]">
              TrackCOOP
            </span>
            <span className="block text-[10px] italic text-[#4b6b5a]">
              Cooperative Management System
            </span>
          </span>
        </Link>

        <nav className="hidden items-center gap-2 text-sm font-semibold lg:flex">
          <Link href="/#home" className={navClass("home")} onClick={() => activateNav("home")}>
            Home
          </Link>
          <HeaderDropdown
            label="About"
            href="/#about"
            active={currentNav === "about"}
            onActivate={() => activateNav("about")}
            items={[
              { label: "Our Cooperative", href: "/about/our-cooperative" },
              { label: "Board of Directors", href: "/about/board-of-directors" },
            ]}
          />
          <HeaderDropdown
            label="Services"
            href="/#services"
            active={currentNav === "services"}
            onActivate={() => activateNav("services")}
            items={[
              { label: "Membership Assistance", href: "/#services" },
              { label: "Equipment Rental", href: "/rental" },
              { label: "Cooperative Store", href: "/store" },
            ]}
          />
          <Link
            href="/announcements"
            className={navClass("announcements")}
            onClick={() => activateNav("announcements")}
          >
            Announcements
          </Link>
          <Link
            href="/gallery"
            className={navClass("gallery")}
            onClick={() => activateNav("gallery")}
          >
            Gallery
          </Link>
          <Link
            href="/contact"
            className={navClass("contact")}
            onClick={() => activateNav("contact")}
          >
            Contact
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          <a
            href="tel:+630430000000"
            className="hidden rounded-full border border-[#DDE8D8] bg-[#F8F1E5] px-4 py-2 text-xs font-semibold text-[#365f4a] transition hover:bg-[#EAF3E8] hover:text-[#123D2A] xl:inline-flex"
          >
            Helpdesk: (043) 000-0000
          </a>
          <Link href="/login" className="hidden sm:inline-flex">
            <Button className="h-10 rounded-full border border-[#123D2A]/20 bg-[#123D2A] px-5 text-white hover:bg-[#1F6B43]">
              Portal
              <ArrowRight className="size-4" />
            </Button>
          </Link>
          <button
            aria-label="Open menu"
            className="grid size-10 place-items-center rounded-md border border-[#DDE8D8] bg-[#F8F1E5] text-[#123D2A] lg:hidden"
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
      <Link
        href={href}
        onClick={onActivate}
        className={`inline-flex h-8 items-center gap-1.5 border-b-2 px-1 transition focus:outline-none ${
          active
            ? "border-[#1F6B43] text-[#123D2A]"
            : "border-transparent text-[#365f4a] hover:border-[#1F6B43]/55 hover:text-[#123D2A]"
        }`}
      >
        {label}
        <ChevronDown className="size-3.5 transition group-hover:rotate-180 group-focus-within:rotate-180" />
      </Link>
      <div className="pointer-events-none absolute left-0 top-full z-50 w-60 pt-2 opacity-0 transition duration-200 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
        <div className="translate-y-2 rounded-xl border border-[#DDE8D8] bg-white p-2 shadow-2xl shadow-[#123D2A]/14 transition duration-200 group-hover:translate-y-0 group-focus-within:translate-y-0">
          {items.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              target={item.target}
              onClick={onActivate}
              className="block rounded-lg px-3 py-2.5 text-sm text-[#365f4a] transition hover:bg-[#EAF3E8] hover:text-[#123D2A] focus:bg-[#EAF3E8] focus:text-[#123D2A] focus:outline-none"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
