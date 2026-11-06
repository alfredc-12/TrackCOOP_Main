"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "motion/react";
import { ChevronDown, ImageOff, Images, Search } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { PaginationControls } from "@/components/portal/PortalPrimitives";
import { expressFetch } from "@/lib/express-api";
import { announcementContent, announcementDate, announcementImages, announcementPreview, announcementText, formatAnnouncementDate } from "../announcement-display";
import type { PublicAnnouncement } from "../types";
import { AnnouncementPostModal } from "./AnnouncementPostModal";

const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export default function AnnouncementsArchiveSection() {
  const reducedMotion = useReducedMotion();
  const [announcements, setAnnouncements] = useState<PublicAnnouncement[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<PublicAnnouncement | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("all");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const loadAnnouncements = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setLoadError(false);
    try {
      const response = await expressFetch("/api/announcements", { signal });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error("Announcements could not be loaded");
      if (!signal?.aborted) setAnnouncements((json.data as PublicAnnouncement[]).filter((post) => post.audienceType === "Public" && post.announcementStatus !== "Archived"));
    } catch {
      if (!signal?.aborted) setLoadError(true);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => void loadAnnouncements(controller.signal), 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [loadAnnouncements]);

  const query = searchQuery.toLowerCase();
  const filtered = announcements.filter((post) => {
    const matchesSearch = `${post.title ?? ""} ${announcementText(announcementContent(post))}`.toLowerCase().includes(query);
    const date = announcementDate(post);
    return matchesSearch && (selectedMonth === "all" || (date && new Date(date).getMonth() === Number(selectedMonth)));
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const page = Math.min(currentPage, totalPages);
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);

  function resetFilters() {
    setSearchQuery("");
    setSelectedMonth("all");
    setCurrentPage(1);
  }

  return (
    <>
      <section aria-labelledby="announcements-title" className="group relative min-h-[24rem] overflow-hidden bg-[#123D2A] px-5 pb-12 pt-28 text-white sm:px-8 lg:pb-14 lg:pt-32">
        <Image src="/images/Hero%20Page/Main%20Photo%204.jpg" alt="Cooperative members and activities" fill unoptimized priority sizes="100vw" className="public-hero-media object-cover object-[center_42%] opacity-70 transition-transform duration-700 motion-safe:group-hover:scale-[1.025]" />
        <div className="absolute inset-0 bg-[#052F22]/70" />
        <div className="relative z-10 mx-auto max-w-7xl">
          <p className="mb-4 text-xs font-bold uppercase tracking-[0.35em] text-[#F2C94C]">Cooperative updates</p>
          <h1 id="announcements-title" className="max-w-5xl text-4xl font-black leading-[1.05] sm:text-6xl lg:text-7xl">Announcements</h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-white/90 sm:text-lg sm:leading-8">News, notices, and stories from the cooperative.</p>
        </div>
      </section>
      <section aria-label="Browse announcements" className="flex-1 bg-[var(--public-canvas)] px-5 pb-14 pt-8 text-[#123D2A] sm:px-8 lg:pb-20 lg:pt-10">
        <div className="mx-auto max-w-7xl">
        <div className="public-card grid gap-4 p-4 sm:grid-cols-[minmax(0,1fr)_12rem] sm:p-5 lg:grid-cols-[minmax(0,1fr)_13rem_auto] lg:items-end">
          <label className="min-w-0 text-sm font-semibold text-[#365F4A]">Search announcements
            <span className="relative mt-2 block"><Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#1F6B43]" /><input type="search" placeholder="Search a title or post" value={searchQuery} onChange={(event) => { setSearchQuery(event.target.value); setCurrentPage(1); }} className="h-12 w-full min-w-0 rounded-md border border-[var(--public-card-border)] bg-white pl-10 pr-3 text-base font-normal text-[#123D2A] outline-none focus:border-[#1F6B43] focus:ring-2 focus:ring-[#1F6B43]/20" /></span>
          </label>
          <label className="text-sm font-semibold text-[#365F4A]">Month
            <span className="relative mt-2 block"><select value={selectedMonth} onChange={(event) => { setSelectedMonth(event.target.value); setCurrentPage(1); }} className="h-12 w-full appearance-none rounded-md border border-[var(--public-card-border)] bg-white pl-3 pr-10 text-base font-normal text-[#123D2A] outline-none focus:border-[#1F6B43] focus:ring-2 focus:ring-[#1F6B43]/20"><option value="all">All months</option>{months.map((month, index) => <option key={month} value={index}>{month}</option>)}</select><ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2" /></span>
          </label>
          <p aria-live="polite" className="text-sm text-[#365F4A] sm:col-span-2 lg:col-span-1 lg:px-3 lg:pb-4">{loading ? "Loading updates…" : `${filtered.length} result${filtered.length === 1 ? "" : "s"}`}</p>
        </div>

        {loading ? <div role="status" className="public-card mt-7 px-6 py-14 text-center font-semibold text-[#365F4A]">Loading announcements…</div>
          : loadError ? <div role="alert" className="public-card mt-7 px-6 py-12 text-center"><h2 className="text-xl font-bold">Unable to load announcements</h2><p className="mt-2 text-[#365F4A]">Please try again.</p><button type="button" onClick={() => void loadAnnouncements()} className="public-action mt-5 min-h-11 rounded-md bg-[#123D2A] px-5 text-sm font-bold text-white hover:bg-[#1F6B43]">Retry</button></div>
          : filtered.length === 0 ? <div className="public-card mt-7 px-6 py-12 text-center"><h2 className="text-xl font-bold">No announcements found</h2><p className="mx-auto mt-2 max-w-md leading-7 text-[#365F4A]">{announcements.length ? "Try another search or month to find a cooperative update." : "Public cooperative updates will appear here when published."}</p>{announcements.length ? <button type="button" onClick={resetFilters} className="public-action mt-5 min-h-11 rounded-md bg-[#123D2A] px-5 text-sm font-bold text-white hover:bg-[#1F6B43]">Clear all filters</button> : null}</div>
          : <>
            <div className="mt-7 grid items-stretch gap-6 md:grid-cols-2 xl:grid-cols-3">
              {visible.map((post, index) => <AnnouncementCard key={post.id} post={post} index={index} reducedMotion={Boolean(reducedMotion)} onOpen={() => setSelectedAnnouncement(post)} />)}
            </div>
            <PaginationControls
              currentPage={page}
              totalPages={totalPages}
              totalItems={filtered.length}
              itemName="announcements"
              onPageChange={setCurrentPage}
              pageSize={pageSize}
              pageSizeOptions={[6, 10, 20, 50]}
              onPageSizeChange={(nextPageSize) => { setPageSize(nextPageSize); setCurrentPage(1); }}
              centerControls
              className="mt-9 border-t border-[var(--public-card-border)] pt-5"
            />
          </>}
      </div>
      {selectedAnnouncement ? <AnnouncementPostModal key={selectedAnnouncement.id} post={selectedAnnouncement} onClose={() => setSelectedAnnouncement(null)} /> : null}
    </section>
    </>
  );
}

function AnnouncementCard({ post, index, reducedMotion, onOpen }: { post: PublicAnnouncement; index: number; reducedMotion: boolean; onOpen: () => void }) {
  const images = announcementImages(post);
  const [failed, setFailed] = useState(false);
  const title = post.title || "Cooperative announcement";
  return (
    <motion.article initial={{ opacity: reducedMotion ? 1 : 0, y: reducedMotion ? 0 : 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.08 }} transition={{ duration: 0.35, delay: reducedMotion ? 0 : index * 0.035 }} className="public-card public-card-link min-w-0">
      <button type="button" aria-label={`Read announcement: ${title}`} onClick={onOpen} className="group flex h-full w-full min-w-0 flex-col rounded-lg text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1F6B43]">
        <div className="public-media relative aspect-[16/10] w-full overflow-hidden rounded-t-lg bg-[#EAF3E8]">
          {images[0] && !failed ? <Image src={images[0]} alt="" fill unoptimized sizes="(min-width:1280px) 33vw, (min-width:768px) 50vw, 100vw" className="object-cover" onError={() => setFailed(true)} /> : <div className="absolute inset-0 flex items-center justify-center gap-3 text-[#365F4A]"><ImageOff aria-hidden="true" className="size-6" /><span className="text-sm font-semibold">Cooperative update</span></div>}
          {images.length > 1 ? <span className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-md bg-white px-2.5 py-1.5 text-xs font-bold text-[#123D2A]"><Images aria-hidden="true" className="size-3.5" />{images.length} photos</span> : null}
        </div>
        <div className="flex w-full min-w-0 flex-1 flex-col p-5 sm:p-6">
          <p className="text-sm font-semibold text-[#365F4A]">{formatAnnouncementDate(announcementDate(post))}</p>
          <h2 className="mt-3 line-clamp-2 break-words text-xl font-bold leading-snug text-[#123D2A]">{title}</h2>
          <p className="mt-3 line-clamp-2 text-base leading-7 text-[#365F4A]">{announcementPreview(post)}</p>
        </div>
      </button>
    </motion.article>
  );
}
