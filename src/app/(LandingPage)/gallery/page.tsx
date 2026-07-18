import type { Metadata } from "next";
import SiteFooter from "@/components/layout/SiteFooter";
import SiteHeader from "@/components/layout/SiteHeader";
import GalleryGrid from "@/features/gallery/components/GalleryGrid";

export const metadata: Metadata = {
  title: "Gallery | TrackCOOP",
  description:
    "Cooperative gallery photos uploaded for TrackCOOP public viewing.",
};

export default function GalleryPage() {
  return (
    <main className="min-h-screen bg-[#FFFAF2] pt-16 text-[#123D2A]">
      <SiteHeader initialActive="gallery" />
      <GalleryGrid />
      <SiteFooter />
    </main>
  );
}
