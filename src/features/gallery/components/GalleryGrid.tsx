"use client";

import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ArrowRight, Images, X } from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { usePublishedLandingContent } from "@/features/landing-public/usePublishedLandingContent";

const photos = [
  "/images/Hero%20Page/Main%20Photo%201.jpg",
  "/images/Hero%20Page/Main%20Photo%202.jpg",
  "/images/Hero%20Page/Main%20Photo%203.jpg",
  "/images/Hero%20Page/Main%20Photo%204.jpg",
  "/images/announcements/Post%201.1.jpg",
  "/images/announcements/Post%201.2.jpg",
  "/images/announcements/Post%201.3.jpg",
  "/images/announcements/Post%201.4.jpg",
  "/images/announcements/Post%202.1.jpg",
  "/images/announcements/Post%202.2.jpg",
  "/images/announcements/Post%203.1.jpg",
  "/images/announcements/Post%203.2.jpg",
  "/images/announcements/Post%203.3.jpg",
  "/images/announcements/Post%204.1.jpg",
  "/images/announcements/Post%204.2.jpg",
  "/images/announcements/Post%204.3.jpg",
  "/images/announcements/Post%205.1.jpg",
  "/images/announcements/Post%205.2.jpg",
  "/images/Other%20Landing%20Page/About.jpg",
  "/images/Other%20Landing%20Page/Landing%20Page%20Underlay.jpg",
  "/images/stats/underlay.jpg",
];

const photosPerPage = 9;

