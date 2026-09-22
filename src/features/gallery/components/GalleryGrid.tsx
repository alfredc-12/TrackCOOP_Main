"use client";

import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
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
  const [failedPhotos, setFailedPhotos] = useState<Set<string>>(new Set());
  const published = usePublishedLandingContent();
  const galleryPhotos = useMemo(() => {
    const publishedPhotos = published.gallery
      .map((item) => (typeof item.imagePath === "string" ? item.imagePath : ""))
      .filter(Boolean);
    const mergedPhotos = publishedPhotos.length
      ? [
          ...publishedPhotos,
          ...photos.filter((photo) => !publishedPhotos.includes(photo)),
        ]
      : photos;

    return mergedPhotos.filter((photo) => !failedPhotos.has(photo));
  }, [failedPhotos, published.gallery]);
  const totalPages = Math.max(
    1,
    Math.ceil(galleryPhotos.length / photosPerPage),
  );
  const safeCurrentPage = Math.min(currentPage, totalPages - 1);

  const visiblePhotos = useMemo(() => {
    const start = safeCurrentPage * photosPerPage;
    return galleryPhotos.slice(start, start + photosPerPage);
  }, [safeCurrentPage, galleryPhotos]);

  function handlePhotoError(photo: string) {
    setFailedPhotos((current) => {
      if (current.has(photo)) return current;
      const next = new Set(current);
      next.add(photo);
      return next;
    });
    if (selectedPhoto === photo) setSelectedPhoto(null);
  }

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
      <section className="relative min-h-[24rem] overflow-hidden bg-[#123D2A] px-5 pb-10 pt-24 text-white sm:px-8 lg:min-h-[26rem] lg:pb-12 lg:pt-28">
        <Image
          src="/images/Hero%20Page/Main%20Photo%203.jpg"
          alt="Cooperative gallery activity"
          fill
          priority
          unoptimized
          sizes="100vw"
          className="object-cover object-center opacity-45"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#052F22]/95 via-[#052F22]/82 to-[#052F22]/45" />
        <div className="relative z-10 mx-auto max-w-7xl">
          <p className="mb-6 text-xs font-black uppercase tracking-[0.48em] text-[#F2C94C]">
            Gallery
          </p>
          <h1 className="max-w-6xl text-5xl font-black leading-[0.95] tracking-normal md:text-7xl lg:text-8xl">
            Cooperative moments
          </h1>
          <p className="mt-7 max-w-3xl text-lg leading-8 text-white/88 md:text-xl md:leading-9">
            Browse field activities, member gatherings, assistance programs,
            and cooperative milestones captured for public viewing.
          </p>
        </div>
      </section>

      <section className="border-y border-[#E0EADC] bg-[#F8F1E5] px-5 py-12 text-[#123D2A] sm:px-8 lg:py-16">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visiblePhotos.map((photo, index) => (
              <button
                key={photo}
                type="button"
                aria-label={`Open gallery photo ${safeCurrentPage * photosPerPage + index + 1}`}
                onClick={() => setSelectedPhoto(photo)}
                className="group relative aspect-square overflow-hidden rounded-[16px] border border-[#CFE0C8] bg-[#123D2A] text-left shadow-[0_28px_76px_rgba(18,61,42,0.24)] transition hover:-translate-y-1 hover:shadow-[0_34px_92px_rgba(18,61,42,0.34)] focus:outline-none focus:ring-2 focus:ring-[#F2C94C]"
              >
                <Image
                  src={photo}
                  alt={`Cooperative gallery photo ${safeCurrentPage * photosPerPage + index + 1}`}
                  fill
                  unoptimized
                  sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
                  onError={() => handlePhotoError(photo)}
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
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={selectedPhoto}
                      alt="Selected cooperative gallery photo"
                      onError={() => handlePhotoError(selectedPhoto)}
                      className="max-h-[calc(100dvh-2rem)] max-w-[calc(100vw-1.5rem)] rounded-[16px] object-contain drop-shadow-2xl sm:max-h-[calc(100dvh-3rem)] sm:max-w-[calc(100vw-3rem)]"
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
