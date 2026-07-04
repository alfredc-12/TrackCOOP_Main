import type { Metadata } from "next";
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
    <main className="min-h-screen bg-[#FFFAF2] pt-20 text-[#123D2A]">
      <SiteHeader initialActive="contact" />

      <section className="px-5 py-12 sm:px-8 lg:py-16">
        <div className="mx-auto max-w-7xl">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.45em] text-[#f4b62a]">
            Contact
          </p>
          <h1 className="max-w-5xl text-5xl font-black leading-[0.98] tracking-normal text-[#073f2b] md:text-7xl lg:text-8xl">
            Reach the cooperative.
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-[#4b5563]">
            For member assistance, cooperative services, farm and fishery
            coordination, or public inquiries, use the contact channels below.
          </p>

          <div className="mt-10 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="min-h-[480px] overflow-hidden rounded-[18px] border border-[#DDE8D8] bg-white shadow-[0_18px_52px_rgba(18,61,42,0.08)]">
              <iframe
                title="Nasugbu Farmers and Fisherfolks Agriculture Cooperative location"
                src={mapSrc}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="h-full min-h-[480px] w-full"
              />
            </div>

            <div className="rounded-[18px] bg-[#123D2A] p-7 text-white shadow-[0_24px_70px_rgba(18,61,42,0.18)] sm:p-8">
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
          </div>

          <section className="mt-10 rounded-[18px] border border-[#DDE8D8] bg-white p-6 shadow-[0_18px_52px_rgba(18,61,42,0.08)] sm:p-8">
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
