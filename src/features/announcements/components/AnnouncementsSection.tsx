"use client";

import { ArrowLeft, ArrowRight, ExternalLink, Megaphone, X, Share2, Copy, Check } from "lucide-react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { createPortal } from "react-dom";
import { useState, useEffect, useCallback } from "react";
import { env } from "@/config/env";

function formatDate(date?: string) {
  if (!date) return "Recent";

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));
}

function getPreview(content: string) {
  const tmp = typeof document !== "undefined" ? document.createElement("DIV") : null;
  if (tmp) {
    tmp.innerHTML = content;
    content = tmp.textContent || tmp.innerText || "";
  }
  if (content.length <= 140) return content;
  return `${content.slice(0, 140).trim()}...`;
}

export default function AnnouncementsSection() {
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [currentAnnouncement, setCurrentAnnouncement] = useState(0);
  const [currentImage, setCurrentImage] = useState(0);
  const [readMoreOpen, setReadMoreOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    if (readMoreOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [readMoreOpen]);

  useEffect(() => {
    fetch("/api/announcements")
      .then((res) => res.json())
      .then((json) => {
        if (json.success) {
          const publicAnns = json.data.filter((a: any) => a.audienceType === "Public" && a.announcementStatus !== "Archived") || [];
          setAnnouncements(publicAnns.slice(0, 3));
        }
      })
      .catch(console.error);
  }, []);

  const announcement = announcements[currentAnnouncement];
  const images = announcement?.featuredImagePath ? [announcement.featuredImagePath] : [];
  const hasImages = images.length > 0;

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

  function nextImage() {
    setCurrentImage((index) => (index + 1) % images.length);
  }

  function prevImage() {
    setCurrentImage((index) => (index - 1 + images.length) % images.length);
  }

  useEffect(() => {
    if (isHovered || readMoreOpen || announcements.length <= 1) return;
    const interval = setInterval(nextAnnouncement, 5000);
    return () => clearInterval(interval);
  }, [isHovered, readMoreOpen, announcements.length, nextAnnouncement]);

  if (!announcement) return null;

  return (
    <section className="h-full bg-[#FFFAF2] p-5 text-[#123D2A] sm:p-6">
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between gap-4">
          <h2 className="inline-flex items-center gap-3 text-2xl font-semibold tracking-tight text-[#123D2A]">
            Latest Cooperative Updates
            <span className="grid size-10 place-items-center rounded-full bg-[#EAF3E8] text-[#1F6B43] ring-1 ring-[#1F6B43]/15">
              <Megaphone className="size-5" />
            </span>
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

        <article 
          className="relative mt-5 flex min-h-[430px] flex-1 overflow-hidden rounded-[16px] border border-[#CFE0C8] bg-[#123D2A] shadow-[0_28px_80px_rgba(31,107,67,0.42)]"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(242,201,76,0.28),transparent_34%),linear-gradient(135deg,#EAF3E8,#FFFAF2)]">
            <AnimatePresence mode="wait">
              <motion.div 
                key={currentAnnouncement}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.6 }}
                className="absolute inset-0"
              >
                {hasImages ? (
                  images.map((image, index) => (
                    <Image
                      key={`${announcement.id}-${image}`}
                      src={`${env.apiUrl}${image}`}
                      alt={announcement.title}
                      fill
                      unoptimized
                      sizes="(max-width: 1024px) 100vw, 33vw"
                      className={`object-cover transition duration-700 ${
                        index === currentImage ? "opacity-100" : "opacity-0"
                      }`}
                    />
                  ))
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center opacity-30">
                    <Megaphone className="size-40 text-[#1F6B43]" />
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="absolute inset-0 bg-gradient-to-t from-[#03291d]/92 via-[#03291d]/32 to-transparent pointer-events-none" />
          <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-[#03291d]/42 to-transparent pointer-events-none" />

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

          <div className="absolute inset-x-0 bottom-0 p-5 text-white sm:p-6 pointer-events-none">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentAnnouncement}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -20, opacity: 0 }}
                transition={{ duration: 0.4 }}
              >
                <div className="mb-3 flex items-center justify-between gap-4 pointer-events-auto">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#F2C94C]">
                    {formatDate(announcement.createdAt)}
                  </p>
                  {announcement.sourceUrl && (
                    <a
                      href={announcement.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      aria-label="View original announcement post"
                      className="grid size-10 shrink-0 place-items-center rounded-full border border-white/20 bg-white/14 text-white shadow-[0_12px_30px_rgba(0,0,0,0.18)] backdrop-blur transition hover:-translate-y-0.5 hover:bg-white hover:text-[#123D2A]"
                    >
                      <ExternalLink className="size-4" />
                    </a>
                  )}
                </div>
                <p className="text-sm leading-6 text-white/88 pointer-events-auto">
                  {getPreview(announcement.message)}
                  <button
                    onClick={() => setReadMoreOpen(true)}
                    className="ml-2 font-bold text-[#F2C94C] hover:underline whitespace-nowrap"
                  >
                    Read more
                  </button>
                </p>
              </motion.div>
            </AnimatePresence>
          </div>
        </article>
        
        <div className="mt-6">
          <a
            href="/announcements"
            className="inline-flex w-full items-center justify-center rounded-full bg-[#1F6B43] px-6 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#123D2A]"
          >
            View All Announcements
            <ArrowRight className="ml-2 size-4" />
          </a>
        </div>
      </div>

      {typeof document !== "undefined" && readMoreOpen
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
                      onClick={(event: React.MouseEvent) => event.stopPropagation()}
                    >
                      <div className="absolute right-4 top-4 z-20 flex items-center gap-2">
                        <motion.button
                          type="button"
                          aria-label="Copy announcement text"
                          onClick={(event: React.MouseEvent) => {
                            event.stopPropagation();
                            const tempDiv = document.createElement('div');
                            tempDiv.innerHTML = announcement.message;
                            const plainMessage = tempDiv.textContent || tempDiv.innerText || '';
                            navigator.clipboard.writeText(plainMessage.trim());
                            setIsCopied(true);
                            setTimeout(() => setIsCopied(false), 2000);
                          }}
                          className="grid size-11 place-items-center rounded-full border border-white/20 bg-black/20 text-white backdrop-blur-md transition hover:bg-white hover:text-[#123D2A]"
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          transition={{ duration: 0.18, ease: "easeOut", delay: 0.05 }}
                        >
                          {isCopied ? <Check className="size-5 text-green-400" /> : <Copy className="size-5" />}
                        </motion.button>

                        <motion.button
                          type="button"
                          aria-label="Close announcement"
                          onClick={(event: React.MouseEvent) => {
                            event.stopPropagation();
                            setReadMoreOpen(false);
                          }}
                          className="grid size-11 place-items-center rounded-full border border-white/20 bg-black/20 text-white backdrop-blur-md transition hover:bg-white hover:text-[#123D2A]"
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          transition={{ duration: 0.18, ease: "easeOut" }}
                        >
                          <X className="size-5" />
                        </motion.button>
                      </div>

                      <div className="flex flex-col">
                        <div className="relative h-64 sm:h-80 bg-[#123D2A] shrink-0">
                          {images.length > 0 ? (
                            images.map((image, index) => (
                              <Image
                                key={`modal-${announcement.id}-${image}`}
                                src={`${env.apiUrl}${image}`}
                                alt=""
                                fill
                                unoptimized
                                sizes="(max-width: 1024px) 100vw, 58vw"
                                className={`object-cover transition duration-500 opacity-100`}
                              />
                            ))
                          ) : (
                            <div className="absolute inset-0 bg-[linear-gradient(135deg,#EAF3E8,#FFFAF2)] flex items-center justify-center">
                               <Megaphone className="size-20 text-[#1F6B43]/20" />
                            </div>
                          )}
                          
                          <div className="absolute inset-0 bg-gradient-to-t from-[#03291d]/90 via-[#03291d]/40 to-transparent pointer-events-none" />
                          <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8 flex items-end justify-between gap-6 pointer-events-none">
                            {announcement.title && (
                              <h2 className="text-2xl font-black text-white sm:text-3xl leading-tight drop-shadow-md line-clamp-3">
                                {announcement.title}
                              </h2>
                            )}
                            <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#F2C94C] shrink-0 drop-shadow-md text-right">
                              {formatDate(announcement.createdAt)}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-col p-6 sm:p-8 max-h-[60vh] overflow-y-auto">
                          <div 
                            className="whitespace-pre-line text-base leading-relaxed text-[#123D2A] quill-content"
                            dangerouslySetInnerHTML={{ __html: announcement.message }}
                          />
                        </div>
                      </div>
                    </motion.article>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>,
            document.body
          )
        : null}
    </section>
  );
}