export default function GalleryGrid() {
  const [currentPage, setCurrentPage] = useState(0);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const published = usePublishedLandingContent();
  const galleryPhotos = useMemo(() => {
    const publishedPhotos = published.gallery
      .map((item) => (typeof item.imagePath === "string" ? item.imagePath : ""))
      .filter(Boolean);
    return publishedPhotos.length ? publishedPhotos : photos;
  }, [published.gallery]);
  const totalPages = Math.max(1, Math.ceil(galleryPhotos.length / photosPerPage));
  const safeCurrentPage = Math.min(currentPage, totalPages - 1);

  const visiblePhotos = useMemo(() => {
    const start = safeCurrentPage * photosPerPage;
    return galleryPhotos.slice(start, start + photosPerPage);
  }, [safeCurrentPage, galleryPhotos]);

  function nextPage() {
    setCurrentPage((page) => (page + 1) % totalPages);
  }

  function prevPage() {
    setCurrentPage((page) => (page - 1 + totalPages) % totalPages);
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setSelectedPhoto(null);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (!selectedPhoto) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [selectedPhoto]);

  return (
    <>
      <section className="bg-[#FFFAF2] px-5 py-12 text-[#123D2A] sm:px-8 lg:py-16">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div>
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.45em] text-[#f4b62a]">
                Gallery
              </p>
              <h1 className="max-w-5xl text-5xl font-black leading-[0.98] tracking-normal text-[#073f2b] md:text-7xl lg:text-8xl">
                Cooperative moments.
              </h1>
            </div>
            <div className="grid size-14 place-items-center rounded-full bg-[#EAF3E8] text-[#1F6B43] ring-1 ring-[#1F6B43]/15">
              <Images className="size-7" />
            </div>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visiblePhotos.map((photo, index) => (
              <button
                key={photo}
                type="button"
                aria-label={`Open gallery photo ${safeCurrentPage * photosPerPage + index + 1}`}
                onClick={() => setSelectedPhoto(photo)}
                className="group relative aspect-square overflow-hidden rounded-[16px] border border-[#CFE0C8] bg-[#123D2A] text-left shadow-[0_18px_52px_rgba(31,107,67,0.12)] transition hover:-translate-y-1 hover:shadow-[0_24px_70px_rgba(31,107,67,0.22)] focus:outline-none focus:ring-2 focus:ring-[#F2C94C]"
              >
                <Image
                  src={photo}
                  alt={`Cooperative gallery photo ${safeCurrentPage * photosPerPage + index + 1}`}
                  fill
                  unoptimized
                  sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
                  className="object-cover transition duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#03291d]/35 via-transparent to-transparent opacity-70 transition group-hover:opacity-40" />
              </button>
            ))}
          </div>

          <div className="mt-8 flex flex-col items-center justify-between gap-4 border-t border-[#DDE8D8] pt-6 sm:flex-row">
            <p className="text-sm font-semibold text-[#5d6b63]">
              Page {safeCurrentPage + 1} of {totalPages}
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                aria-label="Previous gallery page"
                onClick={prevPage}
                className="inline-flex h-11 items-center gap-2 rounded-full border border-[#1F6B43]/15 bg-[#EAF3E8] px-5 text-sm font-bold text-[#123D2A] shadow-[0_8px_20px_rgba(18,61,42,0.08)] transition hover:-translate-y-0.5 hover:bg-[#123D2A] hover:text-white"
              >
                <ArrowLeft className="size-4" />
                Prev
              </button>
              <div className="flex gap-2">
                {Array.from({ length: totalPages }).map((_, index) => (
                  <button
                    key={index}
                    type="button"
                    aria-label={`Go to gallery page ${index + 1}`}
                    aria-current={safeCurrentPage === index ? "true" : undefined}
                    onClick={() => setCurrentPage(index)}
                    className={`size-2.5 rounded-full transition ${
                      safeCurrentPage === index
                        ? "w-8 bg-[#123D2A]"
                        : "bg-[#C9D8C8]"
                    }`}
                  />
                ))}
              </div>
              <button
                type="button"
                aria-label="Next gallery page"
                onClick={nextPage}
                className="inline-flex h-11 items-center gap-2 rounded-full border border-[#1F6B43]/15 bg-[#EAF3E8] px-5 text-sm font-bold text-[#123D2A] shadow-[0_8px_20px_rgba(18,61,42,0.08)] transition hover:-translate-y-0.5 hover:bg-[#123D2A] hover:text-white"
              >
                Next
                <ArrowRight className="size-4" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {typeof document !== "undefined"
        ? createPortal(
            <AnimatePresence>
              {selectedPhoto ? (
                <motion.div
                  key="gallery-preview"
                  role="dialog"
                  aria-modal="true"
                  aria-label="Gallery photo preview"
                  className="fixed inset-0 z-[9999] grid h-[100dvh] w-screen place-items-center overflow-hidden bg-black/35 p-3 backdrop-blur-2xl sm:p-6"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.22, ease: "easeOut" }}
                  onClick={() => setSelectedPhoto(null)}
                >
                  <motion.button
                    type="button"
                    aria-label="Close gallery photo preview"
                    onClick={(event) => {
                      event.stopPropagation();
                      setSelectedPhoto(null);
                    }}
                    className="absolute right-4 top-4 z-10 grid size-11 place-items-center rounded-full border border-white/20 bg-white/12 text-white backdrop-blur transition hover:bg-white hover:text-[#123D2A]"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.18, ease: "easeOut" }}
                  >
                    <X className="size-5" />
                  </motion.button>
                  <motion.div
                    className="max-h-[calc(100dvh-2rem)] max-w-[calc(100vw-1.5rem)] sm:max-h-[calc(100dvh-3rem)] sm:max-w-[calc(100vw-3rem)]"
                    initial={{ opacity: 0, y: 18, scale: 0.94 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.96 }}
                    transition={{ duration: 0.26, ease: "easeOut" }}
                    onClick={(event) => event.stopPropagation()}
                  >
                    <img
                      src={selectedPhoto}
                      alt="Selected cooperative gallery photo"
                      className="max-h-[calc(100dvh-2rem)] max-w-[calc(100vw-1.5rem)] object-contain drop-shadow-2xl sm:max-h-[calc(100dvh-3rem)] sm:max-w-[calc(100vw-3rem)]"
                    />
                  </motion.div>
                </motion.div>
              ) : null}
            </AnimatePresence>,
            document.body,
          )
        : null}
    </>
  );
}
