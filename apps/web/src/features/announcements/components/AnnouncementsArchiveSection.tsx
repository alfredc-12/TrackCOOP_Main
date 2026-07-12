"use client";

import { AnimatePresence, motion } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  Megaphone,
  X,
} from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { getAnnouncements } from "../service";
import type { Announcement } from "../types";

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
  if (content.length <= 112) return content;
  return `${content.slice(0, 112).trim()}...`;
}

export default function AnnouncementsArchiveSection() {
  const [selectedAnnouncement, setSelectedAnnouncement] =
    useState<Announcement | null>(null);
  const [currentImage, setCurrentImage] = useState(0);
  const modalImages = selectedAnnouncement?.images ?? [];

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setSelectedAnnouncement(null);
      if (event.key === "ArrowRight" && modalImages.length > 1) {
        setCurrentImage((index) => (index + 1) % modalImages.length);
      }
      if (event.key === "ArrowLeft" && modalImages.length > 1) {
        setCurrentImage(
          (index) => (index - 1 + modalImages.length) % modalImages.length,
        );
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [modalImages.length]);

  useEffect(() => {
    if (!selectedAnnouncement) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [selectedAnnouncement]);

  function nextImage() {
    setCurrentImage((index) => (index + 1) % modalImages.length);
  }

  function prevImage() {
    setCurrentImage(
      (index) => (index - 1 + modalImages.length) % modalImages.length,
    );
  }

  return (
    <>
      <section className="bg-[#FFFAF2] px-5 py-12 text-[#123D2A] sm:px-8 lg:py-16">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div>
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.45em] text-[#f4b62a]">
                Announcements
              </p>
              <h1 className="max-w-5xl text-5xl font-black leading-[0.98] tracking-normal text-[#073f2b] md:text-7xl lg:text-8xl">
                Latest cooperative updates.
              </h1>
            </div>
            <div className="grid size-14 place-items-center rounded-full bg-[#EAF3E8] text-[#1F6B43] ring-1 ring-[#1F6B43]/15">
              <Megaphone className="size-7" />
            </div>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {announcements.map((announcement) => {
              const coverImage = announcement.images[0];

              return (
                <button
                  key={announcement.id}
                  type="button"
                  onClick={() => {
                    setCurrentImage(0);
                    setSelectedAnnouncement(announcement);
                  }}
                  className="group relative min-h-[340px] overflow-hidden rounded-[16px] border border-[#CFE0C8] bg-[#123D2A] text-left shadow-[0_18px_52px_rgba(31,107,67,0.22)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_24px_70px_rgba(31,107,67,0.34)] focus:outline-none focus:ring-2 focus:ring-[#F2C94C]"
                >
                  {coverImage ? (
                    <Image
                      src={coverImage}
                      alt=""
                      fill
                      unoptimized
                      sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
                      className="object-cover transition duration-700 group-hover:scale-105"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-[linear-gradient(135deg,#EAF3E8,#FFFAF2)]" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#03291d]/94 via-[#03291d]/38 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-5 text-white">
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#F2C94C]">
                      {formatDate(announcement.postedAt)}
                    </p>
                    <p className="mt-4 text-sm leading-6 text-white/90">
                      {getPreview(announcement.content)}
                    </p>
                    <span className="mt-5 inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-white">
                      Read post
                      <ArrowRight className="size-4" />
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {typeof document !== "undefined"
        ? createPortal(
            <AnimatePresence>
              {selectedAnnouncement ? (
                <motion.div
                  key="announcement-modal"
                  role="dialog"
                  aria-modal="true"
                  aria-label="Full announcement"
                  className="fixed inset-0 z-[9999] overflow-y-auto bg-black/35 p-4 text-[#123D2A] backdrop-blur-2xl sm:p-6"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.22, ease: "easeOut" }}
                  onClick={() => setSelectedAnnouncement(null)}
                >
                  <motion.button
                    type="button"
                    aria-label="Close announcement"
                    onClick={(event) => {
                      event.stopPropagation();
                      setSelectedAnnouncement(null);
                    }}
                    className="fixed right-4 top-4 z-20 grid size-11 place-items-center rounded-full border border-white/20 bg-white/12 text-white backdrop-blur transition hover:bg-white hover:text-[#123D2A]"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.18, ease: "easeOut" }}
                  >
                    <X className="size-5" />
                  </motion.button>

                  <motion.article
                    className="mx-auto my-10 max-w-6xl overflow-hidden rounded-[20px] border border-[#DDE8D8] bg-[#FFFAF2] shadow-[0_30px_90px_rgba(0,0,0,0.28)]"
                    initial={{ opacity: 0, y: 24, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 14, scale: 0.97 }}
                    transition={{ duration: 0.26, ease: "easeOut" }}
                    onClick={(event) => event.stopPropagation()}
                  >
                    <div className="grid lg:grid-cols-[1.15fr_0.85fr]">
                      <div className="relative min-h-[340px] bg-[#123D2A] sm:min-h-[520px] lg:min-h-[720px]">
                        {modalImages.length > 0 ? (
                          modalImages.map((image, index) => (
                            <Image
                              key={`${selectedAnnouncement.id}-${image}`}
                              src={image}
                              alt=""
                              fill
                              unoptimized
                              sizes="(max-width: 1024px) 100vw, 58vw"
                              className={`object-contain transition duration-500 ${
                                currentImage === index
                                  ? "opacity-100"
                                  : "opacity-0"
                              }`}
                            />
                          ))
                        ) : (
                          <div className="absolute inset-0 bg-[linear-gradient(135deg,#EAF3E8,#FFFAF2)]" />
                        )}

                        {modalImages.length > 1 ? (
                          <>
                            <button
                              type="button"
                              aria-label="Previous announcement photo"
                              onClick={prevImage}
                              className="absolute left-4 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full border border-white/20 bg-[#123D2A]/45 text-white shadow-[0_12px_28px_rgba(0,0,0,0.18)] backdrop-blur transition hover:bg-white hover:text-[#123D2A]"
                            >
                              <ArrowLeft className="size-4" />
                            </button>
                            <button
                              type="button"
                              aria-label="Next announcement photo"
                              onClick={nextImage}
                              className="absolute right-4 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full border border-white/20 bg-[#123D2A]/45 text-white shadow-[0_12px_28px_rgba(0,0,0,0.18)] backdrop-blur transition hover:bg-white hover:text-[#123D2A]"
                            >
                              <ArrowRight className="size-4" />
                            </button>
                            <div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 gap-2 rounded-full bg-[#123D2A]/40 px-3 py-2 backdrop-blur">
                              {modalImages.map((image, index) => (
                                <button
                                  key={image}
                                  type="button"
                                  aria-label={`Show image ${index + 1}`}
                                  aria-current={
                                    currentImage === index ? "true" : undefined
                                  }
                                  onClick={() => setCurrentImage(index)}
                                  className={`size-2.5 rounded-full transition ${
                                    currentImage === index
                                      ? "bg-[#F2C94C]"
                                      : "bg-white/70"
                                  }`}
                                />
                              ))}
                            </div>
                          </>
                        ) : null}
                      </div>

                      <div className="flex max-h-[720px] flex-col overflow-y-auto p-6 sm:p-8">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#f4b62a]">
                              {formatDate(selectedAnnouncement.postedAt)}
                            </p>
                            <p className="mt-2 text-sm font-semibold text-[#5d6b63]">
                              {selectedAnnouncement.originalAuthorName}
                            </p>
                          </div>
                          <a
                            href={selectedAnnouncement.sourceUrl}
                            target="_blank"
                            rel="noreferrer"
                            aria-label="View original announcement post"
                            className="grid size-11 shrink-0 place-items-center rounded-full border border-[#1F6B43]/15 bg-[#EAF3E8] text-[#123D2A] shadow-[0_8px_20px_rgba(18,61,42,0.08)] transition hover:-translate-y-0.5 hover:bg-[#123D2A] hover:text-white"
                          >
                            <ExternalLink className="size-4" />
                          </a>
                        </div>

                        <div className="mt-8 whitespace-pre-line text-lg leading-9 text-[#123D2A]">
                          {selectedAnnouncement.content}
                        </div>
                      </div>
                    </div>
                  </motion.article>
                </motion.div>
              ) : null}
            </AnimatePresence>,
            document.body,
          )
        : null}
    </>
  );
}
