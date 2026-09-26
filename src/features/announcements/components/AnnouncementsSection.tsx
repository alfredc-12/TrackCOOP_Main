"use client";

import {
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  ExternalLink,
  Megaphone,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { expressFetch } from "@/lib/express-api";
import { resolveUploadUrl } from "@/lib/upload-url";

const PHOTO_PROGRESS_DURATION_MS = 5500;

type PublicAnnouncement = {
  id: string | number;
  title?: string;
  message?: string;
  content?: string;
  createdAt?: string;
  postedAt?: string;
  featuredImagePath?: string | null;
  images?: string[];
  sourceUrl?: string | null;
  audienceType?: string;
  announcementStatus?: string;
};

function formatDate(date?: string) {
  if (!date) return "Recent";

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));
}

function stripHtml(content: string) {
  if (typeof document === "undefined") {
    return content.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  }

  const tmp = document.createElement("div");
  tmp.innerHTML = content;
  return (tmp.textContent || tmp.innerText || "").replace(/\s+/g, " ").trim();
}

function getPreview(content: string) {
  const text = stripHtml(content);
  if (text.length <= 140) return text;
  return `${text.slice(0, 140).trim()}...`;
}

function getAnnouncementContent(announcement?: PublicAnnouncement) {
  return announcement?.message ?? announcement?.content ?? "";
}

function getAnnouncementDate(announcement?: PublicAnnouncement) {
  return announcement?.createdAt ?? announcement?.postedAt;
}

function resolveImagePath(path?: string | null) {
  return resolveUploadUrl(path) || null;
}

