"use client";

import { ArrowLeft, ArrowRight, ExternalLink, Megaphone } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { getAnnouncements } from "../service";

const announcements = getAnnouncements();

function formatDate(date?: string) {
  if (!date) return "Recent";

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));
}

function getPreview(content: string) {
  if (content.length <= 140) return content;
  return `${content.slice(0, 140).trim()}...`;
}

export default function AnnouncementsSection() {
  const [currentAnnouncement, setCurrentAnnouncement] = useState(0);
  const [currentImage, setCurrentImage] = useState(0);
  const announcement = announcements[currentAnnouncement];
  const images = announcement?.images ?? [];
  const hasImages = images.length > 0;

  function nextAnnouncement() {
    setCurrentImage(0);
    setCurrentAnnouncement((index) => (index + 1) % announcements.length);
  }

  function prevAnnouncement() {
    setCurrentImage(0);
    setCurrentAnnouncement(
      (index) => (index - 1 + announcements.length) % announcements.length,
    );
  }

  function nextImage() {
    setCurrentImage((index) => (index + 1) % images.length);
  }

  function prevImage() {
    setCurrentImage((index) => (index - 1 + images.length) % images.length);
  }

  if (!announcement) return null;

  return (
    <section className="h-full bg-[#FFFAF2] p-5 text-[#123D2A] sm:p-6">
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between gap-4">
          <h2 className="inline-flex items-center gap-3 text-2xl font-semibold tracking-tight text-[#123D2A]">
            <span className="grid size-10 place-items-center rounded-full bg-[#EAF3E8] text-[#1F6B43] ring-1 ring-[#1F6B43]/15">
              <Megaphone className="size-5" />
            </span>
            Announcements
          </h2>
          <div className="flex gap-2">
            <button
              type="button"
              aria-label="Previous announcement"
              onClick={prevAnnouncement}
              className="grid size-10 place-items-center rounded-full border border-[#1F6B43]/15 bg-[#EAF3E8] text-[#123D2A] shadow-[0_8px_20px_rgba(18,61,42,0.08)] transition hover:-translate-y-0.5 hover:bg-[#123D2A] hover:text-white"
            >
              <ArrowLeft className="size-4" />
            </button>
            <button
              type="button"
              aria-label="Next announcement"
              onClick={nextAnnouncement}
              className="grid size-10 place-items-center rounded-full border border-[#1F6B43]/15 bg-[#EAF3E8] text-[#123D2A] shadow-[0_8px_20px_rgba(18,61,42,0.08)] transition hover:-translate-y-0.5 hover:bg-[#123D2A] hover:text-white"
            >
              <ArrowRight className="size-4" />
            </button>
          </div>
        </div>

        <article className="relative mt-6 flex min-h-[540px] flex-1 overflow-hidden rounded-[16px] border border-[#CFE0C8] bg-[#123D2A] shadow-[0_28px_80px_rgba(31,107,67,0.42)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(242,201,76,0.28),transparent_34%),linear-gradient(135deg,#EAF3E8,#FFFAF2)]">
            {hasImages
              ? images.map((image, index) => (
                  <Image
                    key={`${announcement.id}-${image}`}
                    src={image}
                    alt={announcement.title}
                    fill
                    unoptimized
                    sizes="(max-width: 1024px) 100vw, 33vw"
                    className={`object-cover transition duration-700 ${
                      index === currentImage ? "opacity-100" : "opacity-0"
                    }`}
                  />
                ))
              : null}
          </div>

          <div className="absolute inset-0 bg-gradient-to-t from-[#03291d]/92 via-[#03291d]/32 to-transparent" />
          <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-[#03291d]/42 to-transparent" />

          {images.length > 1 ? (
            <>
              <div className="absolute left-4 top-4 flex gap-2">
                <button
                  type="button"
                  aria-label="Previous announcement photo"
                  onClick={prevImage}
                  className="grid size-10 place-items-center rounded-full border border-white/20 bg-[#123D2A]/34 text-white shadow-[0_12px_28px_rgba(0,0,0,0.18)] backdrop-blur transition hover:-translate-y-0.5 hover:bg-white hover:text-[#123D2A]"
                >
                  <ArrowLeft className="size-4" />
                </button>
                <button
                  type="button"
                  aria-label="Next announcement photo"
                  onClick={nextImage}
                  className="grid size-10 place-items-center rounded-full border border-white/20 bg-[#123D2A]/34 text-white shadow-[0_12px_28px_rgba(0,0,0,0.18)] backdrop-blur transition hover:-translate-y-0.5 hover:bg-white hover:text-[#123D2A]"
                >
                  <ArrowRight className="size-4" />
                </button>
              </div>
              <div className="absolute left-1/2 top-5 flex -translate-x-1/2 gap-2 rounded-full bg-[#123D2A]/32 px-3 py-2 backdrop-blur">
                {images.map((image, index) => (
                  <button
                    key={image}
                    type="button"
                    aria-label={`Show image ${index + 1}`}
                    aria-current={currentImage === index ? "true" : undefined}
                    onClick={() => setCurrentImage(index)}
                    className={`size-2.5 rounded-full transition ${
                      currentImage === index ? "bg-[#F2C94C]" : "bg-white/70"
                    }`}
                  />
                ))}
              </div>
            </>
          ) : null}

          <div className="absolute inset-x-0 bottom-0 p-5 text-white sm:p-6">
            <div className="mb-3 flex items-center justify-between gap-4">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#F2C94C]">
                {formatDate(announcement.postedAt)}
              </p>
              <a
                href={announcement.sourceUrl}
                target="_blank"
                rel="noreferrer"
                aria-label="View original announcement post"
                className="grid size-10 shrink-0 place-items-center rounded-full border border-white/20 bg-white/14 text-white shadow-[0_12px_30px_rgba(0,0,0,0.18)] backdrop-blur transition hover:-translate-y-0.5 hover:bg-white hover:text-[#123D2A]"
              >
                <ExternalLink className="size-4" />
              </a>
            </div>
            <p className="text-sm leading-6 text-white/88">
              {getPreview(announcement.content)}
            </p>
          </div>
        </article>
      </div>
    </section>
  );
}
