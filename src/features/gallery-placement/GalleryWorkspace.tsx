"use client";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  ImagePlus,
  RefreshCw,
  Save,
  Shuffle,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { StyledSelect } from "@/components/ui/StyledSelect";
import {
  ConfirmDialog,
  FormDialog,
} from "@/components/portal/PortalPrimitives";
import { resolveUploadUrl } from "@/lib/upload-url";
import { PhotoGroupStack } from "./PhotoGroupStack";
import {
  placePhoto,
  photoDateBucket,
  photoSignature,
  snapshotPhotos,
} from "./gallery-draft";
import {
  readPlacement,
  readLibrary,
  readGroupPhotos,
  proposePlacement,
  publishPlacement,
  type LibraryPhoto,
  type LibraryGroup,
  type PlacementSnapshot,
} from "./gallery-client";
import styles from "./GalleryWorkspace.module.css";
type Props = {
  refreshKey: unknown;
  onEditGallery: (id: string) => void;
  onPreviewGallery: (id: string) => void;
  onToggleGallery: (id: string) => void;
};
const area = ["a", "b", "c", "d", "e", "f", "g"];
export function GalleryWorkspace({
  refreshKey,
  onEditGallery,
  onPreviewGallery,
  onToggleGallery,
}: Props) {
  const [published, setPublished] = useState<PlacementSnapshot | null>(null),
    [draft, setDraft] = useState<Array<LibraryPhoto | null>>(
      Array(7).fill(null),
    );
  const [kind, setKind] = useState("Published arrangement"),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<LibraryPhoto | null>(null),
    [target, setTarget] = useState<number | null>(null),
    [dragTarget, setDragTarget] = useState<number | null>(null);
  const [publishOpen, setPublishOpen] = useState(false),
    [restoreOpen, setRestoreOpen] = useState(false),
    [previewOpen, setPreviewOpen] = useState(false);
  const [source, setSource] = useState("All Photos"),
    [search, setSearch] = useState(""),
    [sort, setSort] = useState("Newest first"),
    [page, setPage] = useState(1),
    [library, setLibrary] = useState<{
      groups: LibraryGroup[];
      total: number;
      page: number;
      pageSize: number;
    } | null>(null),
    [loading, setLoading] = useState(true),
    [libraryError, setLibraryError] = useState(""),
    [reload, setReload] = useState(0);
  const [failed, setFailed] = useState<Set<string>>(new Set()),
    [browse, setBrowse] = useState<LibraryGroup | null>(null),
    [browsePhotos, setBrowsePhotos] = useState<LibraryPhoto[]>([]),
    [browsePage, setBrowsePage] = useState(1),
    [hasMore, setHasMore] = useState(false),
    [browseBusy, setBrowseBusy] = useState(false),
    [browseError, setBrowseError] = useState("");
  const [session] = useState(() => {
    const cache = new Map<string, LibraryPhoto>();
    let request = 0;
    return {
      remember: (p: LibraryPhoto) => {
        cache.set(p.id, p);
      },
      get: (id: string) => cache.get(id),
      next: () => ++request,
      cancel: () => {
        request++;
      },
      isLatest: (id: number) => id === request,
    };
  });
  const [browseOpener, setBrowseOpener] = useState<HTMLElement | null>(null);
  const [clearedMissing, setClearedMissing] = useState(false);
  const dirty = published
    ? clearedMissing ||
      photoSignature(draft) !== photoSignature(snapshotPhotos(published))
    : false;
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const invalid = draft.some((p) => p && (!p.eligible || failed.has(p.id)));
  const count = draft.filter(Boolean).length;
  useEffect(() => {
    let active = true;
    void readPlacement()
      .then((s) => {
        if (active) {
          setPublished(s);
          setDraft(snapshotPhotos(s));
          for (const slot of s.slots)
            if (slot.photo) session.remember(slot.photo);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [session]);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void readLibrary(
        {
          source:
            source === "Gallery"
              ? "gallery"
              : source === "Announcements"
                ? "announcement"
                : "all",
          search,
          sort: sort === "Newest first" ? "newest" : "oldest",
          page,
          pageSize: 12,
        },
        controller.signal,
      )
        .then((result) => {
          setLibrary(result);
          setLibraryError("");
          for (const g of result.groups)
            for (const p of g.photos) session.remember(p);
        })
        .catch((e) => {
          if (!controller.signal.aborted) setLibraryError(e.message);
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [source, search, sort, page, reload, refreshKey, session]);
  const sections = useMemo(() => {
    const buckets = new Map<string, LibraryGroup[]>([
      ["Today", []],
      ["This week", []],
      ["This month", []],
      ["Older", []],
    ]);
    for (const g of library?.groups ?? [])
      buckets.get(photoDateBucket(g.date))!.push(g);
    return [...buckets].filter(([, g]) => g.length);
  }, [library]);
  function fail(id: string) {
    setFailed((current) => new Set(current).add(id));
  }
  function put(p: LibraryPhoto, index: number) {
    if (busy || !p.eligible || failed.has(p.id)) return;
    setDraft((current) => placePhoto(current, p, index));
    setKind("Unsaved changes");
    setSelected(null);
    setTarget(null);
    setNotice(`Photo placed in position ${index + 1}. Publish when ready.`);
  }
  function select(p: LibraryPhoto) {
    if (busy) return;
    if (target !== null) put(p, target);
    else {
      setSelected(p);
      setNotice("Photo selected. Choose a numbered position above.");
      document.getElementById("gallery-placement-heading")?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
        block: "start",
      });
    }
  }
  function chooseSlot(index: number) {
    if (busy) return;
    if (selected) put(selected, index);
    else {
      setTarget(index);
      setNotice(`Choose a library photo for position ${index + 1}.`);
    }
  }
  async function randomize() {
    setBusy(true);
    setError("");
    try {
      const r = await proposePlacement([...failed]);
      const valid = r.photos.filter((p) => !failed.has(p.id));
      for (const p of valid) session.remember(p);
      setDraft(Array.from({ length: 7 }, (_, i) => valid[i] ?? null));
      setSelected(null);
      setTarget(null);
      setKind("Randomized proposal");
      setNotice(
        `${valid.length} distinct photos proposed. Nothing is published until Save & Publish.`,
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not propose photos. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function publish() {
    if (!published) return;
    setBusy(true);
    setError("");
    try {
      const s = await publishPlacement({
        expectedRevision: published.revision,
        slots: draft.map((p, i) => ({
          position: i + 1,
          photo: p ? { source: p.source, photoId: p.photoId } : null,
        })),
      });
      setPublished(s);
      setDraft(snapshotPhotos(s));
      setClearedMissing(false);
      setSelected(null);
      setTarget(null);
      setKind("Published arrangement");
      setNotice("Your homepage photos are published.");
      setPublishOpen(false);
    } catch (e) {
      setPublishOpen(false);
      setError(
        e instanceof Error
          ? e.message
          : "Publication could not be confirmed. Reload the published arrangement before trying again.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function restore() {
    setBusy(true);
    try {
      const s = await readPlacement();
      setPublished(s);
      setDraft(snapshotPhotos(s));
      setClearedMissing(false);
      setSelected(null);
      setTarget(null);
      setKind("Published arrangement");
      setError("");
      setNotice("Published arrangement restored.");
      setSelected(null);
      setTarget(null);
      setRestoreOpen(false);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not reload published photos.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function openBrowse(g: LibraryGroup) {
    setBrowseOpener(
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null,
    );
    setBrowse(g);
    setBrowsePhotos([]);
    setBrowseError("");
    setBrowsePage(1);
    setBrowseBusy(true);
    const id = session.next();
    try {
      const r = await readGroupPhotos(g.source, g.groupId);
      if (!session.isLatest(id)) return;
      setBrowsePhotos(r.photos);
      setHasMore(r.hasMore);
      for (const p of r.photos) session.remember(p);
    } catch (e) {
      if (session.isLatest(id))
        setBrowseError(
          e instanceof Error ? e.message : "Could not load group photos.",
        );
    } finally {
      if (session.isLatest(id)) setBrowseBusy(false);
    }
  }
  async function more() {
    if (!browse) return;
    const id = session.next();
    setBrowseBusy(true);
    try {
      const r = await readGroupPhotos(
        browse.source,
        browse.groupId,
        browsePage + 1,
      );
      if (!session.isLatest(id)) return;
      setBrowsePhotos((current) => [...current, ...r.photos]);
      setBrowsePage(browsePage + 1);
      setHasMore(r.hasMore);
      for (const p of r.photos) session.remember(p);
    } catch (e) {
      setBrowseError(
        e instanceof Error ? e.message : "Could not load more photos.",
      );
    } finally {
      if (session.isLatest(id)) setBrowseBusy(false);
    }
  }
  function closeBrowse(toSlot?: number) {
    session.cancel();
    setBrowse(null);
    setTimeout(() => {
      if (typeof toSlot === "number")
        document
          .getElementById(`gallery-slot-${toSlot + 1}`)
          ?.focus({ preventScroll: true });
      else browseOpener?.focus();
    }, 0);
  }
  function move(index: number, delta: number) {
    const other = index + delta;
    if (other < 0 || other > 6) return;
    setDraft((current) => {
      const n = [...current];
      [n[index], n[other]] = [n[other], n[index]];
      return n;
    });
    setKind("Unsaved changes");
    setNotice(`Moved photo to position ${other + 1}.`);
  }
  return (
    <div className={styles.workspace}>
      {error && (
        <div role="alert" className={styles.message}>
          {error}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => void restore()}
            disabled={busy}
          >
            Reload published photos
          </Button>
        </div>
      )}
      <section
        className={styles.panel}
        aria-labelledby="gallery-placement-heading"
        aria-busy={busy}
      >
        <div className={styles.heading}>
          <div>
            <h2
              id="gallery-placement-heading"
              tabIndex={-1}
              className="scroll-mt-24"
            >
              Landing placement
            </h2>
            <p className={styles.status}>
              {dirty ? kind : "Published arrangement"} · {count}/7 photos
            </p>
          </div>
          <div className={styles.actions}>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => void randomize()}
              disabled={busy || !published}
            >
              <Shuffle aria-hidden="true" size={16} />
              {kind === "Randomized proposal" ? "Randomize again" : "Randomize"}
            </Button>
            <FormDialog
              title="Homepage preview"
              description="Preview of this draft. Publish to update the public site."
              open={previewOpen}
              onOpenChange={setPreviewOpen}
              contentClassName="!w-[min(70rem,calc(100vw-2rem))]"
              trigger={
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={!count}
                >
                  <Eye aria-hidden="true" size={16} />
                  Preview
                </Button>
              }
            >
              <div className={count === 7 ? styles.mosaic : styles.mosaicSmall}>
                {draft
                  .filter((p): p is LibraryPhoto => Boolean(p))
                  .map((p, i) => (
                    <Image
                      key={p.id}
                      src={resolveUploadUrl(p.imagePath)}
                      alt={p.altText}
                      width={500}
                      height={400}
                      unoptimized
                      style={count === 7 ? { gridArea: area[i] } : undefined}
                      onError={() => fail(p.id)}
                    />
                  ))}
              </div>
            </FormDialog>
            <ConfirmDialog
              title="Restore published photos?"
              description="Your unsaved selection will be replaced with the currently published arrangement."
              open={restoreOpen}
              onOpenChange={setRestoreOpen}
              onConfirm={() => void restore()}
              loading={busy}
              confirmLabel="Restore published"
              trigger={
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={busy || !dirty}
                >
                  <Undo2 aria-hidden="true" size={16} />
                  Restore published
                </Button>
              }
            />
            <ConfirmDialog
              title="Publish homepage photos?"
              description={`Publish this ${count}-photo arrangement in the saved order. Empty positions will remain unfilled.`}
              confirmLabel="Save & Publish"
              open={publishOpen}
              onOpenChange={setPublishOpen}
              onConfirm={() => void publish()}
              loading={busy}
              trigger={
                <Button
                  type="button"
                  size="sm"
                  disabled={!published || !dirty || busy || invalid}
                >
                  <Save aria-hidden="true" size={16} />
                  Save & Publish
                </Button>
              }
            />
          </div>
        </div>
        <div className={styles.slots}>
          {draft.map((p, index) => (
            <div
              key={index}
              className={`${styles.slot} ${target === index || dragTarget === index ? styles.active : ""}`}
              onDragOver={(e) => {
                if (
                  !busy &&
                  e.dataTransfer.types.includes("application/x-trackcoop-photo")
                ) {
                  e.preventDefault();
                  setDragTarget(index);
                }
              }}
              onDragLeave={() => setDragTarget(null)}
              onDrop={(e) => {
                e.preventDefault();
                setDragTarget(null);
                const p = session.get(
                  e.dataTransfer.getData("application/x-trackcoop-photo"),
                );
                if (p) put(p, index);
              }}
            >
              <button
                type="button"
                className={styles.drop}
                id={`gallery-slot-${index + 1}`}
                aria-label={`Choose photo for position ${index + 1}`}
                aria-pressed={target === index}
                disabled={busy || !published}
                draggable={Boolean(p?.eligible) && !busy}
                onClick={() => chooseSlot(index)}
                onDragStart={(e) => {
                  if (p) {
                    session.remember(p);
                    e.dataTransfer.setData(
                      "application/x-trackcoop-photo",
                      p.id,
                    );
                    e.dataTransfer.effectAllowed = "move";
                  }
                }}
              >
                {p && !failed.has(p.id) ? (
                  <Image
                    src={resolveUploadUrl(p.thumbnailPath || p.imagePath)}
                    alt={p.altText}
                    width={180}
                    height={120}
                    unoptimized
                    draggable={false}
                    onError={() => fail(p.id)}
                  />
                ) : (
                  <span className={styles.empty}>
                    <ImagePlus aria-hidden="true" size={22} />
                    {p ||
                    (published?.slots[index]?.unavailable && !clearedMissing)
                      ? "Photo unavailable"
                      : "Choose photo"}
                  </span>
                )}
              </button>
              <span className={styles.slotNumber}>Photo {index + 1}</span>
              <div className={styles.slotFooter}>
                <span>
                  {p
                    ? !p.eligible || failed.has(p.id)
                      ? "Unavailable"
                      : p.source === "gallery"
                        ? "Gallery"
                        : "Announcement"
                    : "Empty"}
                </span>
                {(p ||
                  (published?.slots[index]?.unavailable &&
                    !clearedMissing)) && (
                  <div className={styles.actions}>
                    <button
                      type="button"
                      disabled={busy || !p || index === 0}
                      aria-label={`Move photo ${index + 1} left`}
                      title="Move left"
                      onClick={() => move(index, -1)}
                    >
                      <ArrowLeft aria-hidden="true" size={14} />
                    </button>
                    <button
                      type="button"
                      disabled={busy || !p || index === 6}
                      aria-label={`Move photo ${index + 1} right`}
                      title="Move right"
                      onClick={() => move(index, 1)}
                    >
                      <ArrowRight aria-hidden="true" size={14} />
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      aria-label={`Remove photo ${index + 1}`}
                      title="Remove"
                      onClick={() => {
                        if (!p) setClearedMissing(true);
                        setDraft((current) =>
                          current.map((v, i) => (i === index ? null : v)),
                        );
                        setKind("Unsaved changes");
                      }}
                    >
                      <Trash2 aria-hidden="true" size={14} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
        {selected && (
          <div className={styles.message}>
            Photo selected. Choose a position above.
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setSelected(null)}
            >
              <X size={15} />
              Cancel selection
            </Button>
          </div>
        )}
        {invalid && (
          <p className={styles.placementNote}>
            Replace or remove unavailable photos before publishing.
          </p>
        )}
        <p className={styles.srStatus} role="status">
          {notice}
        </p>
      </section>
      <section
        className={styles.panel}
        aria-labelledby="gallery-library-heading"
      >
        <div className={styles.heading}>
          <h2 id="gallery-library-heading">Photo library</h2>
          <div className={styles.legend}>
            <span>
              <i />
              Gallery
            </span>
            <span>
              <i />
              Announcements
            </span>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              aria-label="Refresh photo library"
              onClick={() => {
                setFailed(new Set());
                setLoading(true);
                setReload((r) => r + 1);
              }}
            >
              <RefreshCw aria-hidden="true" size={16} />
            </Button>
          </div>
        </div>
        <div className={styles.filters}>
          <label>
            Search photos
            <input
              value={search}
              name="gallery-search"
              autoComplete="off"
              placeholder="Group or announcement title"
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
                setLoading(true);
              }}
            />
          </label>
          <label>
            Source
            <StyledSelect
              value={source}
              options={["All Photos", "Gallery", "Announcements"]}
              onChange={(v) => {
                setSource(v);
                setPage(1);
                setLoading(true);
              }}
              aria-label="Photo source"
            />
          </label>
          <label>
            Sort
            <StyledSelect
              value={sort}
              options={["Newest first", "Oldest first"]}
              onChange={(v) => {
                setSort(v);
                setPage(1);
                setLoading(true);
              }}
              aria-label="Photo library sort"
            />
          </label>
        </div>
      </section>
      {libraryError ? (
        <div className={styles.message} role="alert">
          {libraryError}
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setLoading(true);
              setReload((r) => r + 1);
            }}
          >
            Retry library
          </Button>
        </div>
      ) : loading ? (
        <div
          className={styles.groups}
          role="status"
          aria-label="Loading photo library"
        >
          <div className={styles.skeleton} />
          <div className={styles.skeleton} />
        </div>
      ) : library?.groups.length ? (
        sections.map(([section, groups]) => (
          <section
            className={styles.section}
            key={section}
            aria-label={section}
          >
            <h3>{section}</h3>
            <div className={styles.groups}>
              {groups.map((g) => (
                <PhotoGroupStack
                  key={g.id}
                  group={g}
                  onSelect={select}
                  onDrag={(p) => session.remember(p)}
                  onBrowse={() => void openBrowse(g)}
                  onManage={() => onEditGallery(g.groupId)}
                  onPreview={() => onPreviewGallery(g.groupId)}
                  failed={failed}
                  onFailed={fail}
                />
              ))}
            </div>
          </section>
        ))
      ) : (
        <p className={styles.panel}>
          No matching photo groups. Upload Gallery photos or publish a Public
          announcement with photos.
        </p>
      )}
      {library && library.total > 0 && (
        <div className={styles.pagination}>
          <span>{library.total} groups</span>
          <div className={styles.actions}>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={loading || library.page <= 1}
              aria-label="Previous photo library page"
              onClick={() => {
                setPage(library.page - 1);
                setLoading(true);
              }}
            >
              <ArrowLeft aria-hidden="true" size={16} />
            </Button>
            <span>
              {library.page} /{" "}
              {Math.max(1, Math.ceil(library.total / library.pageSize))}
            </span>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={
                loading || library.page * library.pageSize >= library.total
              }
              aria-label="Next photo library page"
              onClick={() => {
                setPage(library.page + 1);
                setLoading(true);
              }}
            >
              <ArrowRight aria-hidden="true" size={16} />
            </Button>
          </div>
        </div>
      )}
      <FormDialog
        title={browse?.title ?? "Group photos"}
        description="Choose an individual photo for a landing position."
        open={Boolean(browse)}
        onOpenChange={(open) => {
          if (!open) closeBrowse();
        }}
        contentClassName="!w-[min(58rem,calc(100vw-2rem))] overflow-hidden !rounded-xl"
      >
        {browse?.source === "gallery" && (
          <div className={styles.actions}>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                const id = browse.groupId;
                closeBrowse();
                onEditGallery(id);
              }}
            >
              Edit gallery group
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                const id = browse.groupId;
                closeBrowse();
                onToggleGallery(id);
              }}
            >
              Toggle visibility
            </Button>
          </div>
        )}
        {browseError && (
          <p role="alert" className={styles.message}>
            {browseError}
            <Button
              type="button"
              variant="secondary"
              onClick={() => browse && void openBrowse(browse)}
            >
              Retry photos
            </Button>
          </p>
        )}
        <div className={styles.browserPhotos}>
          {browsePhotos.map((p) => (
            <button
              type="button"
              key={p.id}
              className={`${styles.browserPhoto} ${selected?.id === p.id ? styles.selected : ""}`}
              disabled={!p.eligible || failed.has(p.id) || busy}
              onClick={() => {
                select(p);
                closeBrowse(target ?? 0);
              }}
            >
              <Image
                src={resolveUploadUrl(p.thumbnailPath || p.imagePath)}
                alt={p.altText}
                width={220}
                height={150}
                unoptimized
                onError={() => fail(p.id)}
              />
              <span>
                {!p.eligible || failed.has(p.id) ? (
                  "Unavailable"
                ) : (
                  <>
                    <ImagePlus
                      aria-hidden="true"
                      size={14}
                      className="inline"
                    />
                    Select photo
                  </>
                )}
              </span>
            </button>
          ))}
        </div>
        {browseBusy && <p role="status">Loading group photos...</p>}
        {hasMore && (
          <Button
            type="button"
            variant="secondary"
            loading={browseBusy}
            onClick={() => void more()}
          >
            Load more photos
          </Button>
        )}
      </FormDialog>
    </div>
  );
}
