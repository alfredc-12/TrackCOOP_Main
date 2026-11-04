"use client";

import * as Dialog from "@radix-ui/react-dialog";
import Image from "next/image";
import { ArrowLeft, ArrowRight, ExternalLink, ImageOff, X } from "lucide-react";
import { useRef, useState } from "react";
import { announcementContent, announcementDate, announcementImages, formatAnnouncementDate } from "../announcement-display";
import type { PublicAnnouncement } from "../types";
import styles from "./AnnouncementPostModal.module.css";

export function AnnouncementPostModal({ post, initialImage = 0, onClose }: {
  post: PublicAnnouncement;
  initialImage?: number;
  onClose: () => void;
}) {
  const images = announcementImages(post);
  const [currentImage, setCurrentImage] = useState(() => Math.max(0, Math.min(initialImage, images.length - 1)));
  const [failedImages, setFailedImages] = useState<string[]>([]);
  const closeRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const image = images[currentImage];
  const content = announcementContent(post);
  const title = post.title || "Cooperative announcement";

  function moveImage(offset: number) {
    if (images.length > 1) setCurrentImage((current) => (current + offset + images.length) % images.length);
  }

  return (
    <Dialog.Root open onOpenChange={(open) => { if (!open) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className={`${styles.backdrop} fixed inset-0 z-[9999] bg-[#092A1E]/65`} />
        <div className="pointer-events-none fixed inset-0 z-[10000] grid place-items-center p-4 sm:p-6">
          <Dialog.Content
            aria-describedby={undefined}
            onOpenAutoFocus={(event) => {
              event.preventDefault();
              openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
              closeRef.current?.focus();
            }}
            onCloseAutoFocus={(event) => { event.preventDefault(); openerRef.current?.focus(); }}
            onKeyDown={(event) => {
              if (event.key === "ArrowRight") { event.preventDefault(); moveImage(1); }
              if (event.key === "ArrowLeft") { event.preventDefault(); moveImage(-1); }
            }}
            className={`${styles.reader} public-announcements pointer-events-auto relative grid max-h-[calc(100dvh-2rem)] w-full max-w-6xl grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-xl border border-[var(--public-card-border)] bg-white text-[#123D2A] shadow-[0_24px_80px_rgba(0,0,0,.25)] outline-none ${images.length ? "md:h-[min(44rem,calc(100dvh-3rem))] md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] md:grid-rows-1" : "md:max-w-2xl"}`}
          >
            <Dialog.Close ref={closeRef} aria-label="Close announcement" className="public-action absolute right-3 top-3 z-20 grid size-11 place-items-center rounded-full border border-[var(--public-card-border)] bg-white text-[#123D2A] shadow-sm hover:bg-[#EAF3E8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1F6B43]">
              <X aria-hidden="true" className="size-5" />
            </Dialog.Close>

            {images.length > 0 ? (
              <div aria-label="Announcement photos" className="flex min-h-0 min-w-0 flex-col bg-[#EAF3E8] p-3 md:p-4">
                <div className="relative h-[36dvh] min-h-64 max-h-96 overflow-hidden rounded-lg bg-[#DCE7DB] md:h-auto md:min-h-0 md:max-h-none md:flex-1">
                  {image && !failedImages.includes(image) ? (
                    <Image src={image} alt={`${title}, photo ${currentImage + 1} of ${images.length}`} fill unoptimized sizes="(min-width: 768px) 55vw, 100vw" className="object-contain" onError={() => setFailedImages((current) => [...current, image])} />
                  ) : (
                    <div className="absolute inset-0 grid place-content-center gap-2 text-center text-sm text-[#365F4A]"><ImageOff aria-hidden="true" className="mx-auto size-8" /><p>This photo is unavailable.</p></div>
                  )}
                  <p aria-live="polite" className="sr-only">Photo {currentImage + 1} of {images.length}</p>
                  {images.length > 1 ? <>
                    <button type="button" aria-label="Previous announcement photo" onClick={() => moveImage(-1)} className="absolute left-3 top-1/2 z-10 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/95 text-[#123D2A] shadow-md transition-colors hover:bg-[#123D2A] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1F6B43]"><ArrowLeft aria-hidden="true" className="size-5" /></button>
                    <button type="button" aria-label="Next announcement photo" onClick={() => moveImage(1)} className="absolute right-3 top-1/2 z-10 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/95 text-[#123D2A] shadow-md transition-colors hover:bg-[#123D2A] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1F6B43]"><ArrowRight aria-hidden="true" className="size-5" /></button>
                    <div className="absolute inset-x-3 bottom-3 flex justify-center">
                      <div className="flex min-w-0 max-w-full flex-col items-center gap-1 rounded-xl bg-[#092A1E]/80 px-2 py-2">
                        <div aria-label="Photo position" className="flex max-w-full overflow-x-auto">
                          {images.map((path, index) => <button key={`position-${path}-${index}`} type="button" aria-label={`Go to announcement photo ${index + 1}`} aria-pressed={index === currentImage} onClick={() => setCurrentImage(index)} className="grid size-6 shrink-0 place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-white">
                            <span className={`size-2.5 rounded-full transition-colors ${index === currentImage ? "bg-[#F2C94C]" : "bg-white/65 hover:bg-white"}`} />
                          </button>)}
                        </div>
                        <div aria-label="Choose announcement photo" className="flex min-w-0 max-w-full gap-2 overflow-x-auto pb-1">
                          {images.map((path, index) => <button key={`${path}-${index}`} type="button" aria-label={`Show announcement photo ${index + 1}`} aria-pressed={index === currentImage} onClick={() => setCurrentImage(index)} className={`relative h-11 w-14 shrink-0 overflow-hidden rounded-md border-2 bg-[#DCE7DB] transition-colors focus-visible:outline-2 focus-visible:outline-white ${index === currentImage ? "border-[#F2C94C]" : "border-transparent hover:border-white"}`}>
                            <Image src={path} alt="" fill unoptimized sizes="56px" className="object-cover" />
                          </button>)}
                        </div>
                      </div>
                    </div>
                  </> : null}
                </div>
              </div>
            ) : null}

            <div className={`min-h-0 min-w-0 overflow-y-auto overscroll-contain p-5 sm:p-7 ${images.length ? "" : "row-span-2 md:col-span-2"}`}>
              <p className="pr-10 text-sm font-semibold text-[#365F4A]">{formatAnnouncementDate(announcementDate(post))}</p>
              <Dialog.Title className="mt-4 break-words pr-3 text-2xl font-black leading-tight text-[#073F2B] sm:text-3xl">{title}</Dialog.Title>
              {post.sourceUrl ? <a href={post.sourceUrl} target="_blank" rel="noopener noreferrer" className="public-action mt-5 inline-flex min-h-11 items-center gap-2 rounded-md bg-[#123D2A] px-3 text-sm font-semibold text-white hover:bg-[#1F6B43] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1F6B43]">View original post<ExternalLink aria-hidden="true" className="size-4" /></a> : null}
              <div className={`${styles.copy} quill-content mt-6 text-base text-[#123D2A]`} dangerouslySetInnerHTML={{ __html: content }} />
            </div>
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
