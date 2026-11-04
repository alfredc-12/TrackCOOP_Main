"use client";
import Image from "next/image";
import { Images, Info, LayoutGrid, Megaphone, Pencil, Eye } from "lucide-react";
import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { resolveUploadUrl } from "@/lib/upload-url";
import type { LibraryGroup, LibraryPhoto } from "./gallery-client";
import styles from "./GalleryWorkspace.module.css";
export function PhotoGroupStack({
  group,
  onSelect,
  onBrowse,
  onManage,
  onPreview,
  onDrag,
  failed,
  onFailed,
}: {
  group: LibraryGroup;
  onSelect: (p: LibraryPhoto) => void;
  onBrowse: () => void;
  onManage: () => void;
  onPreview: () => void;
  onDrag: (p: LibraryPhoto) => void;
  failed: Set<string>;
  onFailed: (id: string) => void;
}) {
  const [metadata, setMetadata] = useState<{
    left: number;
    top: number;
  } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const container = useRef<HTMLElement>(null);
  const dragging = useRef(false);
  const infoId = useId();
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const summary = `${group.source === "gallery" ? "Gallery" : "Announcement"}: ${group.title}. ${group.photoCount} photos. ${group.dateLabel} ${new Date(group.date).toLocaleDateString("en-PH", { timeZone: "Asia/Manila" })}. ${group.status}.${group.eligible ? "" : " Not available for landing placement."}`;
  function close() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setMetadata(null);
  }
  function show() {
    if (dragging.current || !container.current) return;
    const r = container.current.getBoundingClientRect();
    setMetadata({
      left: Math.max(8, Math.min(r.left, window.innerWidth - 288)),
      top: Math.max(8, r.top - 90),
    });
  }
  return (
    <article
      ref={container}
      aria-label={`${group.source}: ${group.title}`}
      className={`${styles.stack} ${group.source === "announcement" ? styles.announcement : styles.gallery}`}
      style={
        { "--photo-count": Math.min(7, group.photoCount) } as CSSProperties
      }
      onPointerEnter={(e) => {
        if (e.pointerType === "mouse") {
          close();
          timer.current = setTimeout(show, 300);
        }
      }}
      onPointerLeave={close}
      onFocusCapture={(event) => {
        if ((event.target as HTMLElement).matches(":focus-visible")) show();
      }}
      onKeyDownCapture={(event) => {
        if (event.key === "Escape") close();
      }}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) close();
      }}
      onDragStartCapture={() => {
        dragging.current = true;
        close();
      }}
      onDragEndCapture={() => {
        dragging.current = false;
        close();
      }}
    >
      <p id={infoId} className="sr-only">
        {summary}
      </p>
      <div className={styles.spread}>
        {group.photos.map((p, index) => (
          <button
            key={p.id}
            type="button"
            draggable={p.eligible && !failed.has(p.id)}
            disabled={!p.eligible || failed.has(p.id)}
            aria-label={`Select photo ${index + 1} from ${group.title}`}
            aria-describedby={infoId}
            className={styles.photo}
            style={{ "--tilt": `${((index % 3) - 1) * 3}deg` } as CSSProperties}
            onClick={() => onSelect(p)}
            onDragStart={(e) => {
              if (!p.eligible || failed.has(p.id)) {
                e.preventDefault();
                return;
              }
              onDrag(p);
              e.dataTransfer.setData("application/x-trackcoop-photo", p.id);
              e.dataTransfer.effectAllowed = "copyMove";
            }}
          >
            {failed.has(p.id) ? (
              <span className={styles.missing}>Photo unavailable</span>
            ) : (
              <Image
                src={resolveUploadUrl(p.thumbnailPath || p.imagePath)}
                alt={p.altText}
                width={112}
                height={104}
                unoptimized
                draggable={false}
                onError={() => onFailed(p.id)}
              />
            )}
          </button>
        ))}
      </div>
      <div className={styles.stackActions}>
        <button
          type="button"
          title="Group information"
          aria-label={`Information about ${group.title}`}
          aria-expanded={Boolean(metadata)}
          onClick={() => (metadata ? close() : show())}
        >
          <Info aria-hidden="true" size={16} />
        </button>
        <button
          type="button"
          title="Browse all photos"
          aria-label={`Browse all ${group.photoCount} photos from ${group.title}`}
          onClick={onBrowse}
        >
          <LayoutGrid aria-hidden="true" size={16} />
        </button>
        {group.source === "gallery" && (
          <button
            type="button"
            title="Preview gallery group"
            aria-label={`Preview ${group.title}`}
            onClick={onPreview}
          >
            <Eye aria-hidden="true" size={16} />
          </button>
        )}
        {group.source === "gallery" ? (
          <button
            type="button"
            title={
              group.source === "gallery"
                ? "Edit gallery group"
                : "Manage announcement"
            }
            aria-label={`Manage ${group.title}`}
            onClick={onManage}
          >
            <Pencil aria-hidden="true" size={16} />
          </button>
        ) : (
          <a
            href="/portal/chairman/announcements"
            title="Manage announcement"
            aria-label={`Manage ${group.title}`}
          >
            <Pencil aria-hidden="true" size={16} />
          </a>
        )}
      </div>
      {metadata &&
        createPortal(
          <div
            role="tooltip"
            className={styles.tooltip}
            style={{ left: metadata.left, top: metadata.top }}
          >
            <span>
              {group.source === "gallery" ? (
                <Images aria-hidden="true" size={14} />
              ) : (
                <Megaphone aria-hidden="true" size={14} />
              )}{" "}
              {group.source === "gallery" ? "Gallery" : "Announcement"} ·{" "}
              {group.photoCount} photos
            </span>
            <strong>{group.title}</strong>
            <span>
              {group.dateLabel}:{" "}
              {new Date(group.date).toLocaleDateString("en-PH", {
                timeZone: "Asia/Manila",
              })}{" "}
              · {group.status}
            </span>
            {group.activityDate && (
              <span>
                Activity date:{" "}
                {new Date(group.activityDate).toLocaleDateString("en-PH", {
                  timeZone: "Asia/Manila",
                })}
              </span>
            )}
            {!group.eligible && <span>Unavailable for public placement</span>}
          </div>,
          document.body,
        )}
    </article>
  );
}