export default function AnnouncementsSection() {
  const [announcements, setAnnouncements] =
    useState<PublicAnnouncement[]>([]);
  const [currentAnnouncement, setCurrentAnnouncement] = useState(0);
  const [currentImage, setCurrentImage] = useState(0);
  const [progressReplayKey, setProgressReplayKey] = useState(0);
  const [readMoreOpen, setReadMoreOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const loadAnnouncements = useCallback(async () => {
    setIsLoading(true);
    setLoadError(false);
    try {
      const res = await expressFetch("/api/announcements");
      const json = await res.json();
      if (!json.success) throw new Error("Failed to load announcements");
      const publicAnnouncements = (json.data ?? []).filter(
        (item: PublicAnnouncement) =>
          item.audienceType === "Public" && item.announcementStatus !== "Archived",
      );
      setAnnouncements(publicAnnouncements.slice(0, 4));
      setCurrentAnnouncement(0);
      setCurrentImage(0);
    } catch {
      setAnnouncements([]);
      setLoadError(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadAnnouncements(), 0);
    return () => window.clearTimeout(timer);
  }, [loadAnnouncements]);

  useEffect(() => {
    if (!readMoreOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [readMoreOpen]);

  const announcement = announcements[currentAnnouncement];
  const content = getAnnouncementContent(announcement);
  const rawImages =
    announcement?.images && announcement.images.length > 0
      ? announcement.images
      : announcement?.featuredImagePath
        ? [announcement.featuredImagePath]
        : [];
  const images = rawImages
    .map((image) => resolveImagePath(image))
    .filter((image): image is string => Boolean(image));
  const hasImages = images.length > 0;
  const hasMultipleImages = images.length > 1;

  const nextAnnouncement = useCallback(() => {
    setCurrentImage(0);
    setCurrentAnnouncement((index) => (index + 1) % announcements.length);
  }, [announcements.length]);

  function prevAnnouncement() {
    setCurrentImage(0);
    setCurrentAnnouncement(
      (index) => (index - 1 + announcements.length) % announcements.length,
    );
  }

  useEffect(() => {
    if (!hasMultipleImages || readMoreOpen) return;

    const timeout = window.setTimeout(() => {
      if (currentImage >= images.length - 1) {
        nextAnnouncement();
      } else {
        setCurrentImage((index) => Math.min(index + 1, images.length - 1));
      }
    }, PHOTO_PROGRESS_DURATION_MS);

    return () => window.clearTimeout(timeout);
  }, [
    currentAnnouncement,
    currentImage,
    hasMultipleImages,
    images.length,
    nextAnnouncement,
    progressReplayKey,
    readMoreOpen,
  ]);

  useEffect(() => {
    if (
      isHovered ||
      readMoreOpen ||
      hasMultipleImages ||
      announcements.length <= 1
    ) {
      return;
    }

    const interval = window.setInterval(nextAnnouncement, 5000);
    return () => window.clearInterval(interval);
  }, [
    announcements.length,
    hasMultipleImages,
    isHovered,
    nextAnnouncement,
    readMoreOpen,
  ]);

  if (isLoading) {
    return <section aria-busy="true" aria-live="polite" className="relative h-full min-h-[18rem] overflow-hidden rounded-2xl bg-[#123D2A]"><div className="absolute inset-0 animate-pulse bg-white/10" /><p className="absolute inset-0 grid place-items-center text-sm font-bold text-white">Loading announcements...</p></section>;
  }

  if (loadError) {
    return <section role="alert" aria-live="assertive" className="relative grid min-h-[18rem] place-items-center overflow-hidden rounded-2xl bg-[#123D2A] p-6 text-center text-white"><div><p className="font-bold">Unable to load announcements.</p><button type="button" onClick={() => void loadAnnouncements()} className="mt-3 rounded-lg bg-white px-4 py-2 text-sm font-bold text-[#123D2A]">Retry</button></div></section>;
  }

  if (!announcement) return null;

  return (
    <section className="relative h-full overflow-hidden bg-[#123D2A] text-white">
      <div className="relative h-full min-h-0">
        <div className="absolute left-3 right-3 top-3 z-20 flex min-h-10 items-center justify-between gap-3 rounded-full border border-white/70 bg-[#FFFAF2]/92 px-2 py-2 text-[#123D2A] shadow-[0_18px_42px_rgba(3,41,29,0.22)] backdrop-blur-md sm:left-4 sm:right-4 sm:top-4 sm:px-2.5 [@media(max-height:430px)]:left-2.5 [@media(max-height:430px)]:right-2.5 [@media(max-height:430px)]:top-2.5 [@media(max-height:430px)]:py-1.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#EAF3E8] text-[#1F6B43] shadow-[0_8px_20px_rgba(31,107,67,0.10)] ring-1 ring-[#1F6B43]/15 sm:size-9 md:size-10 [@media(max-height:430px)]:size-8">
              <Megaphone className="size-4 md:size-5 [@media(max-height:430px)]:size-4" />
            </span>
            <h2 className="truncate text-base font-extrabold leading-none text-[#123D2A] sm:text-lg md:text-xl">
              Announcements
            </h2>
          </div>
          <div className="flex shrink-0 gap-1.5">
            <button
              type="button"
              aria-label="Previous announcement"
              onClick={prevAnnouncement}
              className="grid size-8 shrink-0 place-items-center rounded-full border border-[#1F6B43]/15 bg-[#EAF3E8] text-[#123D2A] shadow-[0_8px_20px_rgba(18,61,42,0.10)] transition hover:-translate-y-0.5 hover:bg-[#123D2A] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1F6B43] sm:size-9 md:size-10 [@media(max-height:430px)]:size-8"
            >
              <ArrowLeft className="size-4" />
            </button>
            <button
              type="button"
              aria-label="Next announcement"
              onClick={nextAnnouncement}
              className="grid size-8 shrink-0 place-items-center rounded-full border border-[#1F6B43]/15 bg-[#EAF3E8] text-[#123D2A] shadow-[0_8px_20px_rgba(18,61,42,0.10)] transition hover:-translate-y-0.5 hover:bg-[#123D2A] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1F6B43] sm:size-9 md:size-10 [@media(max-height:430px)]:size-8"
            >
              <ArrowRight className="size-4" />
            </button>
          </div>
        </div>

        <article
          className="group absolute inset-0 cursor-pointer overflow-hidden bg-[#123D2A] shadow-[0_28px_76px_rgba(18,61,42,0.24)]"
          onClick={() => setReadMoreOpen(true)}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={`${announcement.id}-${currentImage}`}
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.45 }}
            >
              {hasImages ? (
                <img
                  src={images[currentImage]}
                  alt={announcement.title ?? "Announcement photo"}
                  className="absolute inset-0 h-full w-full object-cover brightness-110 contrast-105 transition duration-700 group-hover:scale-[1.03]"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-[#123D2A] opacity-40">
                  <Megaphone className="size-40 text-[#EAF3E8]" />
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(3,41,29,0.02)_0%,rgba(3,41,29,0.04)_34%,rgba(3,41,29,0.46)_100%)]" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[62%] bg-[radial-gradient(circle_at_18%_78%,rgba(242,201,76,0.18),transparent_30%),linear-gradient(0deg,rgba(3,41,29,0.96)_0%,rgba(3,41,29,0.78)_52%,transparent_100%)]" />

          {hasMultipleImages ? (
            <div className="absolute left-4 right-4 top-[5rem] z-10 flex gap-1.5 rounded-full bg-[#123D2A]/38 px-2 py-2 shadow-[0_10px_24px_rgba(0,0,0,0.16)] backdrop-blur-md sm:top-[5.5rem] [@media(max-height:430px)]:left-3 [@media(max-height:430px)]:right-3 [@media(max-height:430px)]:top-[4.5rem]">
                {images.map((image, index) => (
                  <button
                    key={`${image}-${index}`}
                    type="button"
                    aria-label={`Show announcement photo ${index + 1} of ${images.length}`}
                    aria-current={currentImage === index ? "true" : undefined}
                    onClick={(event) => {
                      event.stopPropagation();
                      setProgressReplayKey((key) => key + 1);
                      setCurrentImage(index);
                    }}
                    className="group/progress flex h-5 min-w-0 flex-1 items-center rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                  >
                    <span className="block h-1 w-full overflow-hidden rounded-full bg-white/38 shadow-[0_1px_6px_rgba(0,0,0,0.18)] transition group-hover/progress:bg-white/52">
                      <span
                        key={
                          index === currentImage
                            ? `${announcement.id}-${currentImage}-${progressReplayKey}`
                            : `${announcement.id}-${index}`
                        }
                        className={`block h-full w-full rounded-full ${
                          index === currentImage
                            ? "bg-[#F2C94C]"
                            : "bg-white"
                        }`}
                        style={{
                          animation:
                            index === currentImage
                              ? `announcement-photo-progress ${PHOTO_PROGRESS_DURATION_MS}ms linear forwards`
                              : undefined,
                          transform:
                            index < currentImage ? "scaleX(1)" : "scaleX(0)",
                          transformOrigin: "left",
                          width: "100%",
                        }}
                      />
                    </span>
                  </button>
                ))}
              </div>
          ) : null}

          <div className="absolute inset-x-0 bottom-0 p-4 pr-16 text-white sm:p-6 sm:pr-20 lg:p-6 lg:pr-20 xl:p-7 xl:pr-20 [@media(max-height:620px)]:p-5 [@media(max-height:620px)]:pr-16 [@media(max-height:430px)]:p-4 [@media(max-height:430px)]:pr-14">
            <div className="mb-5 [@media(max-height:620px)]:mb-3 [@media(max-height:430px)]:mb-2">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.28em] text-[#F2C94C] drop-shadow-[0_2px_8px_rgba(0,0,0,0.45)] sm:text-xs">
                {formatDate(getAnnouncementDate(announcement))}
              </p>
            </div>
            <p className="line-clamp-3 text-sm font-semibold leading-6 text-white drop-shadow-[0_3px_14px_rgba(0,0,0,0.50)] sm:text-base sm:leading-7 [@media(max-height:620px)]:text-sm [@media(max-height:620px)]:leading-6">
              {announcement.title ?? getPreview(content)}
              {content ? (
                <span className="font-medium text-white/88">
                  {" "}
                  {getPreview(content)}
                </span>
              ) : null}
            </p>
            <a
              href={announcement.sourceUrl ?? "/announcements"}
              target={announcement.sourceUrl ? "_blank" : undefined}
              rel={announcement.sourceUrl ? "noreferrer" : undefined}
              aria-label={
                announcement.sourceUrl
                  ? "View original announcement post"
                  : "View all announcements"
              }
              onClick={(event) => event.stopPropagation()}
              className="absolute bottom-4 right-4 grid size-11 place-items-center rounded-full border border-white/18 bg-white/20 text-white shadow-[0_14px_34px_rgba(0,0,0,0.20)] backdrop-blur-md transition hover:-translate-y-0.5 hover:bg-white hover:text-[#123D2A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:bottom-6 sm:right-6 [@media(max-height:620px)]:bottom-5 [@media(max-height:620px)]:right-5 [@media(max-height:430px)]:bottom-4 [@media(max-height:430px)]:right-4 [@media(max-height:430px)]:size-10"
            >
              <ExternalLink className="size-4" />
            </a>
          </div>
        </article>
      </div>

      {typeof document !== "undefined"
        ? createPortal(
            <AnimatePresence>
              {readMoreOpen ? (
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
                  onClick={() => setReadMoreOpen(false)}
                >
                  <div className="flex min-h-full items-center justify-center py-10">
                    <motion.article
                      className="relative w-full max-w-4xl overflow-hidden rounded-2xl border border-[#DDE8D8] bg-[#FFFAF2] shadow-[0_20px_60px_rgba(0,0,0,0.22)]"
                      initial={{ opacity: 0, y: 24, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 14, scale: 0.97 }}
                      transition={{ duration: 0.26, ease: "easeOut" }}
                      onClick={(event) => event.stopPropagation()}
                    >
                      <div className="absolute right-4 top-4 z-20 flex items-center gap-2">
                        <button
                          type="button"
                          aria-label="Copy announcement text"
                          onClick={(event) => {
                            event.stopPropagation();
                            void navigator.clipboard.writeText(stripHtml(content));
                            setIsCopied(true);
                            window.setTimeout(() => setIsCopied(false), 2000);
                          }}
                          className="grid size-11 place-items-center rounded-full border border-white/20 bg-black/20 text-white backdrop-blur-md transition hover:bg-white hover:text-[#123D2A]"
                        >
                          {isCopied ? (
                            <Check className="size-5 text-green-400" />
                          ) : (
                            <Copy className="size-5" />
                          )}
                        </button>
                        <button
                          type="button"
                          aria-label="Close announcement"
                          onClick={(event) => {
                            event.stopPropagation();
                            setReadMoreOpen(false);
                          }}
                          className="grid size-11 place-items-center rounded-full border border-white/20 bg-black/20 text-white backdrop-blur-md transition hover:bg-white hover:text-[#123D2A]"
                        >
                          <X className="size-5" />
                        </button>
                      </div>

                      <div className="flex flex-col">
                        <div className="relative h-64 shrink-0 bg-[#123D2A] sm:h-80">
                          {hasImages ? (
                            <img
                              src={images[currentImage]}
                              alt={announcement.title ?? "Announcement photo"}
                              className="absolute inset-0 h-full w-full object-cover"
                            />
                          ) : (
                            <div className="absolute inset-0 flex items-center justify-center bg-[linear-gradient(135deg,#EAF3E8,#FFFAF2)]">
                              <Megaphone className="size-20 text-[#1F6B43]/20" />
                            </div>
                          )}
                          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#03291d]/90 via-[#03291d]/40 to-transparent" />
                          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-6 p-6 sm:p-8">
                            <h2 className="line-clamp-3 text-2xl font-black leading-tight text-white drop-shadow-md sm:text-3xl">
                              {announcement.title ?? "Announcement"}
                            </h2>
                            <p className="shrink-0 text-right text-xs font-bold uppercase tracking-[0.24em] text-[#F2C94C] drop-shadow-md">
                              {formatDate(getAnnouncementDate(announcement))}
                            </p>
                          </div>
                        </div>

                        <div className="max-h-[60vh] overflow-y-auto p-6 sm:p-8">
                          <div
                            className="quill-content whitespace-pre-line text-base leading-relaxed text-[#123D2A]"
                            dangerouslySetInnerHTML={{ __html: content }}
                          />
                        </div>
                      </div>
                    </motion.article>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>,
            document.body,
          )
        : null}
    </section>
  );
}
