import type { Metadata } from "next";
import Image from "next/image";
import {
  Clock,
  Globe,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Share2,
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
    <main className="min-h-screen bg-white text-[#123D2A]">
      <SiteHeader initialActive="contact" />

      <section className="relative min-h-[24rem] overflow-hidden bg-[#123D2A] px-5 pb-10 pt-24 text-white sm:px-8 lg:min-h-[26rem] lg:pb-12 lg:pt-28">
        <Image
          src="/images/Other%20Landing%20Page/About.jpg"
          alt="Cooperative members and office activity"
          fill
          priority
          unoptimized
          sizes="100vw"
          className="object-cover object-center opacity-45"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#052F22]/95 via-[#052F22]/82 to-[#052F22]/45" />
        <div className="relative z-10 mx-auto max-w-7xl">
          <p className="mb-6 text-xs font-black uppercase tracking-[0.48em] text-[#F2C94C]">
            Contact
          </p>
          <h1 className="max-w-6xl text-5xl font-black leading-[0.95] tracking-normal md:text-7xl lg:text-8xl">
            Contact Us
          </h1>
          <p className="mt-7 max-w-3xl text-lg leading-8 text-white/88 md:text-xl md:leading-9">
            For member assistance, cooperative services, farm and fishery
            coordination, or public inquiries, use the contact channels below.
          </p>
        </div>
      </section>

      <section className="border-y border-[#E0EADC] bg-[#F8F1E5] px-5 py-12 sm:px-8 lg:py-16">
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-[16px] border border-[#DDE8D8] bg-white p-6 shadow-[0_18px_52px_rgba(18,61,42,0.08)] sm:p-8">
            <div className="mb-8">
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.45em] text-[#f4b62a]">
                Send a Message
              </p>
              <h2 className="text-2xl font-black leading-tight tracking-normal text-[#073f2b] md:text-3xl">
                Submit an Inquiry
              </h2>
              <p className="mt-2 text-sm text-[#5d6b63]">
                Have a question? Send us a direct message and our admin team will review it.
              </p>
            </div>
            <ContactForm />
          </section>

          <div className="rounded-[16px] bg-[#123D2A] p-7 text-white shadow-[0_28px_76px_rgba(18,61,42,0.24)] sm:p-8">
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-[#F2C94C]">
              Cooperative Office
            </p>
            <h2 className="mt-4 text-3xl font-black leading-tight tracking-normal sm:text-4xl">
              {cooperativeName}
            </h2>

            <div className="mt-8 grid gap-4">
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
          </div>

          <div className="min-h-[400px] overflow-hidden rounded-[16px] border border-[#DDE8D8] bg-white shadow-[0_28px_76px_rgba(18,61,42,0.2)] lg:col-span-2">
            <iframe
              title="Nasugbu Farmers and Fisherfolks Agriculture Cooperative location"
              src={mapSrc}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="h-full min-h-[400px] w-full"
            />
          </div>
        </div>
      </section>

      <section className="bg-[#FFFDF8] px-5 py-12 sm:px-8 lg:py-16">
        <div className="mx-auto max-w-7xl">
          <section className="rounded-[16px] border border-[#DDE8D8] bg-white p-6 shadow-[0_18px_52px_rgba(18,61,42,0.08)] sm:p-8">
            <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
              <div>
                <p className="mb-3 text-xs font-bold uppercase tracking-[0.45em] text-[#f4b62a]">
                  Socials
                </p>
                <h2 className="text-3xl font-black leading-tight tracking-normal text-[#073f2b] md:text-5xl">
                  Online channels.
                </h2>
              </div>
              <p className="max-w-md text-sm leading-6 text-[#5d6b63]">
                Placeholder links for now. These can be replaced with official
                cooperative accounts when ready.
              </p>
            </div>

            <div className="mt-7 grid gap-4 md:grid-cols-3">
              {socialLinks.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  className="group rounded-[16px] border border-[#DDE8D8] bg-[#FFFAF2] p-5 transition hover:-translate-y-1 hover:border-[#1F6B43]/35 hover:shadow-[0_18px_44px_rgba(18,61,42,0.1)]"
                >
                  <span className="grid size-12 place-items-center rounded-full bg-[#EAF3E8] text-[#1F6B43] ring-1 ring-[#1F6B43]/15">
                    <item.icon className="size-5" />
                  </span>
                  <span className="mt-5 block text-lg font-black text-[#073f2b]">
                    {item.label}
                  </span>
                  <span className="mt-2 block text-sm font-semibold text-[#5d6b63]">
                    {item.value}
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
      <div className="grid size-11 shrink-0 place-items-center rounded-full bg-white text-[#123D2A]">
        <Icon className="size-5" />
      </div>
      <div>
        <p className="text-sm font-semibold text-white/55">{label}</p>
        <p className="mt-1 break-words font-semibold leading-6 text-white">
          {value}
        </p>
      </div>
    </>
  );

  if (href && href !== "#") {
    return (
      <a
        href={href}
        className="flex gap-4 rounded-[16px] bg-white/8 p-4 transition hover:bg-white/12"
      >
        {content}
      </a>
    );
  }

  return <div className="flex gap-4 rounded-[16px] bg-white/8 p-4">{content}</div>;
}
