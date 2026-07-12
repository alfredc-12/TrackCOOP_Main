import type { Metadata } from "next";
import SiteFooter from "@/components/layout/SiteFooter";
import SiteHeader from "@/components/layout/SiteHeader";
import AnnouncementsArchiveSection from "@/features/announcements/components/AnnouncementsArchiveSection";

export const metadata: Metadata = {
  title: "Announcements | TrackCOOP",
  description:
    "Latest cooperative announcements and public updates for TrackCOOP.",
};

export default function AnnouncementsPage() {
  return (
    <main className="min-h-screen bg-[#FFFAF2] pt-20 text-[#123D2A]">
      <SiteHeader initialActive="announcements" />
      <AnnouncementsArchiveSection />
      <SiteFooter />
    </main>
  );
}
