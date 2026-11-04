"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight, ArrowUpRight, Mail, MapPin, Phone, Waves, Wheat } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import FieldDivider from "@/components/shared/FieldDivider";

const cooperativeName = "Nasugbu Farmers and Fisherfolks Agriculture Cooperative";
const mapUrl = "https://maps.google.com/maps?q=14.058886759350967,120.63832068540415&z=16";

type Service = {
  title: string;
  description: string;
  cta: string;
  href: string;
  icon: LucideIcon;
};

function useSectionReveal() {
  const reducedMotion = useReducedMotion();
  return {
    initial: { opacity: 0 },
    whileInView: { opacity: 1 },
    viewport: { once: true, amount: 0.15 },
    transition: { duration: reducedMotion ? 0 : 0.4, ease: "easeOut" as const },
  };
}

export function ServicesSection({ items }: { items: Service[] }) {
  const reveal = useSectionReveal();
  return (
    <section id="services" aria-labelledby="services-heading" className="relative isolate scroll-mt-20 overflow-hidden bg-[var(--public-canvas)] px-5 pb-16 pt-40 sm:px-8 lg:pb-20 lg:pt-48">
      <FieldDivider />
      <div className="relative mx-auto max-w-7xl">
        <motion.div {...reveal} className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,.6fr)] lg:items-end lg:gap-16">
          <div>
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.35em] text-[#9A6400]">Services</p>
            <h2 id="services-heading" className="max-w-3xl text-[28px] font-black leading-[1.08] text-[#073f2b] sm:text-5xl lg:text-6xl">Cooperative services, ready to use.</h2>
          </div>
          <p className="max-w-sm text-base leading-7 text-[#365F4A] lg:pb-1">Apply, rent, or order from one public service area.</p>
        </motion.div>

        <div className="mt-8 grid gap-5 sm:mt-10 md:grid-cols-3">
          {items.map((service) => <ServiceRow key={service.href} service={service} />)}
        </div>

        <motion.div {...reveal} className="mt-6 flex flex-col gap-5 rounded-lg border border-[#CAD8CB] bg-[#EAF3E8] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <h3 className="text-lg font-bold leading-7 text-[#123D2A]">Already applied? Check your status.</h3>
          <div className="grid grid-cols-2 items-center gap-3 sm:flex sm:shrink-0">
            <Link href="/membership/apply" className="public-action inline-flex min-h-11 items-center justify-center rounded-md bg-white px-4 text-sm font-semibold text-[#123D2A] transition-colors hover:bg-[#DFE8D8] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1F6B43]">Become a Member</Link>
            <Link href="/membership/application-status" className="public-action inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[#123D2A] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#1F6B43] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1F6B43]">Check Status<ArrowRight aria-hidden="true" className="size-4" /></Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function ServiceRow({ service }: { service: Service }) {
  const reveal = useSectionReveal();
  const Icon = service.icon;
  return (
    <motion.article {...reveal} className="public-card public-card-link h-full">
      <Link href={service.href} aria-label={service.cta} className="group flex h-full min-h-[290px] flex-col items-start rounded-lg p-6 text-[#123D2A] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1F6B43] sm:p-7">
        <span className="public-service-icon grid size-12 shrink-0 place-items-center rounded-full bg-[#EAF3E8] text-[#1F6B43]"><Icon aria-hidden="true" className="size-6" /></span>
        <div className="mb-6 mt-5 min-w-0">
          <h3 className="text-xl font-bold leading-tight sm:text-2xl">{service.title}</h3>
          <p className="mt-2 text-base leading-7 text-[#365F4A]">{service.description}</p>
        </div>
        <span className="mt-auto inline-flex min-h-11 w-full items-center justify-between gap-3 rounded-md bg-[#123D2A] px-4 py-3 text-sm font-bold text-white transition-colors group-hover:bg-[#1F6B43]">{service.cta}<ArrowRight aria-hidden="true" className="size-4 shrink-0 transition-transform group-hover:translate-x-1 motion-reduce:transition-none" /></span>
      </Link>
    </motion.article>
  );
}

export function AboutSection() {
  const reveal = useSectionReveal();
  return (
    <section id="about" aria-labelledby="about-heading" className="scroll-mt-24 bg-white px-5 py-16 sm:px-8 lg:py-20">
      <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-2 lg:gap-16">
        <motion.figure {...reveal} className="public-card min-w-0 p-2.5">
          <div className="public-media overflow-hidden rounded-lg">
          <Image src="/images/Other%20Landing%20Page/About.jpg" alt="Nasugbu Farmers and Fisherfolks Agriculture Cooperative group photo" width={2048} height={2730} sizes="(max-width: 1023px) 100vw, 50vw" className="aspect-[4/3] w-full rounded-lg object-cover object-[center_42%] lg:aspect-square" />
          </div>
          <figcaption className="px-3 pb-3 pt-4 text-sm leading-6 text-[#365F4A]">{cooperativeName}</figcaption>
        </motion.figure>

        <motion.div {...reveal} className="min-w-0">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.35em] text-[#9A6400]">About</p>
          <h2 id="about-heading" className="text-3xl font-black leading-[1.1] text-[#073f2b] sm:text-5xl lg:text-6xl">Rooted in Nasugbu agriculture.</h2>
          <p className="mt-6 text-base leading-8 text-[#365F4A]">{cooperativeName} supports local producers through cooperative services, farm coordination, fishery livelihood tracking, and accessible community information.</p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <SupportDetail icon={Wheat} title="Farm Programs" copy="Crop support, production activities, and seasonal coordination." />
            <SupportDetail icon={Waves} title="Fishery Support" copy="Livelihood visibility for coastal and aquaculture members." />
          </div>
          <Link href="/about/our-cooperative" className="public-action mt-8 inline-flex min-h-11 items-center gap-3 rounded-md text-sm font-bold text-[#123D2A] transition-colors hover:text-[#1F6B43] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1F6B43]">About our cooperative<ArrowRight aria-hidden="true" className="size-4" /></Link>
        </motion.div>
      </div>
    </section>
  );
}

function SupportDetail({ icon: Icon, title, copy }: { icon: LucideIcon; title: string; copy: string }) {
  return (
    <div className="public-card flex items-start gap-3 p-5">
      <Icon aria-hidden="true" className="mt-1 size-6 shrink-0 text-[#1F6B43]" />
      <div className="min-w-0"><h3 className="text-lg font-bold text-[#123D2A]">{title}</h3><p className="mt-1 text-base leading-7 text-[#365F4A]">{copy}</p></div>
    </div>
  );
}

export function ContactSection() {
  const reveal = useSectionReveal();
  return (
    <section id="contact" aria-labelledby="contact-heading" className="scroll-mt-24 bg-[var(--public-canvas)] px-5 py-16 sm:px-8 lg:py-20">
      <div className="mx-auto max-w-7xl">
        <motion.div {...reveal}>
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.35em] text-[#9A6400]">Contact</p>
          <h2 id="contact-heading" className="text-3xl font-black leading-[1.1] text-[#073f2b] sm:text-5xl lg:text-6xl">Find us in Nasugbu.</h2>
        </motion.div>
        <div className="mt-8 grid items-stretch gap-6 lg:mt-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,.9fr)] lg:gap-8">
          <motion.div {...reveal} className="public-card grid min-w-0 grid-rows-[1fr_auto] overflow-hidden">
            <iframe title="Nasugbu Farmers and Fisherfolks Agriculture Cooperative location" src={`${mapUrl}&output=embed`} loading="lazy" referrerPolicy="no-referrer-when-downgrade" className="h-[300px] w-full sm:h-[360px] lg:h-full lg:min-h-[380px]" />
            <a href={mapUrl} target="_blank" rel="noopener noreferrer" className="public-action flex min-h-14 items-center justify-between gap-3 px-5 py-4 text-sm font-semibold text-[#123D2A] transition-colors hover:bg-[#EAF3E8] focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-[#1F6B43]">Open in Google Maps<ArrowUpRight aria-hidden="true" className="size-4 shrink-0" /></a>
          </motion.div>

          <motion.div {...reveal} className="public-card min-w-0 p-6 sm:p-8">
            <h3 className="max-w-xl text-xl font-bold leading-7 text-[#123D2A]">{cooperativeName}</h3>
            <p className="mt-3 text-base leading-7 text-[#365F4A]">We are here for farm, fishery, and member service concerns.</p>
            <address className="mt-5 grid gap-1 not-italic">
              <ContactDetail icon={MapPin} label="Map Coordinates" value="14.058886759350967, 120.63832068540415" href={mapUrl} external />
              <ContactDetail icon={Phone} label="Phone" value="(043) 000-0000" href="tel:+63430000000" />
              <ContactDetail icon={Mail} label="Email" value="nasugbu.agri.coop@example.com" href="mailto:nasugbu.agri.coop@example.com" />
            </address>
            <Link href="/contact" className="public-action mt-6 inline-flex min-h-11 items-center justify-center gap-3 rounded-md bg-[#123D2A] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#1F6B43] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1F6B43]">Send an inquiry<ArrowRight aria-hidden="true" className="size-4" /></Link>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function ContactDetail({ icon: Icon, label, value, href, external = false }: { icon: LucideIcon; label: string; value: string; href: string; external?: boolean }) {
  return (
    <a href={href} target={external ? "_blank" : undefined} rel={external ? "noopener noreferrer" : undefined} className="public-action group -mx-3 flex min-h-16 items-start gap-4 rounded-md px-3 py-3 text-[#123D2A] transition-colors hover:bg-[#EAF3E8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1F6B43]">
      <Icon aria-hidden="true" className="mt-1 size-5 shrink-0 text-[#1F6B43]" />
      <span className="min-w-0"><span className="block text-sm leading-6 text-[#365F4A]">{label}</span><span className="mt-0.5 block break-words text-sm font-semibold leading-6 [overflow-wrap:anywhere] sm:text-base">{value}</span></span>
    </a>
  );
}
