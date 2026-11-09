"use client";

import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { useId, useState, type ReactNode } from "react";

export function RentalListFilters({ label, search, children, activeCount, hasFilters, onClear, note }: {
  label: string;
  search: ReactNode;
  children: ReactNode;
  activeCount: number;
  hasFilters: boolean;
  onClear: () => void;
  note?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const panelId = useId();
  return <section aria-label={label} className="min-w-0 rounded-2xl border border-coop-card-border bg-white p-4 shadow-[0_3px_12px_rgba(18,61,42,.035)]">
    <div className="flex flex-wrap items-end gap-3">
      <div className="min-w-0 basis-64 flex-1">{search}</div>
      <button type="button" aria-label="More filters" aria-expanded={expanded} aria-controls={panelId} onClick={() => setExpanded(open => !open)}
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-coop-border px-3 text-sm font-semibold text-coop-secondary hover:bg-coop-sage focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coop-green">
        <SlidersHorizontal aria-hidden="true" className="size-4" />More filters
        {activeCount > 0 ? <span className="rounded-full bg-coop-sage px-2 py-0.5 text-xs">{activeCount} active</span> : null}
        <ChevronDown aria-hidden="true" className={`size-4 transition-transform motion-reduce:transition-none ${expanded ? "rotate-180" : ""}`} />
      </button>
      {hasFilters ? <button type="button" onClick={onClear} className="min-h-11 rounded-xl px-2 text-xs font-semibold text-coop-green hover:bg-coop-sage focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coop-green">Clear filters</button> : null}
    </div>
    {note ? <p className="mt-2 text-xs text-coop-muted">{note}</p> : null}
    <div id={panelId} hidden={!expanded}>
      <div className="mt-4 grid gap-4 border-t border-coop-card-border pt-4 sm:grid-cols-2 2xl:grid-cols-3">{children}</div>
    </div>
  </section>;
}
