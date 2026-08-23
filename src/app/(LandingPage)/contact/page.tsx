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
    <main className="min-h-screen bg-[#FFFAF2] pt-16 text-[#123D2A]">
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
            <section className="rounded-[18px] border border-[#DDE8D8] bg-white p-6 shadow-[0_18px_52px_rgba(18,61,42,0.08)] sm:p-8">
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

            <div className="rounded-[18px] bg-[#123D2A] p-7 text-white shadow-[0_24px_70px_rgba(18,61,42,0.18)] sm:p-8 flex flex-col">
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-[#F2C94C]">
                Cooperative Office
              </p>
              <h2 className="mt-4 text-3xl font-black leading-tight tracking-normal sm:text-4xl">
                {cooperativeName}
              </h2>

              <div className="mt-8 grid gap-4 flex-grow">
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
              
              <div className="mt-8 pt-8 border-t border-white/20">
                <p className="text-xs font-bold uppercase tracking-[0.28em] text-[#F2C94C] mb-4">
                  Social Channels
                </p>
                <div className="flex gap-4">
                  {socialLinks.map((item) => (
                    <a
                      key={item.label}
                      href={item.href}
                      title={item.label}
                      className="grid size-12 place-items-center rounded-full bg-white/10 transition hover:bg-white/20 hover:-translate-y-1"
                    >
                      <item.icon className="size-5" />
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </div>
          
          <div className="mt-6 min-h-[400px] overflow-hidden rounded-[18px] border border-[#DDE8D8] bg-white shadow-[0_18px_52px_rgba(18,61,42,0.08)]">
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
