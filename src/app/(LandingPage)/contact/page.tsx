import type { Metadata } from "next";
import Link from "next/link";
import {
  Clock,
  Globe,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Share2,
  ArrowUpRight,
} from "lucide-react";
import SiteFooter from "@/components/layout/SiteFooter";
import SiteHeader from "@/components/layout/SiteHeader";
import { ContactForm } from "./ContactForm";

export const metadata: Metadata = {
  title: "Contact | TrackCOOP",
  description:
    "Contact information, map location, phone numbers, and social channels for TrackCOOP.",
};

const cooperativeName =
  "Nasugbu Farmers and Fisherfolks Agriculture Cooperative";

const contactCards = [
  {
    label: "Office Number",
    value: "(043) 000-0000",
    href: "tel:+630430000000",
    icon: Phone,
  },
  {
    label: "Mobile Number",
    value: "+63 900 000 0000",
    href: "tel:+639000000000",
    icon: Phone,
  },
  {
    label: "Email",
    value: "nasugbu.agri.coop@example.com",
    href: "mailto:nasugbu.agri.coop@example.com",
    icon: Mail,
  },
  {
    label: "Office Hours",
    value: "Monday to Friday, 8:00 AM - 5:00 PM",
    href: "#",
    icon: Clock,
  },
];

const socialLinks = [
  {
    label: "Facebook Page",
    value: "facebook.com/trackcoop",
    href: "#",
    icon: Share2,
  },
  {
    label: "Messenger",
    value: "m.me/trackcoop",
    href: "#",
    icon: MessageCircle,
  },
  {
    label: "Website",
    value: "trackcoop.local",
    href: "#",
    icon: Globe,
  },
];

export default function ContactPage() {
  const mapSrc =
    "https://maps.google.com/maps?q=14.058886759350967,120.63832068540415&z=16&output=embed";

  return (
    <main className="min-h-screen bg-[var(--public-canvas)] text-coop-forest">
      <SiteHeader initialActive="contact" />

      <section className="px-5 pb-6 pt-24 sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-wrap items-end justify-between gap-5">
          <div className="max-w-2xl">
          <h1 className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
            Contact Us
          </h1>
          <p className="mt-2 text-base leading-7 text-coop-secondary">
            For member assistance, cooperative services, farm and fishery
            coordination, or public inquiries, use the contact channels below.
          </p>
          </div>
          <Link href="/track" className="inline-flex min-h-11 items-center gap-2 rounded-md bg-white px-4 text-sm font-semibold shadow-sm ring-1 ring-[#DDE8D8] transition hover:bg-[#EAF1E5] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-coop-green motion-reduce:transition-none">Track an inquiry<ArrowUpRight aria-hidden="true" className="size-4" /></Link>
        </div>
      </section>

      <section aria-label="Contact the cooperative" className="px-5 pb-10 sm:px-8">
        <div className="mx-auto grid max-w-7xl items-start gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-stretch">
          <section className="flex min-w-0 flex-col rounded-xl border border-[#DDE8D8] bg-white p-5 shadow-sm sm:p-7">
            <div className="mb-6">
              <h2 className="text-2xl font-bold leading-tight text-coop-forest">
                Submit an Inquiry
              </h2>
              <p className="mt-2 text-base leading-7 text-coop-secondary">
                Have a question? Send us a direct message and our admin team will review it.
              </p>
            </div>
            <ContactForm />
          </section>

          <div className="grid min-w-0 gap-5 lg:grid-rows-[auto_1fr]">
          <section className="rounded-xl border border-[#DDE8D8] bg-[#EAF1E5] p-5 shadow-sm sm:p-6">
            <h2 className="text-xl font-bold">
              Cooperative Office
            </h2>
            <p className="mt-2 text-base font-semibold leading-7">
              {cooperativeName}
            </p>

            <div className="mt-5 grid gap-4">
              <ContactInfo
                icon={MapPin}
                label="Map Coordinates"
                value="14.058886759350967, 120.63832068540415"
              />
              {contactCards.map((item) => (
                <ContactInfo
                  key={item.label}
                  icon={item.icon}
                  label={item.label}
                  value={item.value}
                  href={item.href}
                />
              ))}
            </div>
          </section>

          <section aria-label="Office location" className="flex flex-col overflow-hidden rounded-xl border border-[#DDE8D8] bg-white shadow-sm">
            <iframe
              title="Nasugbu Farmers and Fisherfolks Agriculture Cooperative location"
              src={mapSrc}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="h-64 w-full lg:min-h-64 lg:flex-1"
            />
            <a href="https://maps.google.com/?q=14.058886759350967,120.63832068540415" target="_blank" rel="noreferrer" className="flex min-h-12 items-center justify-between gap-3 px-5 text-sm font-semibold text-coop-green hover:bg-[#EDF3E9] focus-visible:outline-2 focus-visible:outline-coop-green">Open in Google Maps<ArrowUpRight aria-hidden="true" className="size-4" /></a>
          </section>
          </div>
        </div>
      </section>

      <section className="px-5 pb-10 sm:px-8">
        <div className="mx-auto max-w-7xl">
          <section className="rounded-xl border border-[#DDE8D8] bg-white p-5 shadow-sm sm:p-7">
            <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
              <div>
                <h2 className="text-2xl font-bold leading-tight text-coop-forest">
                  Online channels.
                </h2>
              </div>
              <p className="max-w-md text-sm leading-6 text-coop-secondary">
                Placeholder links for now. These can be replaced with official
                cooperative accounts when ready.
              </p>
            </div>

            <div className="mt-7 grid gap-4 md:grid-cols-3">
              {socialLinks.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  className="group flex min-w-0 items-center gap-3 rounded-lg bg-[var(--public-canvas)] p-4 transition hover:bg-[#EAF1E5] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coop-green motion-reduce:transition-none"
                >
                  <span className="text-coop-green">
                    <item.icon aria-hidden="true" className="size-5" />
                  </span>
                  <span className="min-w-0">
                  <span className="block text-base font-semibold text-coop-forest">
                    {item.label}
                  </span>
                  <span className="mt-1 block break-words text-sm text-coop-secondary">
                    {item.value}
                  </span>
                  </span>
                </a>
              ))}
            </div>
          </section>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}

function ContactInfo({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: typeof MapPin;
  label: string;
  value: string;
  href?: string;
}) {
  const content = (
    <>
      <div className="shrink-0 pt-1 text-coop-green">
        <Icon aria-hidden="true" className="size-4" />
      </div>
      <div className="min-w-0">
        <p className="text-sm text-coop-secondary">{label}</p>
        <p className="mt-0.5 break-words text-base font-medium leading-6 text-coop-forest">
          {value}
        </p>
      </div>
    </>
  );

  if (href && href !== "#") {
    return (
      <a
        href={href}
        className="-mx-2 flex min-w-0 gap-3 rounded-md px-2 py-1 transition hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coop-green motion-reduce:transition-none"
      >
        {content}
      </a>
    );
  }

  return <div className="flex min-w-0 gap-3 py-1">{content}</div>;
}
