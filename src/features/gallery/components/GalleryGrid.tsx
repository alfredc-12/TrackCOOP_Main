"use client";

import { Maximize2 } from "lucide-react";
import Image from "next/image";
import { useMemo, useState } from "react";
import { PaginationControls } from "@/components/portal/PortalPrimitives";
import { usePublishedLandingContent } from "@/features/landing-public/usePublishedLandingContent";
import { resolveUploadUrl } from "@/lib/upload-url";
import { GalleryPhotoViewer, type GalleryPhoto } from "./GalleryPhotoViewer";
import styles from "./GalleryGrid.module.css";

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

export default function GalleryGrid() {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [failedPhotos, setFailedPhotos] = useState<Set<string>>(new Set());
  const published = usePublishedLandingContent();
  const galleryPhotos = useMemo(() => {
    const collection = new Map<string, GalleryPhoto>();
    for (const item of published.gallery) {
      const src = resolveUploadUrl(typeof item.imagePath === "string" ? item.imagePath : "");
      if (!src || collection.has(src)) continue;
      collection.set(src, {
        src,
        title: typeof item.title === "string" ? item.title : "",
        caption: typeof item.caption === "string" ? item.caption : "",
      });
    }
    for (const src of photos) {
      if (!collection.has(src)) collection.set(src, { src, title: "", caption: "" });
    }
    return [...collection.values()].filter((photo) => !failedPhotos.has(photo.src));
  }, [failedPhotos, published.gallery]);

  const totalPages = Math.max(1, Math.ceil(galleryPhotos.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const start = (safeCurrentPage - 1) * pageSize;
  const visiblePhotos = galleryPhotos.slice(start, start + pageSize);
  const selected = galleryPhotos.find((photo) => photo.src === selectedPhoto);

  function handlePhotoError(src: string) {
    setFailedPhotos((current) => {
      if (current.has(src)) return current;
      const next = new Set(current);
      next.add(src);
      return next;
    });
    if (selectedPhoto === src) setSelectedPhoto(null);
  }

  function retryPhotos() {
    setFailedPhotos(new Set());
    setCurrentPage(1);
    published.retry();
  }

  return (
    <>
      <section aria-labelledby="gallery-title" className="group relative min-h-[24rem] overflow-hidden bg-[#123D2A] px-5 pb-12 pt-28 text-white sm:px-8 lg:pb-14 lg:pt-32">
        <Image src="/images/Hero%20Page/Main%20Photo%203.jpg" alt="Cooperative gallery activity" fill priority unoptimized sizes="100vw" className="public-hero-media object-cover object-[center_42%] opacity-70 transition-transform duration-700 motion-safe:group-hover:scale-[1.025]" />
        <div className="absolute inset-0 bg-[#052F22]/70" />
        <div className="relative z-10 mx-auto max-w-7xl">
          <p className="mb-4 text-xs font-bold uppercase tracking-[0.35em] text-[#F2C94C]">Cooperative moments</p>
          <h1 id="gallery-title" className="max-w-5xl text-4xl font-black leading-[1.05] sm:text-6xl lg:text-7xl">Gallery</h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-white/90 sm:text-lg sm:leading-8">Browse field activities, member gatherings, assistance programs, and cooperative milestones captured for public viewing.</p>
        </div>
      </section>

      <section aria-labelledby="gallery-photos-heading" className="flex-1 border-t border-[var(--public-section-border)] bg-[var(--public-canvas)] px-5 pb-14 pt-8 text-[#123D2A] sm:px-8 lg:pb-20 lg:pt-10">
        <div className="mx-auto max-w-7xl">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <h2 id="gallery-photos-heading" tabIndex={-1} className="text-2xl font-bold outline-none">Photo gallery</h2>
            <p aria-live="polite" className="text-sm font-semibold text-[#365F4A]">{published.isLoading ? "Loading published photos..." : `${galleryPhotos.length} photo${galleryPhotos.length === 1 ? "" : "s"}`}</p>
          </div>
          {published.loadError ? <div role="status" className="public-card mb-6 flex flex-wrap items-center justify-between gap-3 px-4 py-3"><p className="text-sm leading-6 text-[#365F4A]">Some gallery photos could not be loaded. You can still browse the available collection.</p><button type="button" onClick={retryPhotos} className="public-action min-h-11 rounded-md bg-[#123D2A] px-4 text-sm font-bold text-white hover:bg-[#1F6B43]">Retry</button></div> : null}

          {galleryPhotos.length ? <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {visiblePhotos.map((photo, index) => <button
              key={photo.src}
              type="button"
              aria-label={`Open gallery photo ${start + index + 1}`}
              onClick={() => setSelectedPhoto(photo.src)}
              className={`${styles.photoCard} group relative min-w-0 cursor-pointer text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1F6B43]`}
            >
              <span className="relative block aspect-[4/3] overflow-hidden">
                <Image src={photo.src} alt={photo.title || `Cooperative gallery photo ${start + index + 1}`} fill unoptimized sizes="(min-width:1024px) 33vw, (min-width:640px) 50vw, 100vw" onError={() => handlePhotoError(photo.src)} className="object-cover" />
                <span aria-hidden="true" className="pointer-events-none absolute right-3 top-3 grid size-9 place-items-center rounded-full bg-white/95 text-[#123D2A] opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"><Maximize2 className="size-4" /></span>
              </span>
            </button>)}
          </div> : <div className="public-card px-6 py-12 text-center"><h3 className="text-xl font-bold">No photos to display</h3><p className="mt-2 leading-7 text-[#365F4A]">Please check back for cooperative photos.</p><button type="button" onClick={retryPhotos} className="public-action mt-5 min-h-11 rounded-md bg-[#123D2A] px-5 text-sm font-bold text-white hover:bg-[#1F6B43]">Retry photos</button></div>}

          {galleryPhotos.length ? <PaginationControls
            currentPage={safeCurrentPage}
            totalPages={totalPages}
            totalItems={galleryPhotos.length}
            itemName="photos"
            onPageChange={setCurrentPage}
            pageSize={pageSize}
            pageSizeOptions={[6, 10, 20, 50]}
            onPageSizeChange={(nextPageSize) => { setPageSize(nextPageSize); setCurrentPage(1); }}
            centerControls
            className="mt-8 border-t border-[var(--public-card-border)] pt-5"
          /> : null}
        </div>
      </section>
      {selected ? <GalleryPhotoViewer key={selected.src} photo={selected} onClose={() => setSelectedPhoto(null)} onImageError={handlePhotoError} /> : null}
    </>
  );
}
