"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "motion/react";
import { Loader2, RefreshCw } from "lucide-react";
import { useState } from "react";
import type { CSSProperties } from "react";
import {
  LandingPhotoLightbox,
  type LandingPhoto,
} from "./LandingPhotoLightbox";
import { resolveUploadUrl } from "@/lib/upload-url";

const mosaicAreas = [
  "rice",
  "seedling",
  "side",
  "processing",
  "organic",
  "farm",
  "documents",
];

type Props = {
  photos: LandingPhoto[];
  isLoading: boolean;
  loadError: boolean;
  onRetry: () => void;
};

export function RecentPhotosSection({
  photos,
  isLoading,
  loadError,
  onRetry,
}: Props) {
  const [failedPhotos, setFailedPhotos] = useState<Set<string>>(new Set());
  const [openPhotoId, setOpenPhotoId] = useState<string | null>(null);
  const reducedMotion = useReducedMotion();
  const [opener, setOpener] = useState<HTMLElement | null>(null);
  const visiblePhotos = photos
    .filter((photo) => photo.imagePath.trim() && !failedPhotos.has(photo.id))
    .slice(0, 7);
  const fullMosaic = visiblePhotos.length === 7;

  function handleImageError(id: string) {
    setFailedPhotos((current) => new Set(current).add(id));
    if (openPhotoId === id) setOpenPhotoId(null);
  }

  function retry() {
    setFailedPhotos(new Set());
    onRetry();
  }

  return (
    <section
      id="projects"
      aria-labelledby="recent-photos-heading"
      className="relative overflow-hidden bg-[#eaf3e8] py-12 text-[#073f2b] lg:py-16"
    >
      <div className="relative z-10 mx-auto max-w-[1680px] px-6 lg:px-20">
        <p className="mb-3 text-xs font-bold uppercase tracking-[0.35em] text-[#9A6400]">
          Gallery
        </p>
        <h2
          id="recent-photos-heading"
          className="max-w-6xl text-5xl font-black leading-[0.98] tracking-normal text-[#073f2b] md:text-7xl lg:text-8xl"
        >
          Work moving through the field.
        </h2>
      </div>

      <div
        className="relative z-10 mt-10 px-6 lg:mt-12 lg:px-8"
        aria-busy={isLoading}
      >
        {isLoading ? (
          <p
            role="status"
            className="flex min-h-48 items-center justify-center gap-3 text-sm font-semibold"
          >
            <Loader2 className="size-5 animate-spin" />
            Loading gallery photos...
          </p>
        ) : loadError ? (
          <div
            role="status"
            className="grid min-h-48 place-content-center justify-items-center gap-4"
          >
            <p>Gallery photos could not be loaded.</p>
            <button
              type="button"
              onClick={retry}
              className="inline-flex min-h-11 items-center gap-2 rounded-md bg-[#123D2A] px-5 font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#123D2A]"
            >
              <RefreshCw className="size-4" />
              Retry
            </button>
          </div>
        ) : visiblePhotos.length === 0 ? (
          <p
            role="status"
            className="grid min-h-48 place-items-center text-sm font-semibold"
          >
            No gallery photos are currently available.
          </p>
        ) : (
          <div
            className={`recent-photos-grid grid grid-cols-1 gap-4 md:grid-cols-2 ${fullMosaic ? "recent-photos-mosaic lg:h-[600px] lg:grid-cols-12 lg:grid-rows-6" : "lg:grid-cols-3"}`}
          >
            {visiblePhotos.map((photo, index) => (
              <motion.button
                key={photo.id}
                type="button"
                aria-label={`Enlarge photo ${index + 1}: ${photo.altText}`}
                initial={false}
                whileHover={reducedMotion ? undefined : { y: -4, scale: 1.01 }}
                transition={{ duration: 0.25 }}
                onClick={(event) => {
                  setOpener(event.currentTarget);
                  setOpenPhotoId(photo.id);
                }}
                style={
                  fullMosaic
                    ? ({ "--photo-area": mosaicAreas[index] } as CSSProperties)
                    : undefined
                }
                className={`recent-photo group relative h-[260px] w-full cursor-zoom-in overflow-hidden rounded-[18px] bg-white text-left shadow-[var(--public-card-shadow)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#123D2A] ${fullMosaic ? "lg:h-auto" : ""}`}
              >
                <Image
                  src={resolveUploadUrl(photo.imagePath)}
                  alt={photo.altText}
                  fill
                  unoptimized
                  sizes="(max-width: 767px) 100vw, (max-width: 1023px) 50vw, 50vw"
                  onError={() => handleImageError(photo.id)}
                  className="object-cover transition-transform duration-700 ease-out group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                />
              </motion.button>
            ))}
          </div>
        )}
      </div>

      {openPhotoId && visiblePhotos.some((p) => p.id === openPhotoId) && (
        <LandingPhotoLightbox
          photos={visiblePhotos}
          index={visiblePhotos.findIndex((p) => p.id === openPhotoId)}
          onIndex={(index) => setOpenPhotoId(visiblePhotos[index].id)}
          onClose={() => setOpenPhotoId(null)}
          onFailed={handleImageError}
          opener={opener}
        />
      )}
      <style>{`
        @media (min-width: 1024px) {
          .recent-photos-mosaic {
            grid-template-areas:
              "rice rice rice rice seedling seedling seedling seedling seedling seedling side side"
              "rice rice rice rice seedling seedling seedling seedling seedling seedling side side"
              "rice rice rice rice processing processing processing processing organic organic side side"
              "farm farm farm farm processing processing processing processing organic organic side side"
              "farm farm farm farm documents documents documents documents organic organic side side"
              "farm farm farm farm documents documents documents documents organic organic side side";
          }
          .recent-photos-mosaic > .recent-photo { grid-area: var(--photo-area); }
        }
      `}</style>
    </section>
  );
}
