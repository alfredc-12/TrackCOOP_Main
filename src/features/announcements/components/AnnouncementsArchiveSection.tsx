"use client";

import { AnimatePresence, motion } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  Megaphone,
  X,
  Search,
  Filter,
  Share2,
  Copy,
  Check
} from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { getAnnouncements } from "../service";
import { env } from "@/config/env";

function getPreview(content: string) {
  const tmp = typeof document !== "undefined" ? document.createElement("DIV") : null;
  if (tmp) {
    tmp.innerHTML = content;
    content = tmp.textContent || tmp.innerText || "";
  }
  if (content.length <= 140) return content;
  return `${content.slice(0, 140).trim()}...`;
}

function formatDate(date?: string) {
  if (!date) return "Recent";

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));
}

export default function AnnouncementsArchiveSection() {
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [isCopied, setIsCopied] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<any | null>(null);
  const [currentImage, setCurrentImage] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("all");
  
  const modalImages = selectedAnnouncement?.featuredImagePath ? [selectedAnnouncement.featuredImagePath] : [];

  useEffect(() => {
    fetch("/api/announcements")
      .then((res) => res.json())
      .then((json) => {
        if (json.success) {
          setAnnouncements(json.data.filter((a: any) => a.audienceType === "Public" && a.announcementStatus !== "Archived") || []);
        }
      })
      .catch(console.error);
  }, []);

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
    if (selectedAnnouncement) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
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
      <section className="bg-[#FFFAF2] py-12 text-[#123D2A] lg:py-16">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="flex flex-col gap-4 sm:gap-6">
            <div className="flex items-center gap-4">
              <div className="grid size-16 shrink-0 place-items-center rounded-full bg-[#EAF3E8] text-[#1F6B43] ring-1 ring-[#1F6B43]/15">
                <Megaphone className="size-8" />
              </div>
              <p className="text-xs font-bold uppercase tracking-[0.45em] text-[#f4b62a]">
                Announcements
              </p>
            </div>
            <h1 className="max-w-5xl text-5xl font-black leading-[0.98] tracking-normal text-[#073f2b] md:text-7xl lg:text-8xl">
              Latest cooperative updates.
            </h1>
          </div>
          
          <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-[#1F6B43]/60" />
              <input 
                type="text" 
                placeholder="Search announcements..." 
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full rounded-full border border-[#CFE0C8] bg-white py-3 pl-11 pr-4 text-sm outline-none transition focus:border-[#1F6B43] focus:ring-1 focus:ring-[#1F6B43]"
              />
            </div>
            
            <div className="relative w-full sm:w-48">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-[#1F6B43]/60" />
              <select 
                value={selectedMonth}
                onChange={(e) => {
                  setSelectedMonth(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full appearance-none rounded-full border border-[#CFE0C8] bg-white py-3 pl-11 pr-10 text-sm outline-none transition focus:border-[#1F6B43] focus:ring-1 focus:ring-[#1F6B43]"
              >
                <option value="all">All Months</option>
                <option value="0">January</option>
                <option value="1">February</option>
                <option value="2">March</option>
                <option value="3">April</option>
                <option value="4">May</option>
                <option value="5">June</option>
                <option value="6">July</option>
                <option value="7">August</option>
                <option value="8">September</option>
                <option value="9">October</option>
                <option value="10">November</option>
                <option value="11">December</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center">
                <svg className="size-4 text-[#123D2A]/60" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
              </div>
            </div>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {(() => {
              const filteredAnnouncements = announcements.filter((a: any) => {
                const matchesSearch = a.title?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                      a.message?.toLowerCase().includes(searchQuery.toLowerCase());
                
                if (!matchesSearch) return false;
                
                if (selectedMonth !== "all") {
                  const date = new Date(a.createdAt);
                  return date.getMonth() === parseInt(selectedMonth);
                }
                
                return true;
              });

              if (filteredAnnouncements.length === 0) {
                return (
                  <div className="col-span-full py-20 text-center flex flex-col items-center justify-center">
                    <div className="mb-4 grid size-20 place-items-center rounded-full bg-[#EAF3E8] text-[#1F6B43]">
                      <Search className="size-8" />
                    </div>
                    <h3 className="text-xl font-bold text-[#123D2A]">No announcements found</h3>
                    <p className="mt-2 max-w-md text-[#123D2A]/70">
                      We couldn't find any announcements matching your search or filters. Try adjusting them to see more results.
                    </p>
                    <button 
                      onClick={() => {
                        setSearchQuery("");
                        setSelectedMonth("all");
                      }}
                      className="mt-6 font-bold text-[#1F6B43] hover:underline"
                    >
                      Clear all filters
                    </button>
                  </div>
                );
              }

              const itemsPerPage = 6;
              const totalPages = Math.max(1, Math.ceil(filteredAnnouncements.length / itemsPerPage));
              const current = Math.min(currentPage, totalPages);
              const paginatedAnnouncements = filteredAnnouncements.slice((current - 1) * itemsPerPage, current * itemsPerPage);
              
              return (
                <>
                  {paginatedAnnouncements.map((announcement: any, i) => {
                    const coverImage = announcement.featuredImagePath;

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
                            src={`${env.apiUrl}${coverImage}`}
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
                            {formatDate(announcement.createdAt)}
                          </p>
                          <p className="mt-4 text-sm leading-6 text-white/90">
                            {getPreview(announcement.message)}
                          </p>
                          <span className="mt-5 inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-white">
                            Read post
                          </span>
                        </div>
                      </button>
                    );
                  })}
                  
                  <div className="col-span-full mt-8 flex items-center justify-center gap-2 pt-6">
                    <button 
                      onClick={() => setCurrentPage(1)} 
                      disabled={current === 1} 
                      className="grid size-10 place-items-center rounded-md border border-[#CFE0C8] text-[#123D2A] disabled:opacity-50 hover:bg-[#EEF2EC] font-bold text-sm transition"
                    >
                      &lt;&lt;
                    </button>
                    <button 
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} 
                      disabled={current === 1} 
                      className="grid size-10 place-items-center rounded-md border border-[#CFE0C8] text-[#123D2A] disabled:opacity-50 hover:bg-[#EEF2EC] font-bold text-sm transition"
                    >
                      &lt;
                    </button>
                    <span className="text-sm font-semibold text-[#123D2A] px-4">
                      Page {current} of {totalPages}
                    </span>
                    <button 
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} 
                      disabled={current === totalPages} 
                      className="grid size-10 place-items-center rounded-md border border-[#CFE0C8] text-[#123D2A] disabled:opacity-50 hover:bg-[#EEF2EC] font-bold text-sm transition"
                    >
                      &gt;
                    </button>
                    <button 
                      onClick={() => setCurrentPage(totalPages)} 
                      disabled={current === totalPages} 
                      className="grid size-10 place-items-center rounded-md border border-[#CFE0C8] text-[#123D2A] disabled:opacity-50 hover:bg-[#EEF2EC] font-bold text-sm transition"
                    >
                      &gt;&gt;
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      </section>

      {typeof document !== "undefined"
        ? createPortal(
            <AnimatePresence>
              {selectedAnnouncement ? (
                <motion.div
                  key="announcement-archive-modal"
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
                            tempDiv.innerHTML = selectedAnnouncement.message;
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
                            setSelectedAnnouncement(null);
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
                        <div className="relative h-64 sm:h-96 md:h-[450px] bg-[#123D2A] shrink-0">
                          {modalImages.length > 0 ? (
                            modalImages.map((image, index) => (
                              <Image
                                key={`modal-${selectedAnnouncement.id}-${image}`}
                                src={`${env.apiUrl}${image}`}
                                alt=""
                                fill
                                unoptimized
                                sizes="(max-width: 1024px) 100vw, 896px"
                                className={`object-cover transition duration-500 opacity-100 ${
                                  currentImage === index
                                    ? "opacity-100"
                                    : "opacity-0"
                                }`}
                              />
                            ))
                          ) : (
                            <div className="absolute inset-0 bg-[linear-gradient(135deg,#EAF3E8,#FFFAF2)] flex items-center justify-center">
                               <Megaphone className="size-20 text-[#1F6B43]/20" />
                            </div>
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
                          
                          <div className="absolute inset-0 bg-gradient-to-t from-[#03291d]/90 via-[#03291d]/40 to-transparent pointer-events-none" />
                          <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8 flex items-end justify-between gap-6 pointer-events-none">
                            {selectedAnnouncement.title && (
                              <h2 className="text-2xl font-black text-white sm:text-3xl leading-tight drop-shadow-md line-clamp-3">
                                {selectedAnnouncement.title}
                              </h2>
                            )}
                            <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#F2C94C] shrink-0 drop-shadow-md text-right">
                              {formatDate(selectedAnnouncement.createdAt)}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-col p-6 sm:p-8 max-h-[50vh] overflow-y-auto">
                          <div className="flex items-start justify-between gap-4">
                            {selectedAnnouncement.sourceUrl && (
                              <a
                                href={selectedAnnouncement.sourceUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 rounded-full border border-[#CFE0C8] bg-[#EAF3E8] px-4 py-1.5 text-xs font-bold text-[#1F6B43] transition hover:bg-[#1F6B43] hover:text-white"
                              >
                                View Source <ExternalLink className="size-3" />
                              </a>
                            )}
                          </div>

                          <div 
                            className="mt-6 whitespace-pre-line text-base leading-relaxed text-[#123D2A] quill-content"
                            dangerouslySetInnerHTML={{ __html: selectedAnnouncement.message }}
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
    </>
  );
}
